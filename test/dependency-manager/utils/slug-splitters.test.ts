import { expect } from 'chai';
import { ComponentSlugUtils, ComponentVersionSlugUtils, ResourceSlugUtils } from '../../../src/';

describe('slug validators with account', () => {

  const component_account_name = 'architect';
  const component_name = 'fusionauth';
  const resource_name = 'api-db';
  const tag = '1.0.0';

  const component_slug = `${component_account_name}/${component_name}`;
  const component_version_slug = `${component_account_name}/${component_name}:${tag}`;
  const resource_slug = `${component_account_name}/${component_name}.services.${resource_name}`;

  const invalid_slug = 'double--dashes';
  const invalid_tag = '.1.0.0';

  const invalid_component_slug = `${invalid_slug}/${component_name}`;
  const invalid_component_version_slug = `${component_account_name}/${component_name}:${invalid_tag}`;
  const invalid_resource_slug = `${component_account_name}/${component_name}.services.${invalid_slug}`;

  it(`ComponentSlugUtils.parse accurately splits ${component_slug}`, async () => {
    const result = ComponentSlugUtils.parse(component_slug);
    expect(result.component_name).to.equal(component_name);
  });

  it(`ComponentSlugUtils.parse throws exception on ${invalid_component_slug}`, async () => {
    expect(() => ComponentSlugUtils.parse(invalid_component_slug)).to.throw(ComponentSlugUtils.Description);
  });

  it(`ComponentVersionSlugUtils.parse accurately splits ${component_version_slug}`, async () => {
    const result = ComponentVersionSlugUtils.parse(component_version_slug);
    expect(result.component_name).to.equal(component_name);
    expect(result.tag).to.equal(tag);
  });

  it(`ComponentVersionSlugUtils.parse throws exception on ${invalid_component_version_slug}`, async () => {
    expect(() => ComponentVersionSlugUtils.parse(invalid_component_version_slug)).to.throw(ComponentVersionSlugUtils.Description);
  });

  it(`ResourceSlugUtils.parse accurately splits ${resource_slug}`, async () => {
    const result = ResourceSlugUtils.parse(resource_slug);
    expect(result.component_name).to.equal(component_name);
  });

  it(`ResourceSlugUtils.parse throws exception on ${invalid_resource_slug}`, async () => {
    expect(() => ResourceSlugUtils.parse(invalid_resource_slug)).to.throw(ResourceSlugUtils.Description);
  });
});

describe('slug validators without account', () => {

  const component_name = 'fusionauth';
  const resource_name = 'api-db';
  const tag = '1.0.0';

  const component_slug = `${component_name}`;
  const component_version_slug = `${component_name}:${tag}`;
  const resource_slug = `${component_name}.services.${resource_name}`;

  const invalid_slug = 'double--dashes';
  const invalid_tag = '.1.0.0';

  const invalid_component_slug = `${invalid_slug}/${component_name}`;
  const invalid_component_version_slug = `${component_name}:${invalid_tag}`;
  const invalid_resource_slug = `${component_name}.services.${invalid_slug}`;

  it(`ComponentSlugUtils.parse accurately splits ${component_slug}`, async () => {
    const result = ComponentSlugUtils.parse(component_slug);
    expect(result.component_name).to.equal(component_name);

    const build = ComponentSlugUtils.build.apply(null, Object.values(result) as any)
    expect(build).to.equal(component_slug);
  });

  it(`ComponentSlugUtils.parse throws exception on ${invalid_component_slug}`, async () => {
    expect(() => ComponentSlugUtils.parse(invalid_component_slug)).to.throw(ComponentSlugUtils.Description);
  });

  it(`ComponentVersionSlugUtils.parse accurately splits ${component_slug}`, async () => {
    const result = ComponentVersionSlugUtils.parse(component_slug);
    expect(result.component_name).to.equal(component_name);
    expect(result.tag).to.equal('latest');

    const build = ComponentVersionSlugUtils.build.apply(null, Object.values(result) as any)
    expect(build).to.equal(`${component_slug}:latest`);
  });

  it(`ComponentVersionSlugUtils.parse accurately splits ${component_version_slug}`, async () => {
    const result = ComponentVersionSlugUtils.parse(component_version_slug);
    expect(result.component_name).to.equal(component_name);
    expect(result.tag).to.equal(tag);

    const build = ComponentVersionSlugUtils.build.apply(null, Object.values(result) as any)
    expect(build).to.equal(component_version_slug);
  });

  it(`ComponentVersionSlugUtils.parse throws exception on ${invalid_component_version_slug}`, async () => {
    expect(() => ComponentVersionSlugUtils.parse(invalid_component_version_slug)).to.throw(ComponentVersionSlugUtils.Description);
  });

  it(`ResourceSlugUtils.parse accurately splits ${resource_slug}`, async () => {
    const result = ResourceSlugUtils.parse(resource_slug);
    expect(result.component_name).to.equal(component_name);
    expect(result.resource_type).to.equal('services');
    expect(result.resource_name).to.equal(resource_name);

    const build = ResourceSlugUtils.build.apply(null, Object.values(result) as any)
    expect(build).to.equal(resource_slug);
  });

  it(`ResourceSlugUtils.parse throws exception on ${invalid_resource_slug}`, async () => {
    expect(() => ResourceSlugUtils.parse(invalid_resource_slug)).to.throw(ResourceSlugUtils.Description);
  });
});
