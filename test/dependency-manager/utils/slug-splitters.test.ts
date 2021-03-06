import { expect } from 'chai';
import { ComponentSlugUtils, ComponentVersionSlugUtils, EnvironmentSlugUtils, InterfaceSlugUtils, ServiceSlugUtils, ServiceVersionSlugUtils } from '../../../src/dependency-manager/src/utils/slugs';

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

  it(`ComponentSlugUtils.parse accurately splits ${component_slug}`, async () => {
    const result = ComponentSlugUtils.parse(component_slug);
    expect(result.kind).to.equal('component');
    expect(result.component_account_name).to.equal(component_account_name);
    expect(result.component_name).to.equal(component_name);
    expect(result.service_name).to.be.undefined;
    expect(result.environment_name).to.be.undefined;
    expect(result.environment_account_name).to.be.undefined;
    expect(result.tag).to.be.undefined;
  });

  it(`ComponentSlugUtils.parse throws exception on ${invalid_component_slug}`, async () => {
    expect(() => ComponentSlugUtils.parse(invalid_component_slug)).to.throw(`must be of the form <account-name>/<component-name>`);
  });

  it(`ComponentVersionSlugUtils.parse accurately splits ${component_version_slug}`, async () => {
    const result = ComponentVersionSlugUtils.parse(component_version_slug);
    expect(result.kind).to.equal('component_version');
    expect(result.component_account_name).to.equal(component_account_name);
    expect(result.component_name).to.equal(component_name);
    expect(result.service_name).to.be.undefined;
    expect(result.environment_name).to.be.undefined;
    expect(result.environment_account_name).to.be.undefined;
    expect(result.tag).to.equal(tag);
  });

  it(`ComponentVersionSlugUtils.parse throws exception on ${invalid_component_version_slug}`, async () => {
    expect(() => ComponentVersionSlugUtils.parse(invalid_component_version_slug)).to.throw(`must be of the form <account-name>/<component-name>:<tag>`);
  });

  it(`ServiceSlugUtils.parse accurately splits ${service_slug}`, async () => {
    const result = ServiceSlugUtils.parse(service_slug);
    expect(result.kind).to.equal('service');
    expect(result.component_account_name).to.equal(component_account_name);
    expect(result.component_name).to.equal(component_name);
    expect(result.service_name).to.equal(service_name);
    expect(result.environment_name).to.be.undefined;
    expect(result.environment_account_name).to.be.undefined;
    expect(result.tag).to.be.undefined;
  });

  it(`ServiceSlugUtils.parse throws exception on ${invalid_service_slug}`, async () => {
    expect(() => ServiceSlugUtils.parse(invalid_service_slug)).to.throw(`must be of the form <account-name>/<component-name>/<service-name>`);
  });

  it(`ServiceVersionSlugUtils.parse accurately splits ${service_version_slug}`, async () => {
    const result = ServiceVersionSlugUtils.parse(service_version_slug);
    expect(result.kind).to.equal('service_version');
    expect(result.component_account_name).to.equal(component_account_name);
    expect(result.component_name).to.equal(component_name);
    expect(result.service_name).to.equal(service_name);
    expect(result.environment_name).to.be.undefined;
    expect(result.environment_account_name).to.be.undefined;
    expect(result.tag).to.equal(tag);
  });

  it(`ServiceVersionSlugUtils.parse throws exception on ${invalid_service_version_slug}`, async () => {
    expect(() => ServiceVersionSlugUtils.parse(invalid_service_version_slug)).to.throw(`must be of the form <account-name>/<component-name>/<service-name>:<tag>`);
  });

  it(`EnvironmentSlugUtils.parse accurately splits ${environment_slug}`, async () => {
    const result = EnvironmentSlugUtils.parse(environment_slug);
    expect(result.kind).to.equal('environment');
    expect(result.component_account_name).to.be.undefined;
    expect(result.component_name).to.be.undefined;
    expect(result.service_name).to.be.undefined;
    expect(result.environment_name).to.equal(environment_name);
    expect(result.environment_account_name).to.equal(environment_account_name);
    expect(result.tag).to.be.undefined;
  });

  it(`EnvironmentSlugUtils.parse throws exception on ${invalid_environment_slug}`, async () => {
    expect(() => EnvironmentSlugUtils.parse(invalid_environment_slug)).to.throw(`must be of the form <account-name>/<environment-name>`);
  });

  it(`InterfaceSlugUtils.parse accurately splits ${interface_slug}`, async () => {
    const result = InterfaceSlugUtils.parse(interface_slug);
    expect(result.kind).to.equal('interfaces');
    expect(result.component_account_name).to.equal(component_account_name);
    expect(result.component_name).to.equal(component_name);
    expect(result.service_name).to.be.undefined;
    expect(result.environment_name).to.be.undefined;
    expect(result.environment_account_name).to.be.undefined;
    expect(result.tag).to.equal(tag);
  });

  it(`splitServiceInstanceSlug throws exception on ${invalid_interface_slug}`, async () => {
    expect(() => InterfaceSlugUtils.parse(invalid_interface_slug)).to.throw(`must be of the form <account-name>/<component-name>:<tag>-interfaces`);
  });
});
