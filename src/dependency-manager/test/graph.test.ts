import axios from 'axios';
import { expect } from 'chai';
import fs from 'fs';
import mock_fs from 'mock-fs';
import os from 'os';
import path from 'path';
import { generate } from '../../common/docker-compose/new';
import { EnvironmentBuilder } from '../src/configs/environment.builder';
import { EnvironmentGraph } from '../src/configs/graph';
import { BaseServiceConfig } from '../src/configs/service-config';
import { ServiceBuilder } from '../src/configs/service.builder';

describe('graph', () => {
  afterEach(() => {
    mock_fs.restore();
  });

  it('should enrich graph with dependencies from registry', async () => {
    mock_fs({
      '/app/env-config.json': JSON.stringify({
        services: [{
          name: 'hipster-shop-demo/frontend',
          ref: 'latest'
        }]
      }),
    });

    const parsedSpec = await EnvironmentBuilder.loadFromFile('/app/env-config.json');
    const graph = await EnvironmentGraph.build(parsedSpec, {
      getConfig: async (ref: string): Promise<BaseServiceConfig> => {
        const [name, tag] = ref.split(':');
        const [account_name, service_name] = name.split('/');
        const { data: service_digest } = await axios.get(`/accounts/${account_name}/services/${service_name}/versions/${tag}`, {
          baseURL: 'https://api.dev.architect.io/'
        });
        return ServiceBuilder.parseAndValidate(service_digest.config);
      },
      getRegistryImage: (ref: string) => `registry.dev.architect.io/${ref}`,
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

  it('should build from linked services', async () => {
    const linked_services = {
      'architect/division-service-grpc': path.join(__dirname, '../../../test/calculator/division-service/architect.json'),
      'architect/subtraction-service-rest': path.join(__dirname, '../../../test/calculator/subtraction-services/node/rest/architect.json'),
      'architect/addition-service-grpc': path.join(__dirname, '../../../test/calculator/addition-service/grpc/add.architect.json'),
    } as { [key: string]: string };

    const config_path = path.join(os.tmpdir(), 'linked-services-test-config.json');
    fs.writeFileSync(config_path, JSON.stringify({
      services: [{
        name: 'architect/division-service-grpc',
        ref: 'latest'
      }]
    }));

    const parsedSpec = await EnvironmentBuilder.loadFromFile(config_path);
    const graph = await EnvironmentGraph.build(parsedSpec, {
      getConfig: async (ref: string): Promise<BaseServiceConfig> => {
        const [name, tag] = ref.split(':');

        // Check if the service has been linked locally
        if (linked_services.hasOwnProperty(name)) {
          try {
            const config = await ServiceBuilder.loadFromFile(linked_services[name]);
            config.setDebugPath(linked_services[name]);
            return config;
          } catch (error) {
            console.log(error);
            throw error;
          }
        }

        // Go get the service config from the registry
        const [account_name, service_name] = name.split('/');
        const { data: service_digest } = await axios.get(`/accounts/${account_name}/services/${service_name}/versions/${tag}`, {
          baseURL: 'https://api.dev.architect.io/'
        });
        return ServiceBuilder.parseAndValidate(service_digest.config);
      },
      getRegistryImage: (ref: string) => `registry.dev.architect.io/${ref}`,
      getHostAssignment: async () => '127.0.0.1',
      getPortAssignment: async () => 8080,
    });

    const compose = generate(graph);
    expect(Object.keys(compose.services).length).to.equal(4);
    expect(compose.services).to.have.keys([
      'architect/addition-service-grpc.primary',
      'architect/addition-service-grpc:latest',
      'architect/subtraction-service-rest:latest',
      'architect/division-service-grpc:latest'
    ]);

    const subtraction_service = compose.services['architect/subtraction-service-rest:latest'];
    expect(subtraction_service).not.to.be.undefined;
    expect(subtraction_service.command).to.equal('npm run dev');
    expect(subtraction_service.build).not.to.be.undefined;
    expect(subtraction_service.build!.context).to.equal(path.dirname(linked_services['architect/subtraction-service-rest']));
    expect(subtraction_service.entrypoint).to.be.undefined;
    expect(subtraction_service.environment).to.have.keys([
      'DEFAULT_EXTERNAL_HOST',
      'DEFAULT_INTERNAL_HOST',
      'EXTERNAL_HOST',
      'INTERNAL_HOST',
      'DEFAULT_HOST',
      'HOST',
      'DEFAULT_EXTERNAL_PORT',
      'DEFAULT_INTERNAL_PORT',
      'EXTERNAL_PORT',
      'INTERNAL_PORT',
      'DEFAULT_PORT',
      'PORT',
      'ADDITION_SERVICE_ADDRESS'
    ]);

    const division_service = compose.services['architect/division-service-grpc:latest'];
    expect(division_service).not.to.be.undefined;
    expect(division_service.command).to.equal('npm run debug');
    expect(division_service.build).not.to.be.undefined;
    expect(division_service.build!.context).to.equal(path.dirname(linked_services['architect/division-service-grpc']));
    expect(division_service.entrypoint).to.be.undefined;
    expect(division_service.environment).to.have.keys([
      'DEFAULT_EXTERNAL_HOST',
      'DEFAULT_INTERNAL_HOST',
      'EXTERNAL_HOST',
      'INTERNAL_HOST',
      'DEFAULT_HOST',
      'HOST',
      'DEFAULT_EXTERNAL_PORT',
      'DEFAULT_INTERNAL_PORT',
      'EXTERNAL_PORT',
      'INTERNAL_PORT',
      'DEFAULT_PORT',
      'PORT',
      'SUBTRACTION_SERVICE_ADDRESS'
    ]);
    expect(division_service.environment!['SUBTRACTION_SERVICE_ADDRESS']).to.equal(
      `${subtraction_service.environment!['HOST']}:${subtraction_service.environment!['PORT']}`,
    );

    console.log(compose.services['architect/subtraction-service-rest:latest']);
  });
});
