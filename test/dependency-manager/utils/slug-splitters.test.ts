import { expect } from 'chai';
import { Slugs } from '../../../src/dependency-manager/src/utils/slugs';

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
  const service_instance_slug = `${component_account_name}/${component_name}/${service_name}:${tag}@${environment_account_name}/${environment_name}`;
  const environment_slug = `@${environment_account_name}/${environment_name}`;

  const invalid_slug = 'double--dashes';
  const invalid_tag = '.1.0.0';

  const invalid_component_slug = `${invalid_slug}/${component_name}`;
  const invalid_component_version_slug = `${component_account_name}/${component_name}:${invalid_tag}`;
  const invalid_service_slug = `${component_account_name}/${component_name}/${invalid_slug}`;
  const invalid_service_version_slug = `${component_account_name}/${component_name}/${service_name}:${invalid_tag}`;
  const invalid_service_instance_slug = `${component_account_name}/${component_name}/${service_name}:${tag}@${invalid_slug}/${environment_name}`;
  const invalid_environment_slug = `@${invalid_slug}/${environment_name}`;

  it(`splitComponentSlug accurately splits ${component_slug}`, async () => {
    const result = Slugs.splitComponentSlug(component_slug);
    expect(result.kind).to.equal('component');
    expect(result.component_account_name).to.equal(component_account_name);
    expect(result.component_name).to.equal(component_name);
    expect(result.service_name).to.be.undefined;
    expect(result.environment_name).to.be.undefined;
    expect(result.environment_account_name).to.be.undefined;
    expect(result.tag).to.be.undefined;
  });

  it(`splitComponentSlug throws exception on ${invalid_component_slug}`, async () => {
    expect(() => Slugs.splitComponentSlug(invalid_component_slug)).to.throw(`must be of the form account-name/component-name`);
  });

  it(`splitComponentVersionSlug accurately splits ${component_version_slug}`, async () => {
    const result = Slugs.splitComponentVersionSlug(component_version_slug);
    expect(result.kind).to.equal('component_version');
    expect(result.component_account_name).to.equal(component_account_name);
    expect(result.component_name).to.equal(component_name);
    expect(result.service_name).to.be.undefined;
    expect(result.environment_name).to.be.undefined;
    expect(result.environment_account_name).to.be.undefined;
    expect(result.tag).to.equal(tag);
  });

  it(`splitComponentVersionSlug throws exception on ${invalid_component_version_slug}`, async () => {
    expect(() => Slugs.splitComponentVersionSlug(invalid_component_version_slug)).to.throw(`must be of the form account-name/component-name:tag`);
  });

  it(`splitServiceSlug accurately splits ${service_slug}`, async () => {
    const result = Slugs.splitServiceSlug(service_slug);
    expect(result.kind).to.equal('service');
    expect(result.component_account_name).to.equal(component_account_name);
    expect(result.component_name).to.equal(component_name);
    expect(result.service_name).to.equal(service_name);
    expect(result.environment_name).to.be.undefined;
    expect(result.environment_account_name).to.be.undefined;
    expect(result.tag).to.be.undefined;
  });

  it(`splitServiceSlug throws exception on ${invalid_service_slug}`, async () => {
    expect(() => Slugs.splitServiceSlug(invalid_service_slug)).to.throw(`must be of the form account-name/component-name/service-name`);
  });

  it(`splitServiceVersionSlug accurately splits ${service_version_slug}`, async () => {
    const result = Slugs.splitServiceVersionSlug(service_version_slug);
    expect(result.kind).to.equal('service_version');
    expect(result.component_account_name).to.equal(component_account_name);
    expect(result.component_name).to.equal(component_name);
    expect(result.service_name).to.equal(service_name);
    expect(result.environment_name).to.be.undefined;
    expect(result.environment_account_name).to.be.undefined;
    expect(result.tag).to.equal(tag);
  });

  it(`splitServiceVersionSlug throws exception on ${invalid_service_version_slug}`, async () => {
    expect(() => Slugs.splitServiceVersionSlug(invalid_service_version_slug)).to.throw(`must be of the form account-name/component-name/service-name:tag`);
  });

  it(`splitEnvironmentSlug accurately splits ${environment_slug}`, async () => {
    const result = Slugs.splitEnvironmentSlug(environment_slug);
    expect(result.kind).to.equal('environment');
    expect(result.component_account_name).to.be.undefined;
    expect(result.component_name).to.be.undefined;
    expect(result.service_name).to.be.undefined;
    expect(result.environment_name).to.equal(environment_name);
    expect(result.environment_account_name).to.equal(environment_account_name);
    expect(result.tag).to.be.undefined;
  });

  it(`splitEnvironmentSlug throws exception on ${invalid_environment_slug}`, async () => {
    expect(() => Slugs.splitEnvironmentSlug(invalid_environment_slug)).to.throw(`must be of the form @environment-account-name/environment-name`);
  });

  it(`splitServiceInstanceSlug accurately splits ${service_instance_slug}`, async () => {
    const result = Slugs.splitServiceInstanceSlug(service_instance_slug);
    expect(result.kind).to.equal('service_instance');
    expect(result.component_account_name).to.equal(component_account_name);
    expect(result.component_name).to.equal(component_name);
    expect(result.service_name).to.equal(service_name);
    expect(result.environment_name).to.equal(environment_name);
    expect(result.environment_account_name).to.equal(environment_account_name);
    expect(result.tag).to.equal(tag);
  });

  it(`splitServiceInstanceSlug throws exception on ${invalid_service_instance_slug}`, async () => {
    expect(() => Slugs.splitServiceInstanceSlug(invalid_service_instance_slug)).to.throw(`must be of the form account-name/component-name/service-name:tag@environment-account-name/environment-name`);
  });
});
