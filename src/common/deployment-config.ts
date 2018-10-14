export interface ServiceEnvironment {
  host: string;
  port: number;
  service_path: string;
}

export default interface DeploymentConfig {
  [service_name: string]: ServiceEnvironment;
}
