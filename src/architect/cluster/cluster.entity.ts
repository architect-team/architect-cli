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
}
