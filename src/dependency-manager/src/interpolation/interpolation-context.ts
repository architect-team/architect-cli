import { ParameterValueV2 } from '../service-config/base';

export interface InterpolationContext {
  parameters: { [key: string]: ParameterValueV2 };
  interfaces: any;
}
