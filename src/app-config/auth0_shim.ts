import atob from "atob";
import base64url from "base64url";
import btoa from "btoa";
import * as Crypto from 'crypto';

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

  public static build_auth0_transaction(
    auth0_client_id: string,
    domain: string,
    options: RedirectLoginOptions,
  ): Auth0Transaction {
    const { redirect_uri, ...authorizeOptions } = options;

    const stateIn = btoa(Auth0Shim.createRandomString());
    const nonceIn = btoa(Auth0Shim.createRandomString());
    const code_verifier = Auth0Shim.createRandomString();

    const code_challengeBuffer = Crypto.createHash('sha256').update(code_verifier).digest();
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
    return Auth0Shim.verify({
      iss: 'https://' + auth0_domain + '/',
      aud: auth0_client_id,
      id_token,
      nonce,
      leeway: 60,
    });
  }

  private static verify(options: any) {
    if (!options.id_token) {
      throw new Error('ID token is required but missing');
    }

    const decoded = Auth0Shim.decode(options.id_token);

    if (!decoded.claims.iss) {
      throw new Error(
        'Issuer (iss) claim must be a string present in the ID token'
      );
    }

    if (decoded.claims.iss !== options.iss) {
      throw new Error(
        `Issuer (iss) claim mismatch in the ID token; expected "${options.iss}", found "${decoded.claims.iss}"`
      );
    }

    if (!decoded.user.sub) {
      throw new Error(
        'Subject (sub) claim must be a string present in the ID token'
      );
    }

    if (decoded.header.alg !== 'RS256') {
      throw new Error(
        `Signature algorithm of "${decoded.header.alg}" is not supported. Expected the ID token to be signed with "RS256".`
      );
    }

    if (
      !decoded.claims.aud ||
      !(
        typeof decoded.claims.aud === 'string' ||
        Array.isArray(decoded.claims.aud)
      )
    ) {
      throw new Error(
        'Audience (aud) claim must be a string or array of strings present in the ID token'
      );
    }
    if (Array.isArray(decoded.claims.aud)) {
      if (!decoded.claims.aud.includes(options.aud)) {
        throw new Error(
          `Audience (aud) claim mismatch in the ID token; expected "${
          options.aud
          }" but was not one of "${decoded.claims.aud.join(', ')}"`
        );
      }
      if (decoded.claims.aud.length > 1) {
        if (!decoded.claims.azp) {
          throw new Error(
            'Authorized Party (azp) claim must be a string present in the ID token when Audience (aud) claim has multiple values'
          );
        }
        if (decoded.claims.azp !== options.aud) {
          throw new Error(
            `Authorized Party (azp) claim mismatch in the ID token; expected "${options.aud}", found "${decoded.claims.azp}"`
          );
        }
      }
    } else if (decoded.claims.aud !== options.aud) {
      throw new Error(
        `Audience (aud) claim mismatch in the ID token; expected "${options.aud}" but found "${decoded.claims.aud}"`
      );
    }
    if (options.nonce) {
      if (!decoded.claims.nonce) {
        throw new Error(
          'Nonce (nonce) claim must be a string present in the ID token'
        );
      }
      if (decoded.claims.nonce !== options.nonce) {
        throw new Error(
          `Nonce (nonce) claim mismatch in the ID token; expected "${options.nonce}", found "${decoded.claims.nonce}"`
        );
      }
    }

    if (options.max_age && !(typeof decoded.claims.auth_time === 'number')) {
      throw new Error(
        'Authentication Time (auth_time) claim must be a number present in the ID token when Max Age (max_age) is specified'
      );
    }

    /* istanbul ignore next */
    if (!(typeof decoded.claims.exp === 'number')) {
      throw new Error(
        'Expiration Time (exp) claim must be a number present in the ID token'
      );
    }
    if (!(typeof decoded.claims.iat === 'number')) {
      throw new Error(
        'Issued At (iat) claim must be a number present in the ID token'
      );
    }

    const leeway = options.leeway || 60;
    const now = new Date();
    const expDate = new Date(0);
    const nbfDate = new Date(0);
    const authTimeDate = new Date(0);
    authTimeDate.setUTCSeconds(
      (parseInt(decoded.claims.auth_time) + options.max_age) / 1000 + leeway
    );
    expDate.setUTCSeconds(decoded.claims.exp + leeway);
    nbfDate.setUTCSeconds(decoded.claims.nbf - leeway);

    if (now > expDate) {
      throw new Error(
        `Expiration Time (exp) claim error in the ID token; current time (${now}) is after expiration time (${expDate})`
      );
    }
    if ((typeof decoded.claims.nbf === 'number') && now < nbfDate) {
      throw new Error(
        `Not Before time (nbf) claim in the ID token indicates that this token can't be used just yet. Currrent time (${now}) is before ${nbfDate}`
      );
    }
    if ((typeof decoded.claims.auth_time === 'number') && now > authTimeDate) {
      throw new Error(
        `Authentication Time (auth_time) claim in the ID token indicates that too much time has passed since the last end-user authentication. Currrent time (${now}) is after last auth at ${authTimeDate}`
      );
    }
    return decoded;
  }

  private static decode(token: string) {
    const parts = token.split('.');
    const [header, payload, signature] = parts;

    if (parts.length !== 3 || !header || !payload || !signature) {
      throw new Error('ID token could not be decoded');
    }
    const payloadJSON = JSON.parse(decodeURIComponent(atob(payload)));
    const claims: any = { __raw: token };
    const user: any = {};
    Object.keys(payloadJSON).forEach(k => {
      claims[k] = payloadJSON[k];
      if (!Auth0Shim.idTokendecoded.includes(k)) {
        user[k] = payloadJSON[k];
      }
    });
    return {
      encoded: { header, payload, signature },
      header: JSON.parse(decodeURIComponent(atob(header))),
      claims,
      user,
    };
  }

  private static idTokendecoded = [
    'iss',
    'aud',
    'exp',
    'nbf',
    'iat',
    'jti',
    'azp',
    'nonce',
    'auth_time',
    'at_hash',
    'c_hash',
    'acr',
    'amr',
    'sub_jwk',
    'cnf',
    'sip_from_tag',
    'sip_date',
    'sip_callid',
    'sip_cseq_num',
    'sip_via_branch',
    'orig',
    'dest',
    'mky',
    'events',
    'toe',
    'txn',
    'rph',
    'sid',
    'vot',
    'vtm',
  ];
}
