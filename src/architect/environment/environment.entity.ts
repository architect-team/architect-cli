import Platform from '../platform/platform.entity';

export default interface Environment {
  id: string;
  name: string;
  platform: Platform;
}
