import { expect } from 'chai';
import { ComponentSlugs, ComponentVersionSlugs, EnvironmentSlugs, InterfaceSlugs, ServiceSlugs, ServiceVersionSlugs } from '../../../src/dependency-manager/src/utils/slugs';

describe('slug validators', () => {

  const component_account_name = 'architect';
  const component_name = 'fusionauth';
  const service_name = 'api-db';
  const tag = '1.0.0';
  const environment_account_name = 'community';
  const environment_name = 'staging';

  const component_slug = `${component_account_name}/${component_name}`;
  const component_version_slug = `${component_account_name}/${component_name}:${tag}`;
  const service_slug = `${component_account_name}/${component_name}/${service_name}`;
  const service_version_slug = `${component_account_name}/${component_name}/${service_name}:${tag}`;
  const interface_slug = `${component_account_name}/${component_name}:${tag}-interfaces`;
  const environment_slug = `${environment_account_name}/${environment_name}`;

  const invalid_slug = 'double--dashes';
  const invalid_tag = '.1.0.0';

  const invalid_component_slug = `${invalid_slug}/${component_name}`;
  const invalid_component_version_slug = `${component_account_name}/${component_name}:${invalid_tag}`;
  const invalid_service_slug = `${component_account_name}/${component_name}/${invalid_slug}`;
  const invalid_service_version_slug = `${component_account_name}/${component_name}/${service_name}:${invalid_tag}`;
  const invalid_interface_slug = `${component_account_name}/${component_name}:${tag}-notinterfaces`;
  const invalid_environment_slug = `@${invalid_slug}/${environment_name}`;

  it(`ComponentSlugs.parse accurately splits ${component_slug}`, async () => {
    const result = ComponentSlugs.parse(component_slug);
    expect(result.kind).to.equal('component');
    expect(result.component_account_name).to.equal(component_account_name);
    expect(result.component_name).to.equal(component_name);
    expect(result.service_name).to.be.undefined;
    expect(result.environment_name).to.be.undefined;
    expect(result.environment_account_name).to.be.undefined;
    expect(result.tag).to.be.undefined;
  });

  it(`ComponentSlugs.parse throws exception on ${invalid_component_slug}`, async () => {
    expect(() => ComponentSlugs.parse(invalid_component_slug)).to.throw(`must be of the form <account-name>/<component-name>`);
  });

  it(`ComponentVersionSlugs.parse accurately splits ${component_version_slug}`, async () => {
    const result = ComponentVersionSlugs.parse(component_version_slug);
    expect(result.kind).to.equal('component_version');
    expect(result.component_account_name).to.equal(component_account_name);
    expect(result.component_name).to.equal(component_name);
    expect(result.service_name).to.be.undefined;
    expect(result.environment_name).to.be.undefined;
    expect(result.environment_account_name).to.be.undefined;
    expect(result.tag).to.equal(tag);
  });

  it(`ComponentVersionSlugs.parse throws exception on ${invalid_component_version_slug}`, async () => {
    expect(() => ComponentVersionSlugs.parse(invalid_component_version_slug)).to.throw(`must be of the form <account-name>/<component-name>:<tag>`);
  });

  it(`ServiceSlugs.parse accurately splits ${service_slug}`, async () => {
    const result = ServiceSlugs.parse(service_slug);
    expect(result.kind).to.equal('service');
    expect(result.component_account_name).to.equal(component_account_name);
    expect(result.component_name).to.equal(component_name);
    expect(result.service_name).to.equal(service_name);
    expect(result.environment_name).to.be.undefined;
    expect(result.environment_account_name).to.be.undefined;
    expect(result.tag).to.be.undefined;
  });

  it(`ServiceSlugs.parse throws exception on ${invalid_service_slug}`, async () => {
    expect(() => ServiceSlugs.parse(invalid_service_slug)).to.throw(`must be of the form <account-name>/<component-name>/<service-name>`);
  });

  it(`ServiceVersionSlugs.parse accurately splits ${service_version_slug}`, async () => {
    const result = ServiceVersionSlugs.parse(service_version_slug);
    expect(result.kind).to.equal('service_version');
    expect(result.component_account_name).to.equal(component_account_name);
    expect(result.component_name).to.equal(component_name);
    expect(result.service_name).to.equal(service_name);
    expect(result.environment_name).to.be.undefined;
    expect(result.environment_account_name).to.be.undefined;
    expect(result.tag).to.equal(tag);
  });

  it(`ServiceVersionSlugs.parse throws exception on ${invalid_service_version_slug}`, async () => {
    expect(() => ServiceVersionSlugs.parse(invalid_service_version_slug)).to.throw(`must be of the form <account-name>/<component-name>/<service-name>:<tag>`);
  });

  it(`EnvironmentSlugs.parse accurately splits ${environment_slug}`, async () => {
    const result = EnvironmentSlugs.parse(environment_slug);
    expect(result.kind).to.equal('environment');
    expect(result.component_account_name).to.be.undefined;
    expect(result.component_name).to.be.undefined;
    expect(result.service_name).to.be.undefined;
    expect(result.environment_name).to.equal(environment_name);
    expect(result.environment_account_name).to.equal(environment_account_name);
    expect(result.tag).to.be.undefined;
  });

  it(`EnvironmentSlugs.parse throws exception on ${invalid_environment_slug}`, async () => {
    expect(() => EnvironmentSlugs.parse(invalid_environment_slug)).to.throw(`must be of the form <account-name>/<environment-name>`);
  });

  it(`InterfaceSlugs.parse accurately splits ${interface_slug}`, async () => {
    const result = InterfaceSlugs.parse(interface_slug);
    expect(result.kind).to.equal('interfaces');
    expect(result.component_account_name).to.equal(component_account_name);
    expect(result.component_name).to.equal(component_name);
    expect(result.service_name).to.be.undefined;
    expect(result.environment_name).to.be.undefined;
    expect(result.environment_account_name).to.be.undefined;
    expect(result.tag).to.equal(tag);
  });

  it(`splitServiceInstanceSlug throws exception on ${invalid_interface_slug}`, async () => {
    expect(() => InterfaceSlugs.parse(invalid_interface_slug)).to.throw(`must be of the form <account-name>/<component-name>:<tag>-interfaces`);
  });
});
