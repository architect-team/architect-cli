import Cluster from '../cluster/cluster.entity';

export default interface Environment {
  id: string;
  name: string;
  namespace: string;
  cluster: Cluster;
}
