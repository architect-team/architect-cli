import { expect } from 'chai';
import { Refs } from '../../../src/dependency-manager/utils/refs';

describe('Refs.safeRef', () => {

  const component_account_name = 'architect';
  const component_name = 'fusionauth';
  const service_name = 'api-db';

  const environment_account_name = 'community';
  const environment_name = 'staging';

  const tag = '1.0.0';
  const transformed_tag = '1-0-0';

  it(`Refs.safeRef works for component_slug`, async () => {
    const component_slug = `${component_account_name}/${component_name}`;
    const expected_slug = `${component_account_name}-${component_name}-mrxakjz5`;

    const safe_ref = Refs.safeRef(component_slug);
    expect(safe_ref).to.equal(expected_slug);
  });

  it(`Refs.safeRef works for component_version_slug`, async () => {
    const component_version_slug = `${component_account_name}/${component_name}:${tag}`;
    const expected_slug = `${component_account_name}-${component_name}-${transformed_tag}-efhzx9mt`;

    const safe_ref = Refs.safeRef(component_version_slug);
    expect(safe_ref).to.equal(expected_slug);
  });

  it(`Refs.safeRef works for service_slug`, async () => {
    const service_slug = `${component_account_name}/${component_name}/${service_name}`;
    const expected_slug = `${component_account_name}-${component_name}-${service_name}-k3l7sgnt`;

    const safe_ref = Refs.safeRef(service_slug);
    expect(safe_ref).to.equal(expected_slug);
  });

  it(`Refs.safeRef works for service_version_slug`, async () => {
    const service_version_slug = `${component_account_name}/${component_name}/${service_name}:${tag}`;
    const expected_slug = `${component_account_name}-${component_name}-${service_name}-${transformed_tag}-uwr37fwm`;

    const safe_ref = Refs.safeRef(service_version_slug);
    expect(safe_ref).to.equal(expected_slug);
  });

  it(`Refs.safeRef works for environment_slug`, async () => {
    const environment_slug = `${environment_account_name}/${environment_name}`;
    const expected_slug = `${environment_account_name}-${environment_name}-7qwg4isp`;

    const safe_ref = Refs.safeRef(environment_slug);
    expect(safe_ref).to.equal(expected_slug);
  });

  it(`Refs.safeRef cuts account string to 63 chars`, async () => {
    const slug = `this-is-an-account-name-that-has-more-than-63-chars-it-should-get-lopped-off`;
    const abridged_slug = `this-is-an-account-name-that-has-more-than-63-chars-it-9xd8vqs2`;

    const safe_ref = Refs.safeRef(slug);
    expect(safe_ref).to.equal(abridged_slug);
    expect(safe_ref.length).to.be.eq(63);
  });

  it(`Refs.safeRef cuts component string to 63 chars`, async () => {
    const component_slug = `this-is-a/component-name-that-has-more-than-63-chars-it-should-get-lopped-off`;
    const abridged_slug = `this-is-a-component-name-that-has-more-than-63-chars-i-62o43gic`;

    const safe_ref = Refs.safeRef(component_slug);
    expect(safe_ref).to.equal(abridged_slug);
    expect(safe_ref.length).to.be.eq(63);
  });

  it(`Refs.safeRef cuts component-version string to 63 chars`, async () => {
    const component_version_slug = `this-is-a/component-name-that-has-more-than-63-chars-it:should-get-lopped-off`;
    const abridged_slug = `this-is-a-component-name-that-has-more-than-63-chars-i-dmikixq7`;

    const safe_ref = Refs.safeRef(component_version_slug);
    expect(safe_ref).to.equal(abridged_slug);
    expect(safe_ref.length).to.be.lessThan(64);
  });

  it(`Refs.safeRef cuts service string to 63 chars`, async () => {
    const service_slug = `this-is-a/component-name-that-has-more/than-63-chars-it-should-get-lopped-off`;
    const abridged_slug = `this-is-a-component-name-that-has-more-than-63-chars-i-epllln75`;

    const safe_ref = Refs.safeRef(service_slug);
    expect(safe_ref).to.equal(abridged_slug);
    expect(safe_ref.length).to.be.lessThan(64);
  });

  it(`Refs.safeRef cuts service-version string to 63 chars`, async () => {
    const service_version_slug = `this-is-a/component-name-that-has-more/than-63-chars-it:should-get-lopped-off`;
    const abridged_slug = `this-is-a-component-name-that-has-more-than-63-chars-i-vwfgu54y`;

    const safe_ref = Refs.safeRef(service_version_slug);
    expect(safe_ref).to.equal(abridged_slug);
    expect(safe_ref.length).to.be.lessThan(64);
  });

  it(`Refs.safeRef with max_length of 63 cuts component string to 63 chars`, async () => {
    const component_slug = `test-user22-a0/dashboard-user/dashboard-user:latest`;
    const abridged_slug = `test-user22-a0-dashboard-user-dashboard-user-latest-rocdog0g`;

    const safe_ref = Refs.safeRef(component_slug);
    expect(safe_ref).to.equal(abridged_slug);
    expect(safe_ref.length).to.be.lessThan(64);
  });

  it(`Refs.safeRef with max_length of 31 cuts environment string to 31 chars`, async () => {
    const environment_slug = `this-is-a-long-environment-name-that-should-get-cut`;
    const abridged_slug = `this-is-a-long-environ-bcpqo07j`;

    const safe_ref = Refs.safeRef(environment_slug, 31);
    expect(safe_ref).to.equal(abridged_slug);
    expect(safe_ref.length).to.be.eq(31);
  });

  it(`Refs.safeRef with max_length of 31 cuts component string to 31 chars`, async () => {
    const component_slug = `this-is-a/component-name-that-has-more-than-63-chars-it-should-get-lopped-off`;
    const abridged_slug = `this-is-a-component-na-62o43gic`;

    const safe_ref = Refs.safeRef(component_slug, 31);
    expect(safe_ref).to.equal(abridged_slug);
    expect(safe_ref.length).to.be.eq(31);
  });

  it(`Refs.safeRef with max_length of 31 cuts component string to 31 chars with seed`, async () => {
    const service_name = `boutique-shop-frontend`
    const service_ref = `example/boutique-shop/frontend`;
    const abridged_slug = `boutique-shop-frontend-mwwd9bxo`;

    const safe_ref = Refs.safeRef(service_name, service_ref, 31);
    expect(safe_ref).to.equal(abridged_slug);
    expect(Refs.safeRef(service_name, 31)).to.equal(Refs.safeRef(service_name, service_name, 31));
    expect(safe_ref).to.not.equal(Refs.safeRef(service_name, 31));
    expect(safe_ref.length).to.be.eq(31);
  });

  it(`Refs.trimSafeRef check hash stays the same`, async () => {
    const service_name = `boutique-shop-frontend`
    const service_ref = `example/boutique-shop/frontend`;

    const safe_ref = Refs.safeRef(service_name, service_ref);
    const safe_hash = safe_ref.split('-').pop();

    const trim_length = 14;
    const trim_ref = Refs.trimSafeRef(safe_ref, trim_length);
    const trim_hash = trim_ref.split('-').pop();
    expect(safe_hash).to.equal(trim_hash);
    expect(trim_ref).lengthOf(trim_length);
  });

  it(`Refs.trimSafeRef check hash stays the same with prefix`, async () => {
    const service_name = `boutique-shop-frontend`
    const service_ref = `example/boutique-shop/frontend`;

    const safe_ref = Refs.safeRef(service_name, service_ref);
    const safe_hash = safe_ref.split('-').pop();

    const trim_length = 32;
    const trim_prefix = 'arc-';
    const trim_ref = Refs.trimSafeRef(safe_ref, trim_length, trim_prefix);
    const trim_hash = trim_ref.split('-').pop();
    expect(safe_hash).to.equal(trim_hash);
    expect(trim_ref).lengthOf(trim_length);
    expect(trim_ref.startsWith(trim_prefix)).to.be.true;
  });

  it(`Refs.trimSafeRef nothing changes if length is larger`, async () => {
    const service_name = `boutique-shop-frontend`
    const service_ref = `example/boutique-shop/frontend`;

    const safe_ref = Refs.safeRef(service_name, service_ref);
    const safe_hash = safe_ref.split('-').pop();

    const trim_length = 64;
    const trim_ref = Refs.trimSafeRef(safe_ref, trim_length);
    const trim_hash = trim_ref.split('-').pop();
    expect(safe_hash).to.equal(trim_hash);
    expect(trim_ref).to.equal(safe_ref);
  });

  it(`Refs.trimSafeRef suffix`, async () => {
    const service_name = `boutique-shop-frontend`
    const service_ref = `example/boutique-shop/frontend`;

    const safe_ref = Refs.safeRef(service_name, service_ref);
    const safe_hash = safe_ref.split('-').pop();

    const trim_length = 58;
    const trim_ref = Refs.trimSafeRef(safe_ref, trim_length, '', '-main');
    const trim_hash = trim_ref.split('-').pop();
    expect(safe_hash).to.equal(trim_hash);
    expect(trim_ref).to.not.equal(safe_ref);
    expect(trim_ref.length).to.be.lessThan(trim_length);
    expect(trim_ref).to.equal('boutique-shop-frontend-main-mwwd9bxo');
  });

  it(`Refs.trimSafeRef suffix shorten`, async () => {
    const service_name = `boutique-shop-frontend`
    const service_ref = `example/boutique-shop/frontend`;

    const safe_ref = Refs.safeRef(service_name, service_ref);
    const safe_hash = safe_ref.split('-').pop();

    const suffix = '-main';
    const trim_length = 32;
    const trim_ref = Refs.trimSafeRef(safe_ref, trim_length, '', suffix);
    const trim_hash = trim_ref.split('-').pop();
    expect(safe_hash).to.equal(trim_hash);
    expect(trim_ref).to.not.equal(safe_ref);
    expect(trim_ref.length).to.be.equal(trim_length);
    expect(trim_ref).to.equal(`boutique-shop-fron${suffix}-mwwd9bxo`);
  });
});
