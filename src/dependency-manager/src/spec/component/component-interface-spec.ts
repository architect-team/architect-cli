import { InterfaceSpec } from '../common/interface-spec';

export interface IngressSpec {
  enabled?: boolean;
  subdomain?: string;
}

export interface ComponentInterfaceSpec extends InterfaceSpec {
  consumers?: string[];
  dns_zone?: string;
  subdomain?: string;

  ingress?: IngressSpec;
}
