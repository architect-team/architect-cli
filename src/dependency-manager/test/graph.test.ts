import axios from 'axios';
import { expect } from 'chai';
import { BaseServiceConfig } from '../src/configs/base-configs/service-config';
import { EnvironmentBuilder } from '../src/configs/environment.builder';
import { EnvironmentGraph } from '../src/configs/graph';
import { ServiceBuilder } from '../src/configs/service.builder';

describe('graph', () => {
  it('should enrich graph with dependencies from registry', async () => {
    const env_spec = {
      services: [{
        name: 'hipster-shop-demo/frontend',
        ref: 'latest'
      }]
    };

    const parsedSpec = await EnvironmentBuilder.parseAndValidate(env_spec);
    const graph = new EnvironmentGraph(parsedSpec);
    await graph.build({
      getConfig: async (ref: string): Promise<BaseServiceConfig> => {
        const [name, tag] = ref.split(':');
        const [account_name, service_name] = name.split('/');
        const { data: service_digest } = await axios.get(`/accounts/${account_name}/services/${service_name}/versions/${tag}`, {
          baseURL: 'https://api.dev.architect.io/'
        });
        return ServiceBuilder.parseAndValidate(service_digest.config);
      },
      getHostAssignment: async () => '127.0.0.1',
      getPortAssignment: async () => 8080,
    });

    const services = graph.getServices();
    expect(services.length).to.equal(11);
    expect(services.map(service => service.getName()).sort()).to.eql([
      'hipster-shop-demo/frontend',
      'hipster-shop-demo/cartservice',
      'hipster-shop-demo/cartservice.primary',
      'hipster-shop-demo/recommendationservice',
      'hipster-shop-demo/productcatalogservice',
      'hipster-shop-demo/currencyservice',
      'hipster-shop-demo/shippingservice',
      'hipster-shop-demo/checkoutservice',
      'hipster-shop-demo/emailservice',
      'hipster-shop-demo/paymentservice',
      'hipster-shop-demo/adservice'
    ].sort());
  });
});
