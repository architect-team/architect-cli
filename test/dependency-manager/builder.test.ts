import { expect } from '@oclif/test';
import { ServiceConfigBuilder } from '../../src/dependency-manager/src';

describe('service config builder', function () {

  describe('buildFromJSON', function () {
    it('port is parsed into the config', function () {
      const serviceConfigWithNoPort = {
        "name": "foo/service",
        "description": "a test service",
        "dependencies": {},
        "parameters": {},
        "datastores": {},
        "api": {
          "type": "grpc",
          "definitions": []
        },
        "subscriptions": {},
        "keywords": [],
      };
      const serviceConfigWithConfigPort = { ...serviceConfigWithNoPort, port: '8081' };

      const configWithNoPort = ServiceConfigBuilder.buildFromJSON(serviceConfigWithNoPort);
      const configWithPort = ServiceConfigBuilder.buildFromJSON(serviceConfigWithConfigPort);
      expect(configWithNoPort.getPort()).undefined;
      expect(configWithPort.getPort()).eq(8081);
    });
  });
});
