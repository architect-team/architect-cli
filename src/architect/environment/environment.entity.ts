import Platform from '../platform/platform.entity';

export default interface Environment {
  id: string;
  name: string;
  namespace: string;
  platform: Platform;
}
