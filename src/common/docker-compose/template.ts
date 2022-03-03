export interface DockerServiceBuild {
  context?: string;
  args?: string[] | { [s: string]: string };
  dockerfile?: string;
  target?: string;
}

export interface DockerComposeVolume {
  type?: string;
  source?: string;
  target: string;
  read_only?: boolean;
}

export interface DockerComposeInterface {
  target: string | number;
  published: string | number;
  protocol?: string;
  mode?: string;
}

export interface DockerComposeDeploy {
  replicas?: number;
  resources?: { limits: { cpus?: string; memory?: string } };
}

export interface DockerComposeHealthCheck {
  test: string[];
  interval: string;
  timeout: string;
  retries: number;
  start_period: string;
}

export interface DockerService {
  ports?: string[] | DockerComposeInterface[];
  image?: string;
  environment?: { [key: string]: any };
  depends_on?: string[];
  build?: DockerServiceBuild | string;
  volumes?: string[] | DockerComposeVolume[];
  command?: string[];
  restart?: string;
  entrypoint?: string[];
  dns_search?: string | string[];
  logging?: { driver?: string };
  external_links?: string[];
  deploy?: DockerComposeDeploy;
  extra_hosts?: string[];
  labels?: string[];
  healthcheck?: DockerComposeHealthCheck;
}

export default interface DockerComposeTemplate {
  version: '3';
  services: { [key: string]: DockerService };
  volumes: { [key: string]: { external?: boolean } };
}
