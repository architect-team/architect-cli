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

      expect(ServiceConfigBuilder.buildFromJSON(serviceConfigWithNoPort).getPort()).undefined;
      expect(ServiceConfigBuilder.buildFromJSON(serviceConfigWithConfigPort).getPort()).eq(8081);
    });
  });
});
