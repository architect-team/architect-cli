export interface EnvironmentMetadata {
  services?: { [key: string]: ServiceMetadata };
}

interface ServiceMetadata {
  host?: string;
  port?: string;
  datastores?: { [key: string]: DatastoreMetadata };
  parameters?: { [key: string]: string };
}

interface DatastoreMetadata {
  host?: string;
  port?: string;
  parameters?: { [key: string]: string };
}
