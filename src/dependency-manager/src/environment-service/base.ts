interface InterfaceSpec {
  description?: string;
  host: string;
  port: number;
}

export interface EnvironmentParameters {
  [key: string]: string | number;
}

interface ServiceDatastore {
  host?: string;
  port?: number;
  parameters: EnvironmentParameters;
}

// export interface EnvironmentService {
//   host?: string;
//   port?: number;
//   parameters: EnvironmentParameters;
//   datastores: {
//     [key: string]: ServiceDatastore;
//   };
//   ingress?: {
//     subdomain: string;
//   };
//   debug?: {
//     path: string;
//     dockerfile?: string;
//     volumes?: string[];
//     entrypoint?: string | string[];
//   };
//   interfaces?: {
//     [key: string]: {
//       host: string;
//       port: string;
//     };
//   };
// }

export abstract class EnvironmentService {
  abstract __version: string;
  abstract getInterfaces(): { [s: string]: InterfaceSpec };
}
