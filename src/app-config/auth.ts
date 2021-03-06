import { AuthenticationClient } from 'auth0';
import { AxiosInstance } from 'axios';
import LoginRequiredError from '../common/errors/login-required';
import { docker } from '../common/utils/docker';
import { Auth0Shim } from './auth0_shim';
import CallbackServer from './callback_server';
import AppConfig from './config';
import CredentialManager from './credentials';

const CREDENTIAL_PREFIX = 'architect.io';

interface AuthResults {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  issued_at: number;
}

export default class AuthClient {
  config: AppConfig;
  credentials: CredentialManager;
  auth0: AuthenticationClient;
  auth_results?: AuthResults;
  callback_server: CallbackServer;
  auth0_transaction: any;
  architect_api: AxiosInstance;

  public static AUDIENCE = 'architect-hub-api';
  public static CLIENT_ID = '079Kw3UOB5d2P6yZlyczP9jMNNq8ixds';
  public static SCOPE = 'openid profile email offline_access';

  constructor(config: AppConfig, architect_api: AxiosInstance) {
    this.config = config;
    this.credentials = new CredentialManager(config);
    this.auth0 = new AuthenticationClient({
      domain: this.config.oauth_domain,
      clientId: AuthClient.CLIENT_ID,
    });
    this.callback_server = new CallbackServer();
    this.architect_api = architect_api;
  }

  async init() {
    const token = await this.getToken();
    if (token && token.password !== 'unknown') {
      this.auth_results = JSON.parse(token.password) as AuthResults;
      const expires_at = this.auth_results.issued_at + this.auth_results.expires_in;
      // Refresh the token if its expired to force a docker login
      if (expires_at < (new Date().getTime() / 1000)) {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        await this.refreshToken().catch(() => { });
      }
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

  async loginFromCli(email: string, password: string) {
    await this.logout();

    let auth0_results;
    try {
      // TODO make sure mfa flow error is good
      const { data } = await this.architect_api.post('/oauth/token', { email: email, token: password });
      auth0_results = data;
    } catch (err) {
      try {
        auth0_results = await this.auth0.passwordGrant({
          realm: 'Username-Password-Authentication',
          username: email,
          password: password,
          // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
          // @ts-ignore: the auth0 library is not properly typed -_-
          audience: AuthClient.AUDIENCE,
          scope: AuthClient.SCOPE,
        }) as AuthResults;
      } catch (err) {
        if (err.name === 'mfa_required') {
          throw new Error('Multifactor authentication required. Use personal access tokens when in non-interactive flows.');
        } else {
          throw err;
        }
      }
    }

    await this.setToken(email, auth0_results);
    const new_token = await this.dockerLogin(email);
    if (!new_token) {
      throw new Error('Login failed');
    }
  }

  public generateBrowserUrl(port: number): string {
    const auth0_transaction = Auth0Shim.buildAuth0Transaction(
      AuthClient.CLIENT_ID,
      this.config.oauth_domain,
      {
        redirect_uri: 'http://localhost:' + port, // this is where our callback_server will listen
        audience: AuthClient.AUDIENCE,
        scope: AuthClient.SCOPE,
      }
    );
    this.auth0_transaction = auth0_transaction;
    return 'https://' + auth0_transaction.url;
  }

  async loginFromBrowser(port: number) {
    await this.logout();

    const oauth_code = await this.callback_server.listenForCallback(port);
    const auth0_results = await this.performOauthHandshake(oauth_code);

    const decoded_token = Auth0Shim.verifyIdToken(
      this.config.oauth_domain,
      AuthClient.CLIENT_ID,
      auth0_results.id_token,
      this.auth0_transaction.nonce
    );

    if (!auth0_results) {
      throw new Error('Login Failed at Oauth Handshake');
    }

    if (!decoded_token.user) {
      throw new Error('Login Failed with Invalid JWT Token');
    }

    const email = decoded_token.user.email;
    await this.setToken(email, auth0_results);
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

    const token = JSON.parse(credential.password) as AuthResults;
    if (!token.refresh_token) {
      await this.logout();
      throw new LoginRequiredError();
    }

    this.auth_results = await this.performOauthRefresh(token.refresh_token) as AuthResults;

    await this.setToken(credential.account, this.auth_results);
    await this.dockerLogin(credential.account);
    return this.auth_results;
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

  private async setToken(email: any, auth0_results: any) {
    // Windows credential manager password max length is 256 chars
    this.auth_results = {
      access_token: auth0_results.access_token,
      refresh_token: auth0_results.refresh_token,
      token_type: auth0_results.token_type,
      expires_in: auth0_results.expires_in,
      issued_at: new Date().getTime() / 1000,
    };

    await this.credentials.set(`${CREDENTIAL_PREFIX}/token`, email, JSON.stringify(this.auth_results));
    return this.auth_results;
  }

  private async performOauthHandshake(
    oauth_code: string
  ): Promise<any> {

    const tokenOptions = {
      baseUrl: this.config.oauth_domain,
      client_id: AuthClient.CLIENT_ID,
      code_verifier: this.auth0_transaction.code_verifier,
      grant_type: 'authorization_code',
      code: oauth_code,
      redirect_uri: this.auth0_transaction.redirect_uri,
    };

    const auth_result = await this.auth0.oauth?.authorizationCodeGrant(tokenOptions);
    if (!auth_result || !auth_result.id_token) {
      throw new Error('Login failed during oauth handshake');
    }

    return auth_result;
  }

  private async performOauthRefresh(
    refresh_token: string
  ): Promise<any> {
    const tokenOptions = {
      baseUrl: this.config.oauth_domain,
      grant_type: 'refresh_token',
      client_id: AuthClient.CLIENT_ID,
      refresh_token: refresh_token,
    };

    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore: the auth0 library is not properly typed -_-
      const auth_result = await this.auth0.oauth?.refreshToken(tokenOptions);
      if (!auth_result || !auth_result.id_token) {
        this.logout();
        throw new Error('Refresh auth token failed, please log in again');
      }

      // set refresh token back in the results for persistence again
      auth_result.refresh_token = refresh_token;

      return auth_result;
    } catch (err) {
      await this.logout();
      throw new LoginRequiredError();
    }
  }
}
