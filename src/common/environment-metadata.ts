export interface EnvironmentMetadata {
  services?: { [key: string]: ServiceMetadata };
}

interface ServiceMetadata {
  host?: string;
  port?: string;
  datastores?: { [key: string]: DatastoreMetadata };
  parameters?: { [key: string]: string };
}

export interface VaultMetadata {
  type: string;
  host: string;
  description?: string;
  access_token: string;
}

interface DatastoreMetadata {
  host?: string;
  port?: string;
  parameters?: { [key: string]: string };
}
