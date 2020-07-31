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
    const expected_slug = `${component_account_name}--${component_name}--mrxakjz5`;

    const url_safe_ref = Refs.url_safe_ref(component_slug);
    expect(url_safe_ref).to.equal(expected_slug);
  });

  it(`Refs.url_safe_ref works for component_version_slug`, async () => {
    const component_version_slug = `${component_account_name}/${component_name}:${tag}`;
    const expected_slug = `${component_account_name}--${component_name}--${transformed_tag}--efhzx9mt`;

    const url_safe_ref = Refs.url_safe_ref(component_version_slug);
    expect(url_safe_ref).to.equal(expected_slug);
  });

  it(`Refs.url_safe_ref works for service_slug`, async () => {
    const service_slug = `${component_account_name}/${component_name}/${service_name}`;
    const expected_slug = `${component_account_name}--${component_name}--${service_name}--k3l7sgnt`;

    const url_safe_ref = Refs.url_safe_ref(service_slug);
    expect(url_safe_ref).to.equal(expected_slug);
  });

  it(`Refs.url_safe_ref works for service_version_slug`, async () => {
    const service_version_slug = `${component_account_name}/${component_name}/${service_name}:${tag}`;
    const expected_slug = `${component_account_name}--${component_name}--${service_name}--${transformed_tag}--uwr37fwm`;

    const url_safe_ref = Refs.url_safe_ref(service_version_slug);
    expect(url_safe_ref).to.equal(expected_slug);
  });

  it(`Refs.url_safe_ref works for environment_slug`, async () => {
    const environment_slug = `${environment_account_name}/${environment_name}`;
    const expected_slug = `${environment_account_name}--${environment_name}--7qwg4isp`;

    const url_safe_ref = Refs.url_safe_ref(environment_slug);
    expect(url_safe_ref).to.equal(expected_slug);
  });

  it(`Refs.url_safe_ref works for interface_slug`, async () => {
    const interface_slug = `${component_account_name}/${component_name}:${tag}-interfaces`;
    const expected_slug = `${component_account_name}--${component_name}--${transformed_tag}--8jkiajzf-interfaces`;

    const url_safe_ref = Refs.url_safe_ref(interface_slug);
    expect(url_safe_ref).to.equal(expected_slug);
  });

  it(`Refs.url_safe_ref cuts long string to 63 chars`, async () => {
    const interface_slug = `this-is-a-component/that-has-more-than-63-chars:it-should-getlopped-off`;
    const expected_slug = `this-is-a-component--that-has-more-than-63-chars--it-shou--6vemnzig`;

    const url_safe_ref = Refs.url_safe_ref(interface_slug);
    expect(url_safe_ref).to.equal(expected_slug);
  });

  it(`Refs.url_safe_ref cuts long string to 63 chars`, async () => {
    const interface_slug = `this-is-a-component/that-has-more-than-63-chars:it-should-getlopped-off-interfaces`;
    const expected_slug = `this-is-a-component--that-has-more-than-63-cha--m9gnv6yi-interfaces`;

    const url_safe_ref = Refs.url_safe_ref(interface_slug);
    expect(url_safe_ref).to.equal(expected_slug);
  });
});
