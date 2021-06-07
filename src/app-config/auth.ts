import { AuthorizationCode } from 'simple-oauth2';
import LoginRequiredError from '../common/errors/login-required';
import { docker } from '../common/utils/docker';
import CallbackServer from './callback_server';
import AppConfig from './config';
import CredentialManager from './credentials';

const CREDENTIAL_PREFIX = 'architect.io';

interface AuthResult {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  issued_at: number;
}

export default class AuthClient {
  config: AppConfig;
  credentials: CredentialManager;
  auth_results?: AuthResult;
  callback_server: CallbackServer;
  checkLogin: Function;

  // TODO:auth figure out about audience
  public static AUDIENCE = 'architect-hub-api';
  // TODO:auth make config
  public static CLIENT_ID = '079Kw3UOB5d2P6yZlyczP9jMNNq8ixds';
  public static SCOPE = 'openid profile email offline_access';

  constructor(config: AppConfig, checkLogin: Function) {
    this.config = config;
    this.credentials = new CredentialManager(config);
    this.callback_server = new CallbackServer();
    this.checkLogin = checkLogin;
  }

  async init() {
    const token = await this.getToken();
    if (token && token.password !== 'unknown') {
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
      await this.credentials.set(CREDENTIAL_PREFIX, 'unknown', 'unknown');
      await this.credentials.set(`${CREDENTIAL_PREFIX}/token`, 'unknown', 'unknown');
    }
  }

  async loginFromCli(email: string, token: string) {
    await this.logout();

    await this.setToken(email, {
      token_type: 'Basic',
      access_token: Buffer.from(`${email}:${token}`).toString('base64'),
    } as any);

    await this.checkLogin();

    const new_token = await this.dockerLogin(email);
    if (!new_token) {
      throw new Error('Login failed');
    }
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

  public getAuthClient() {
    const is_auth0 = this.config.oauth_domain === 'auth.architect.io';

    const config = {
      client: {
        id: AuthClient.CLIENT_ID,
      },
      auth: {
        // TODO:auth localhost and host header
        tokenHost: `https://${this.config.oauth_domain}`,
        tokenPath: is_auth0 ? '/oauth/token' : '/oauth2/token',
        authorizeHost: `https://${this.config.oauth_domain}`,
        authorizePath: is_auth0 ? '/authorize' : '/oauth2/auth',
      },
      options: {
        authorizationMethod: 'body' as 'body',
      },
    };
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore Cannot set client.secret https://www.ory.sh/hydra/docs/v1.4/advanced/#mobile--browser-spa-authorization
    return new AuthorizationCode(config);
  }

  public async loginFromBrowser(port: number, authorization_code: AuthorizationCode) {
    await this.logout();

    const oauth_code = await this.callback_server.listenForCallback(port);

    const access_token = await authorization_code.getToken(
      {
        code: oauth_code,
        redirect_uri: 'http://localhost:60000',
        scope: AuthClient.SCOPE,
      },
      {
        json: true,
        payload: { 'client_id': AuthClient.CLIENT_ID },
        // TODO:auth set header for local dev
        // headers: { 'HOST': 'auth-frontend-0jdostdd.arc.localhost' },
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

  async logout() {
    await this.credentials.delete(CREDENTIAL_PREFIX);
    await this.credentials.delete(`${CREDENTIAL_PREFIX}/token`);
    try {
      await docker(['logout', this.config.registry_host], { stdout: false });
    } catch{
      // docker is required, but not truly necessary here
    }
  }

  async getToken() {
    return this.credentials.get(`${CREDENTIAL_PREFIX}/token`);
  }

  async refreshToken() {
    const credential = await this.getToken();
    if (!credential) {
      await this.logout();
      throw new LoginRequiredError();
    }

    if (credential.password === 'unknown') {
      await this.logout();
      throw new LoginRequiredError();
    }

    const token_json = JSON.parse(credential.password) as AuthResult;
    if (!token_json.refresh_token) {
      return; // Don't refresh if a token doesn't exist
    }
    const auth_client = this.getAuthClient();
    let access_token = auth_client.createToken(token_json);

    if (access_token.expired()) {
      const refreshParams = {
        scope: '<scope>',
      };
      access_token = await access_token.refresh(refreshParams);

      await this.setToken(credential.account, access_token.token as AuthResult);
      await this.dockerLogin(credential.account);
    }

    return access_token;
  }

  async dockerLogin(username: string) {
    return await docker([
      'login', this.config.registry_host,
      '-u', username,
      '--password-stdin',
    ], { stdout: false }, {
      input: JSON.stringify(this.auth_results),
    });
  }

  private async setToken(email: any, token: AuthResult) {
    // Windows credential manager password max length is 256 chars
    this.auth_results = {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_type: token.token_type,
      expires_in: token.expires_in,
      issued_at: new Date().getTime() / 1000,
    };

    await this.credentials.set(`${CREDENTIAL_PREFIX}/token`, email, JSON.stringify(this.auth_results));
    return this.auth_results;
  }
}
