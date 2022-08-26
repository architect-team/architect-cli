import { AccessToken, AuthorizationCode } from 'simple-oauth2';
import { URL } from 'url';
import User from '../architect/user/user.entity';
import LoginRequiredError from '../common/errors/login-required';
import { docker } from '../common/docker/cmd';
import CallbackServer from './callback_server';
import AppConfig from './config';
import CredentialManager from './credentials';

const CREDENTIAL_PREFIX = 'architect.io';

interface AuthResult {
  email: string;
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  id_token?: string;
}

export default class AuthClient {
  config: AppConfig;
  credentials: CredentialManager;
  _auth_result?: AuthResult;
  callback_server: CallbackServer;
  checkLogin: () => Promise<User>;

  public static SCOPE = 'openid profile email offline_access';

  constructor(config: AppConfig, checkLogin: () => Promise<User>) {
    this.config = config;
    this.credentials = new CredentialManager(config);
    this.callback_server = new CallbackServer();
    this.checkLogin = checkLogin;
  }

  async init(): Promise<void> {
    const token = await this.getPersistedTokenJSON();
    if (token) {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      await this.refreshToken().catch(() => { });
    } else if (!token) {
      try {
        // Spoof login to production registry to enable pulling of public images (ex. architect-nginx/proxy)
        await docker([
          'login', 'registry.architect.io',
          '-u', 'unknown',
          '--password-stdin',
        ], { stdout: false }, {
          input: 'unknown',
        });
      } catch {
        // docker is required, but not truly necessary here
      }
      await this.credentials.set(`${CREDENTIAL_PREFIX}/token`, 'unknown', JSON.stringify({}));
    }
  }

  async loginFromCli(email: string, token: string): Promise<void> {
    await this.logout();

    await this.setToken(email, {
      token_type: 'Basic',
      access_token: Buffer.from(`${email}:${token}`).toString('base64'),
    } as any);

    await this.checkLogin();

    await this.dockerLogin(email);
  }

  private decodeIdToken(token: string) {
    const parts = token.split('.');
    const [header, payload, signature] = parts;

    if (parts.length !== 3 || !header || !payload || !signature) {
      throw new Error('ID token could not be decoded');
    }
    const payloadJSON = JSON.parse(decodeURIComponent(Buffer.from(payload, 'base64').toString()));
    const claims: any = { __raw: token };
    Object.keys(payloadJSON).forEach(k => {
      claims[k] = payloadJSON[k];
    });
    return claims;
  }

  public getAuthClient(): AuthorizationCode<"client_id"> {
    const is_auth0 = this.config.oauth_host === 'https://auth.architect.io';

    let oauth_token_host = this.config.oauth_host;
    const url = new URL(this.config.oauth_host);
    // Set HOST header for local dev
    if (url.hostname.endsWith('.localhost') && process.env.TEST !== '1') {
      oauth_token_host = `${url.protocol}//localhost:${url.port || (url.protocol === 'http:' ? 80 : 443)}`;
    }

    return new AuthorizationCode({
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore Cannot set client.secret https://www.ory.sh/hydra/docs/v1.4/advanced/#mobile--browser-spa-authorization
      client: {
        id: this.config.oauth_client_id,
      },
      auth: {
        tokenHost: oauth_token_host,
        tokenPath: is_auth0 ? '/oauth/token' : '/oauth2/token',
        authorizeHost: this.config.oauth_host,
        authorizePath: is_auth0 ? '/authorize' : '/oauth2/auth',
      },
      options: {
        authorizationMethod: 'body' as const,
      },
    });
  }

  public async loginFromBrowser(port: number, authorization_code: AuthorizationCode): Promise<void> {
    await this.logout();

    const oauth_code = await this.callback_server.listenForCallback(port);

    const url = new URL(this.config.oauth_host);
    const access_token = await authorization_code.getToken(
      {
        code: oauth_code,
        redirect_uri: `http://localhost:${port}`,
        scope: AuthClient.SCOPE,
      },
      {
        json: true,
        payload: { 'client_id': this.config.oauth_client_id },
        headers: { 'HOST': url.hostname },
        rejectUnauthorized: !url.hostname.endsWith('.localhost'),
      }
    );

    const decoded_token = this.decodeIdToken(access_token.token.id_token);

    if (!access_token) {
      throw new Error('Login Failed at Oauth Handshake');
    }

    if (!decoded_token.email) {
      throw new Error('Login Failed with Invalid JWT Token');
    }

    const email = decoded_token.email;
    await this.setToken(email, access_token.token as AuthResult);
    await this.dockerLogin(email);
  }

  async logout(): Promise<void> {
    await this.credentials.delete(`${CREDENTIAL_PREFIX}/token`);
    try {
      await docker(['logout', this.config.registry_host], { stdout: false });
    } catch {
      // docker is required, but not truly necessary here
    }
  }

  async getPersistedTokenJSON(): Promise<AuthResult | undefined> {
    if (!this._auth_result) {
      const credential = await this.credentials.get(`${CREDENTIAL_PREFIX}/token`);
      if (!credential) {
        return;
      }
      try {
        this._auth_result = JSON.parse(credential.password) as AuthResult;
        this._auth_result.email = credential.account;
      } catch {
        await this.credentials.delete(`${CREDENTIAL_PREFIX}/token`);
        throw new LoginRequiredError();
      }
    }
    return this._auth_result;
  }

  async refreshToken(): Promise<AccessToken | undefined> {
    const token_json = await this.getPersistedTokenJSON();
    if (!token_json) {
      await this.logout();
      throw new LoginRequiredError();
    }
    if (token_json.email === 'unknown') {
      await this.logout();
      throw new LoginRequiredError();
    }
    if (!token_json.refresh_token) {
      return; // Don't refresh if a token doesn't exist
    }
    const auth_client = this.getAuthClient();
    let access_token = auth_client.createToken(token_json);

    if (access_token.expired()) {
      access_token = await access_token.refresh({
        scope: AuthClient.SCOPE,
      });

      await this.setToken(token_json.email, access_token.token as AuthResult);
      await this.dockerLogin(token_json.email);
    }

    return access_token;
  }

  async dockerLogin(username: string): Promise<void> {
    await docker([
      'login', this.config.registry_host,
      '-u', username,
      '--password-stdin',
    ], { stdout: false }, {
      input: JSON.stringify(this._auth_result),
    });
  }

  private async setToken(email: any, token: AuthResult) {
    this._auth_result = {
      ...token,
      email,
    };

    delete this._auth_result.id_token; // Windows credential manager password max length is 256 chars

    await this.credentials.set(`${CREDENTIAL_PREFIX}/token`, email, JSON.stringify(this._auth_result));
    return this._auth_result;
  }
}
