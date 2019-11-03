interface DatastoreImage {
  image: string;
  target_port: number | string;
}

export default abstract class EnvironmentConfig {
  abstract getServiceParameters(service_ref: string): { [key: string]: string };
  abstract getDatastoreParameters(service_ref: string, datastore_name: string): { [key: string]: string };
}
