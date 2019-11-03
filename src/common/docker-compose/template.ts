export interface DockerServiceBuild {
  context: string;
  args: string[];
}

export interface DockerService {
  ports: string[];
  image?: string;
  environment?: { [key: string]: any };
  depends_on: string[];
  build?: DockerServiceBuild;
  volumes?: string[];
  command?: string;
}

export default interface DockerComposeTemplate {
  version: '3';
  services: { [key: string]: DockerService };
  volumes: {};
}
