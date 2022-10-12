import ClusterCreate from '../clusters/create';

export default class PlatformCreate extends ClusterCreate { // TODO: backwards compatibility plus tests for it
  static aliases = ['platforms:register', 'platform:create', 'platforms:create'];

  static examples = [
    'architect platforms:create --account=myaccount',
    'architect platforms:register --account=myaccount --type=kubernetes --kubeconfig=~/.kube/config --auto-approve',
  ];
}
