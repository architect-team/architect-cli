import {expect} from '@oclif/test';
import path from 'path';
import sinon from 'sinon';
import moxios from 'moxios';
import EnvironmentCreate from '../../../src/commands/environments/create';

describe('environment:create', () => {
  beforeEach(function() {
    sinon.replace(EnvironmentCreate.prototype, 'log', sinon.stub());
    moxios.install();
  });

  afterEach(function() {
    moxios.uninstall();
    sinon.restore();
  });

  it ('creates a kubernetes environment', done => {
    const environment = {
      name: 'test',
      host: '0.0.0.0',
      namespace: 'test',
      service_token: 'test',
      cluster_ca_certificate: path.join(__dirname, 'create.test.ts')
    };

    moxios.stubRequest('/environments/', {
      status: 200,
      response: environment,
    });

    moxios.wait(function () {
      let request = moxios.requests.mostRecent();
      expect(request.url).to.match(/.*\/environments/);
      const data = JSON.parse(request.config.data);
      expect(data.name).to.equal(environment.name);
      expect(data.namespace).to.equal(environment.namespace);
      expect(data.host).to.equal(environment.host);
      expect(data.service_token).to.equal(environment.service_token);
      expect(data.cluster_ca_certificate).to.equal(environment.cluster_ca_certificate);
      expect(data.type).to.equal('kubernetes');
      done();
    });

    EnvironmentCreate.run([
      environment.name,
      '--host', environment.host,
      '--namespace', environment.namespace,
      '--service_token', environment.service_token,
      '--cluster_ca_certificate', environment.cluster_ca_certificate
    ]);
  });
})
