import Account from '../account/account.entity';

export default interface Platform {
  id: string;
  name: string;
  type: string;
  account: Account;
}
