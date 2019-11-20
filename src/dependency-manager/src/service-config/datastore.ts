export interface DockerConfig {
  image: string;
  target_port: string | number;
}

export default abstract class ServiceDatastore {
  abstract getDockerConfig(): DockerConfig;
}
