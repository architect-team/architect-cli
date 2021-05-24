export interface InterfaceSpec {
  description?: string;
  host?: string;
  port: string;
  url?: string;
  protocol?: string;
  username?: string;
  password?: string;
  sticky?: string;

  external_name?: string;
  consumers?: string[];
  dns_zone?: string;
  subdomain?: string;
}
