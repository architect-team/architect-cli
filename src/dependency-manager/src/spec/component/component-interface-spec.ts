import { InterfaceSpec } from '../common/interface-spec';

export interface IngressSpec {
  subdomain?: string;
}

export interface ComponentInterfaceSpec extends InterfaceSpec {
  consumers?: string[];
  dns_zone?: string;
  subdomain?: string;

  ingress?: IngressSpec;
}
