export default interface DeploymentConfig {
  [service_name: string]: {
    host: string,
    port: number
  };
}
