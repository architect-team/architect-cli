import {ChildProcess} from 'child_process';

export interface ServiceEnvironment {
  host: string;
  port: number;
  service_path: string;
  proto_prefix?: string;
  process: ChildProcess;
}

export default interface DeploymentConfig {
  [service_name: string]: ServiceEnvironment;
}
