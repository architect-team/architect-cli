import Account from '../account/account.entity';
import Cluster from '../cluster/cluster.entity';

export default interface Pipeline {
  id: string;
  failed_at?: string;
  applied_at?: string;
  aborted_at?: string;
  environment?: {
    id: string;
    name: string;
    cluster: Cluster;
    account: Account;
  };
  cluster?: Cluster;
}
