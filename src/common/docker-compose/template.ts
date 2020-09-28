export interface DockerServiceBuild {
  context?: string;
  args?: string[] | { [s: string]: string };
  dockerfile?: string;
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

export interface DockerService {
  ports: string[] | DockerComposeInterface[];
  image?: string;
  environment?: { [key: string]: any };
  depends_on: string[];
  build?: DockerServiceBuild;
  volumes?: string[] | DockerComposeVolume[];
  command?: string[];
  restart?: string;
  entrypoint?: string[];
  dns_search?: string | string[];
  logging?: { driver?: string };
  external_links?: string[];
}

export default interface DockerComposeTemplate {
  version: '3';
  services: { [key: string]: DockerService };
  volumes: {};
}
