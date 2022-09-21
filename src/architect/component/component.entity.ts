import Account from '../account/account.entity';

export interface Component {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  account: Account;
}
