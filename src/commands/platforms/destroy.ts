import ClusterDestroy from '../clusters/destroy';

export default class PlatformDestroy extends ClusterDestroy {
  static aliases = ['platforms:deregister', 'platform:destroy', 'platforms:destroy'];

  static examples = [
    'architect platform:destroy --account=myaccount architect',
    'architect platforms:deregister --account=myaccount --auto-approve --force architect',
  ];
}
