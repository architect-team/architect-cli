import { expect } from 'chai';
import { ComponentSlugUtils, ComponentVersionSlugUtils, EnvironmentSlugUtils, InterfaceSlugUtils, ResourceSlugUtils, ResourceVersionSlugUtils } from '../../../src/dependency-manager/src/utils/slugs';

describe('slug validators', () => {

  const component_account_name = 'architect';
  const component_name = 'fusionauth';
  const resource_name = 'api-db';
  const tag = '1.0.0';
  const environment_account_name = 'community';
  const environment_name = 'staging';

  const component_slug = `${component_account_name}/${component_name}`;
  const component_version_slug = `${component_account_name}/${component_name}:${tag}`;
  const resource_slug = `${component_account_name}/${component_name}/${resource_name}`;
  const resource_version_slug = `${component_account_name}/${component_name}/${resource_name}:${tag}`;
  const interface_slug = `${component_account_name}/${component_name}:${tag}-interfaces`;
  const environment_slug = `${environment_account_name}/${environment_name}`;

  const invalid_slug = 'double--dashes';
  const invalid_tag = '.1.0.0';

  const invalid_component_slug = `${invalid_slug}/${component_name}`;
  const invalid_component_version_slug = `${component_account_name}/${component_name}:${invalid_tag}`;
  const invalid_resource_slug = `${component_account_name}/${component_name}/${invalid_slug}`;
  const invalid_resource_version_slug = `${component_account_name}/${component_name}/${resource_name}:${invalid_tag}`;
  const invalid_interface_slug = `${component_account_name}/${component_name}:${tag}-notinterfaces`;
  const invalid_environment_slug = `@${invalid_slug}/${environment_name}`;

  it(`ComponentSlugUtils.parse accurately splits ${component_slug}`, async () => {
    const result = ComponentSlugUtils.parse(component_slug);
    expect(result.kind).to.equal('component');
    expect(result.component_account_name).to.equal(component_account_name);
    expect(result.component_name).to.equal(component_name);
    expect(result.resource_name).to.be.undefined;
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
    expect(result.resource_name).to.be.undefined;
    expect(result.environment_name).to.be.undefined;
    expect(result.environment_account_name).to.be.undefined;
    expect(result.tag).to.equal(tag);
  });

  it(`ComponentVersionSlugUtils.parse throws exception on ${invalid_component_version_slug}`, async () => {
    expect(() => ComponentVersionSlugUtils.parse(invalid_component_version_slug)).to.throw(`must be of the form <account-name>/<component-name>:<tag>`);
  });

  it(`ResourceSlugUtils.parse accurately splits ${resource_slug}`, async () => {
    const result = ResourceSlugUtils.parse(resource_slug);
    expect(result.kind).to.equal('resource');
    expect(result.component_account_name).to.equal(component_account_name);
    expect(result.component_name).to.equal(component_name);
    expect(result.resource_name).to.equal(resource_name);
    expect(result.environment_name).to.be.undefined;
    expect(result.environment_account_name).to.be.undefined;
    expect(result.tag).to.be.undefined;
  });

  it(`ResourceSlugUtils.parse throws exception on ${invalid_resource_slug}`, async () => {
    expect(() => ResourceSlugUtils.parse(invalid_resource_slug)).to.throw(`must be of the form <account-name>/<component-name>/<resource-name>`);
  });

  it(`ResourceVersionSlugUtils.parse accurately splits ${resource_version_slug}`, async () => {
    const result = ResourceVersionSlugUtils.parse(resource_version_slug);
    expect(result.kind).to.equal('resource_version');
    expect(result.component_account_name).to.equal(component_account_name);
    expect(result.component_name).to.equal(component_name);
    expect(result.resource_name).to.equal(resource_name);
    expect(result.environment_name).to.be.undefined;
    expect(result.environment_account_name).to.be.undefined;
    expect(result.tag).to.equal(tag);
  });

  it(`ResourceVersionSlugUtils.parse throws exception on ${invalid_resource_version_slug}`, async () => {
    expect(() => ResourceVersionSlugUtils.parse(invalid_resource_version_slug)).to.throw(`must be of the form <account-name>/<component-name>/<resource-name>:<tag>`);
  });

  it(`EnvironmentSlugUtils.parse accurately splits ${environment_slug}`, async () => {
    const result = EnvironmentSlugUtils.parse(environment_slug);
    expect(result.kind).to.equal('environment');
    expect(result.component_account_name).to.be.undefined;
    expect(result.component_name).to.be.undefined;
    expect(result.resource_name).to.be.undefined;
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
    expect(result.resource_name).to.be.undefined;
    expect(result.environment_name).to.be.undefined;
    expect(result.environment_account_name).to.be.undefined;
    expect(result.tag).to.equal(tag);
  });

  it(`InterfaceSlugUtils throws exception on ${invalid_interface_slug}`, async () => {
    expect(() => InterfaceSlugUtils.parse(invalid_interface_slug)).to.throw(`must be of the form <account-name>/<component-name>:<tag>-interfaces`);
  });
});
