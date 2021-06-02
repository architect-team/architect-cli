import atob from "atob";
import base64url from "base64url";
import btoa from "btoa";
import crypto from 'crypto';
import { AuthHelpers } from './auth_helpers';

export interface Auth0Transaction {
  scope: string;
  code_verifier: string;
  authorizeOptions: any;
  state: string;
  nonce: string;
  code_challenge: string;
  redirect_uri?: string;
  url: string;
}

export interface RedirectLoginOptions {
  redirect_uri?: string;
  audience?: string;
  scope?: string;
  fragment?: string;
}

/**
 * This auth0-shim is used to support building the auth0 "/authorize" url. This is typically done in the browser
 * and auth0 packaged that code in the auth0-spa-js library: https://github.com/auth0/auth0-spa-js
 *
 * Unfortunately, the auth0-spa-js library is not written with "Universal javascript" in mind and leans on the dom for certain
 * string manipulation methods (ie: https://github.com/auth0/auth0-spa-js/blob/de3f3d0b400875883e161bbcda7094faf1e50933/src/utils.ts#L212)
 *
 * looking across the auth0 ecosystem, I don't see support for the browswer login flow that doesn't make assumptions that
 * the url is being generated in a browser, so I've rolled our own here (largely taking code snippets from auth0-spa-js)
 *
 * Opened an issue with them here: https://github.com/auth0/auth0-spa-js/issues/432
 */
export class Auth0Shim {

  public static buildAuth0Transaction(
    auth0_client_id: string,
    domain: string,
    options: RedirectLoginOptions,
  ): Auth0Transaction {
    const { redirect_uri, ...authorizeOptions } = options;

    const stateIn = btoa(Auth0Shim.createRandomString());
    const nonceIn = btoa(Auth0Shim.createRandomString());
    const code_verifier = Auth0Shim.createRandomString();

    const code_challengeBuffer = crypto.createHash('sha256').update(code_verifier).digest();
    const code_challenge = base64url(code_challengeBuffer);
    const fragment = options.fragment ? `#${options.fragment}` : '';

    const params = {
      ...authorizeOptions,
      client_id: auth0_client_id,
      scope: this.getUniqueScopes(
        authorizeOptions.scope || ''
      ),
      response_type: 'code',
      response_mode: 'query',
      state: stateIn,
      nonce: nonceIn,
      redirect_uri: redirect_uri,
      code_challenge,
      code_challenge_method: 'S256',
    };

    const url = Auth0Shim._authorizeUrl(domain, params);

    return {
      scope: params.scope,
      code_verifier,
      authorizeOptions,
      state: stateIn,
      nonce: nonceIn,
      code_challenge,
      redirect_uri,
      url: url + fragment,
    };
  }

  private static createRandomString(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private static _authorizeUrl(domain: string, authorizeOptions: any) {
    return Auth0Shim._url(domain, `/authorize?${Auth0Shim.createQueryParams(authorizeOptions)}`);
  }

  private static _url(domain: string, path: any) {
    const telemetry = encodeURIComponent(
      btoa(
        JSON.stringify({
          name: 'a-client-we-rolled-ourselves',
          version: '0.0.0',
        })
      )
    );
    return `${domain}${path}&auth0Client=${telemetry}`;
  }

  private static getUniqueScopes(...scopes: string[]) {
    const scopeString = scopes.filter(Boolean).join();
    const cleaned_scopes = scopeString.replace(/\s/g, ',').split(',');
    return cleaned_scopes.filter((x, i) => cleaned_scopes.indexOf(x) === i)
      .join(' ')
      .trim();
  }

  private static createQueryParams(params: any) {
    return Object.keys(params)
      .filter(k => typeof params[k] !== 'undefined')
      .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
      .join('&');
  }

  public static verifyIdToken(
    auth0_domain: string,
    auth0_client_id: string,
    id_token: string,
    nonce?: string
  ) {
    return AuthHelpers.verify({
      iss: 'https://' + auth0_domain + '/',
      aud: auth0_client_id,
      id_token,
      nonce,
      leeway: 60,
    });
  }
}
