import { expect } from 'chai';
import { Refs } from '../../../src/dependency-manager/src/utils/refs';

describe('Refs url_safe_ref', () => {

  const component_account_name = 'architect';
  const component_name = 'fusionauth';
  const service_name = 'api-db';

  const environment_account_name = 'community';
  const environment_name = 'staging';

  const tag = '1.0.0';
  const transformed_tag = '1-0-0';

  it(`Refs.url_safe_ref works for component_slug`, async () => {
    const component_slug = `${component_account_name}/${component_name}`;
    const expected_slug = `${component_account_name}-${component_name}-mrxakjz5`;

    const url_safe_ref = Refs.url_safe_ref(component_slug);
    expect(url_safe_ref).to.equal(expected_slug);
  });

  it(`Refs.url_safe_ref works for component_version_slug`, async () => {
    const component_version_slug = `${component_account_name}/${component_name}:${tag}`;
    const expected_slug = `${component_account_name}-${component_name}-${transformed_tag}-efhzx9mt`;

    const url_safe_ref = Refs.url_safe_ref(component_version_slug);
    expect(url_safe_ref).to.equal(expected_slug);
  });

  it(`Refs.url_safe_ref works for service_slug`, async () => {
    const service_slug = `${component_account_name}/${component_name}/${service_name}`;
    const expected_slug = `${component_account_name}-${component_name}-${service_name}-k3l7sgnt`;

    const url_safe_ref = Refs.url_safe_ref(service_slug);
    expect(url_safe_ref).to.equal(expected_slug);
  });

  it(`Refs.url_safe_ref works for service_version_slug`, async () => {
    const service_version_slug = `${component_account_name}/${component_name}/${service_name}:${tag}`;
    const expected_slug = `${component_account_name}-${component_name}-${service_name}-${transformed_tag}-uwr37fwm`;

    const url_safe_ref = Refs.url_safe_ref(service_version_slug);
    expect(url_safe_ref).to.equal(expected_slug);
  });

  it(`Refs.url_safe_ref works for environment_slug`, async () => {
    const environment_slug = `${environment_account_name}/${environment_name}`;
    const expected_slug = `${environment_account_name}-${environment_name}-7qwg4isp`;

    const url_safe_ref = Refs.url_safe_ref(environment_slug);
    expect(url_safe_ref).to.equal(expected_slug);
  });

  it(`Refs.url_safe_ref works for interface_slug`, async () => {
    const interface_slug = `${component_account_name}/${component_name}:${tag}-interfaces`;
    const expected_slug = `${component_account_name}-${component_name}-${transformed_tag}-interfaces-8jkiajzf`;

    const url_safe_ref = Refs.url_safe_ref(interface_slug);
    expect(url_safe_ref).to.equal(expected_slug);
  });

  it(`Refs.url_safe_ref cuts account string to 63 chars`, async () => {
    const slug = `this-is-an-account-name-that-has-more-than-63-chars-it-should-get-lopped-off`;
    const abridged_slug = `this-is-an-account-name-that-has-more-than-63-chars-it-9xd8vqs2`;

    const url_safe_ref = Refs.url_safe_ref(slug);
    expect(url_safe_ref).to.equal(abridged_slug);
    expect(url_safe_ref.length).to.be.eq(63);
  });

  it(`Refs.url_safe_ref cuts component string to 63 chars`, async () => {
    const component_slug = `this-is-a/component-name-that-has-more-than-63-chars-it-should-get-lopped-off`;
    const abridged_slug = `this-is-a-component-name-that-has-more-than-63-chars-i-62o43gic`;

    const url_safe_ref = Refs.url_safe_ref(component_slug);
    expect(url_safe_ref).to.equal(abridged_slug);
    expect(url_safe_ref.length).to.be.eq(63);
  });

  it(`Refs.url_safe_ref cuts component-version string to 63 chars`, async () => {
    const component_version_slug = `this-is-a/component-name-that-has-more-than-63-chars-it:should-get-lopped-off`;
    const abridged_slug = `this-is-a-component-name-that-has-more-than-63-chars-i-dmikixq7`;

    const url_safe_ref = Refs.url_safe_ref(component_version_slug);
    expect(url_safe_ref).to.equal(abridged_slug);
    expect(url_safe_ref.length).to.be.lessThan(64);
  });

  it(`Refs.url_safe_ref cuts service string to 63 chars`, async () => {
    const service_slug = `this-is-a/component-name-that-has-more/than-63-chars-it-should-get-lopped-off`;
    const abridged_slug = `this-is-a-component-name-that-has-more-than-63-chars-i-epllln75`;

    const url_safe_ref = Refs.url_safe_ref(service_slug);
    expect(url_safe_ref).to.equal(abridged_slug);
    expect(url_safe_ref.length).to.be.lessThan(64);
  });

  it(`Refs.url_safe_ref cuts service-version string to 63 chars`, async () => {
    const service_version_slug = `this-is-a/component-name-that-has-more/than-63-chars-it:should-get-lopped-off`;
    const abridged_slug = `this-is-a-component-name-that-has-more-than-63-chars-i-vwfgu54y`;

    const url_safe_ref = Refs.url_safe_ref(service_version_slug);
    expect(url_safe_ref).to.equal(abridged_slug);
    expect(url_safe_ref.length).to.be.lessThan(64);
  });

  it(`Refs.url_safe_ref with max_length of 63 cuts component string to 63 chars`, async () => {
    const component_slug = `test-user22-a0/dashboard-user/dashboard-user:latest`;
    const abridged_slug = `test-user22-a0-dashboard-user-dashboard-user-latest-rocdog0g`;

    const url_safe_ref = Refs.url_safe_ref(component_slug);
    expect(url_safe_ref).to.equal(abridged_slug);
    expect(url_safe_ref.length).to.be.lessThan(64);
  });

  it(`Refs.url_safe_ref with max_length of 31 cuts environment string to 31 chars`, async () => {
    const environment_slug = `this-is-a-long-environment-name-that-should-get-cut`;
    const abridged_slug = `this-is-a-long-environ-bcpqo07j`;

    const url_safe_ref = Refs.url_safe_ref(environment_slug, 31);
    expect(url_safe_ref).to.equal(abridged_slug);
    expect(url_safe_ref.length).to.be.eq(31);
  });

  it(`Refs.url_safe_ref with max_length of 31 cuts component string to 31 chars`, async () => {
    const component_slug = `this-is-a/component-name-that-has-more-than-63-chars-it-should-get-lopped-off`;
    const abridged_slug = `this-is-a-component-na-62o43gic`;

    const url_safe_ref = Refs.url_safe_ref(component_slug, 31);
    expect(url_safe_ref).to.equal(abridged_slug);
    expect(url_safe_ref.length).to.be.eq(31);
  });

  it(`Refs.url_safe_ref with max_length of 31 cuts component string to 31 chars with seed`, async () => {
    const service_name = `frontend-boutique-shop`
    const service_ref = `example/boutique-shop/frontend:latest`;
    const abridged_slug = `frontend-boutique-shop-w1slfipr`;

    const url_safe_ref = Refs.url_safe_ref(service_name, service_ref, 31);
    expect(url_safe_ref).to.equal(abridged_slug);
    expect(Refs.url_safe_ref(service_name, 31)).to.equal(Refs.url_safe_ref(service_name, service_name, 31));
    expect(url_safe_ref).to.not.equal(Refs.url_safe_ref(service_name, 31));
    expect(url_safe_ref.length).to.be.eq(31);
  });
});
