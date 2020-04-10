interface InterfaceSpec {
  host: string;
  port: number;
}

export interface EnvironmentParameters {
  [key: string]: string | number;
}

interface DatastoreSpec {
  host?: string;
  port?: number;
  parameters: EnvironmentParameters;
}

interface DebugSpec {
  path: string;
  dockerfile?: string;
  volumes?: { [s: string]: string };
  entrypoint?: string | string[];
}

interface IngressSpec {
  subdomain: string;
}

export abstract class EnvironmentService {
  abstract __version: string;
  abstract getInterfaces(): { [s: string]: InterfaceSpec } | undefined;
  abstract getDatastores(): { [key: string]: DatastoreSpec };
  abstract getParameters(): EnvironmentParameters;
  abstract getDebug(): DebugSpec | undefined;
  abstract getIngress(): IngressSpec | undefined;
}
