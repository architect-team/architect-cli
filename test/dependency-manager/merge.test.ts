import { expect } from '@oclif/test';
import { ServiceConfigBuilder } from '../../src/dependency-manager/src';

describe('service config merge', function () {

  describe('buildFromJSON', function () {
    it('port is parsed into the config', function () {
      const service_config_json = {
        "name": "foo/service",
        "description": "a test service",
        "dependencies": {
          "no_override": "old",
          "override": "old"
        },
        "parameters": {
          "simple": { "default": "old" },
          "override": { "default": "old" },
          "valueFrom": { "default": { "valueFrom": { "dependency": "override", "value": "old" } } },
          "overrideValueFrom": { "default": { "valueFrom": { "dependency": "override", "value": "old" } } },
        },
        "datastores": {

        },
        "api": {
          "type": "grpc",
          "definitions": []
        },
        "subscriptions": {},
        "keywords": [],
      };

      const env_config_json = {
        "name": "foo/service",
        "description": "a test service",
        "dependencies": {
          "override": "new"
        },
        "parameters": {
          "override": "new",
          "overrideValueFrom": "new"
        },
        "datastores": {},
        "api": {
          "type": "grpc",
          "definitions": []
        },
        "subscriptions": {},
        "keywords": [],
      };

      const service_config = ServiceConfigBuilder.buildFromJSON(service_config_json);
      const env_config = ServiceConfigBuilder.buildFromJSON(env_config_json);

      const node_config = service_config.merge(env_config);

      expect(node_config.getName()).eq('foo/service');

      expect(node_config.getDependencies()).keys('override', 'no_override');
      expect(node_config.getDependencies()['override']).eq('new');
      expect(node_config.getDependencies()['no_override']).eq('old');

      expect(node_config.getParameters()).keys('override', 'simple', 'overrideValueFrom', 'valueFrom');
      expect(node_config.getParameters()['override'].default).eq('new');
      expect(node_config.getParameters()['overrideValueFrom'].default).eq('new');
      expect(node_config.getParameters()['simple'].default).eq('old');
      expect(node_config.getParameters()['valueFrom'].default!.toString()).eq({ "valueFrom": { "dependency": "override", "value": "old" } }.toString());

    });
  });
});
