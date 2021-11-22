import Account from '../account/account.entity';
import Platform from '../platform/platform.entity';

export default interface Pipeline {
  id: string;
  failed_at?: string;
  applied_at?: string;
  aborted_at?: string;
  environment?: {
    id: string;
    name: string;
    platform: Platform;
    account: Account;
  };
  platform?: Platform;
}
