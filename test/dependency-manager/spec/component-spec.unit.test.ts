import { expect } from 'chai';
import { classToPlain, plainToClass } from 'class-transformer';
import yaml from 'js-yaml';
import { buildConfigFromYml, buildSpecFromYml, ComponentSpec, dumpToYml } from '../../../src';
import { overrideSpec } from '../../../src/dependency-manager/spec/utils/spec-merge';
import { loadAllTestSpecCombinations } from './partials/spec-test-harness';

describe('component spec unit test', () => {
  const all_spec_combinations = loadAllTestSpecCombinations();

  it(`recursively test partial architect components`, () => {
    console.debug(`recursively testing ${all_spec_combinations.length} combined components...`);
    for (const component of all_spec_combinations) {
      const source_yml = dumpToYml(component);
      buildConfigFromYml(source_yml);
    }
  }).timeout(20000);

  it('component spec overrides', () => {
    const yml = `
    name: test/component
    secrets:
      test1: test1
      test2:
        required: true
        default: test2
    services:
      app:
        environment:
          NODE_ENV: development
        replicas: 1
        interfaces:
          main: 8080
          admin:
            port: 8081
        volumes:
          src: ./src
          tmp:
            mount_path: ./tmp
    interfaces:
      app: \${{ services.app.interfaces.main.url }}
      admin:
        url: \${{ services.app.interfaces.admin.url }}
    `
    const override_yml = `
    secrets:
      test1:
        required: false
      test2:
        required: false
    services:
      app:
        environment:
          NODE_ENV: production
        replicas: 3
        interfaces:
          main:
            host: app.aws.com
          admin:
            host: admin.aws.com
        volumes:
          src:
            host_path: ./src
          tmp:
            host_path: ./tmp
    interfaces:
      app:
        ingress:
          subdomain: cloud
      admin:
        ingress:
          subdomain: staff
    `

    const component_spec = buildSpecFromYml(yml);
    const override_spec = plainToClass(ComponentSpec, yaml.load(override_yml));
    const merged_spec = overrideSpec(component_spec, override_spec);
    expect(classToPlain(merged_spec)).to.deep.equal(yaml.load(`
    name: test/component
    secrets:
      test1:
        required: false
        default: test1
      test2:
        required: false
        default: test2
    services:
      app:
        environment:
          NODE_ENV: production
        replicas: 3
        interfaces:
          main:
            host: app.aws.com
            port: 8080
          admin:
            host: admin.aws.com
            port: 8081
        volumes:
          src:
            host_path: ./src
            mount_path: ./src
          tmp:
            host_path: ./tmp
            mount_path: ./tmp
    interfaces:
      app:
        url: \${{ services.app.interfaces.main.url }}
        ingress:
          subdomain: cloud
      admin:
        url: \${{ services.app.interfaces.admin.url }}
        ingress:
          subdomain: staff
    `))
  })
});
