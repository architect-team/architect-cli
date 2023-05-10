import Account from '../account/account.entity';

interface Token {
  access_token: string;
}

export default interface Cluster {
  id: string;
  name: string;
  type: string;
  account: Account;
  token: Token;
  properties: {
    is_shared?: boolean;
    is_managed?: boolean;
    is_local?: boolean;
    host?: string;
    traefik_version: string;
  };
}
