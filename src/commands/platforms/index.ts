import Clusters from '../clusters';

export default class Platforms extends Clusters {
  static aliases = ['platform', 'platform:search', 'platforms', 'platforms:search'];

  static examples = [
    'architect platforms',
    'architect platforms --account=myaccount mycluster',
  ];
}
