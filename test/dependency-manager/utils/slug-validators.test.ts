import { expect } from 'chai';
import { ComponentSlugUtils, ComponentVersionSlugUtils, ResourceSlugUtils, Slugs } from '../../../src';

describe('slugs validators', () => {

  const valid_slug = 'architect';
  const invalid_slug = 'double--dashes';
  const valid_tag = '1.0.0';
  const invalid_tag = '}1.0.0';

  const valid_slugs = [
    valid_slug,
    'arc-examples',
    'arc-examples-2',
    '2-arc-examples',
    'something-32-characters-looooong',
    'a',
    '2',
  ];

  const valid_tags = [
    valid_tag,
    '1-0-0',
    '1',
    'latest',
  ]

  const globally_invalid_punctuation = [
    'other?punctuation',
    'other/punctuation',
    'other|punctuation',
    'other\'punctuation',
    'other"punctuation',
    'other]punctuation',
    'other[punctuation',
    'other{punctuation',
    'other}punctuation',
    'other=punctuation',
    'other+punctuation',
    'other>punctuation',
    'other<punctuation',
    'other(punctuation',
    'other)punctuation',
    'other*punctuation',
    'other^punctuation',
    'other%punctuation',
    'other~punctuation',
    'other`punctuation',
    'other,punctuation',
    'other&punctuation',
    'other$punctuation',
    'other#punctuation',
    'other!punctuation',
    'other;punctuation',
  ];

  const invalid_slugs = [
    invalid_slug,
    '-leading-dashes',
    'trailingdashes-',
    'something-33-characters-loooooong',
    'other.punctuation',
    ...globally_invalid_punctuation
  ];

  const invalid_tags = [
    invalid_tag,
    ...globally_invalid_punctuation,
  ]

  it(`valid slugs are acceptable to ArchitectSlugValidator`, async () => {
    for (const slug of valid_slugs) {
      expect(Slugs.ArchitectSlugValidator.test(slug)).to.be.true
    }
  });

  it(`invalid slugs are NOT acceptable to ArchitectSlugValidator`, async () => {
    for (const slug of invalid_slugs) {
      expect(Slugs.ArchitectSlugValidator.test(slug)).to.be.false
    }
  });

  it(`valid tags are acceptable to ComponentTagValidator`, async () => {
    for (const tag of valid_tags) {
      expect(Slugs.ComponentTagValidator.test(tag)).to.be.true
    }
  });

  it(`invalid tags are NOT acceptable to ComponentTagValidator`, async () => {
    for (const tag of invalid_tags) {
      expect(Slugs.ComponentTagValidator.test(tag)).to.be.false
    }
  });

  it(`valid slugs are acceptable to ComponentSlugValidator`, async () => {
    for (const component_name of valid_slugs) {
      const slug = `${valid_slug}/${component_name}`;
      expect(ComponentSlugUtils.Validator.test(slug)).to.be.true
    }
    for (const component_name of valid_slugs) {
      const slug = component_name;
      expect(ComponentSlugUtils.Validator.test(slug)).to.be.true
    }
  });

  it(`invalid slugs are NOT acceptable to ComponentSlugValidator`, async () => {
    for (const component_name of invalid_slugs) {
      const slug = `${valid_slug}/${component_name}`;
      expect(ComponentSlugUtils.Validator.test(slug)).to.be.false
    }

    for (const component_name of valid_slugs) {
      const slug = `${invalid_slug}/${component_name}`;
      expect(ComponentSlugUtils.Validator.test(slug)).to.be.false
    }

    for (const component_name of invalid_slugs) {
      const slug = `${invalid_slug}/${component_name}`;
      expect(ComponentSlugUtils.Validator.test(slug)).to.be.false
    }
  });

  it(`valid slugs are acceptable to ComponentVersionSlugValidator`, async () => {
    for (const tag of valid_tags) {
      const slug = `${valid_slug}/${valid_slug}:${tag}`;
      expect(ComponentVersionSlugUtils.Validator.test(slug)).to.be.true
    }
  });

  it(`invalid slugs are NOT acceptable to ComponentVersionSlugValidator`, async () => {
    for (const tag of valid_tags) {
      const slug = `${invalid_slug}/${valid_slug}:${tag}`;
      expect(ComponentVersionSlugUtils.Validator.test(slug)).to.be.false
    }

    for (const tag of valid_tags) {
      const slug = `${valid_slug}/${invalid_slug}:${tag}`;
      expect(ComponentVersionSlugUtils.Validator.test(slug)).to.be.false
    }

    for (const tag of invalid_tags) {
      const slug = `${valid_slug}/${valid_slug}:${tag}`;
      expect(ComponentVersionSlugUtils.Validator.test(slug)).to.be.false
    }
  });

  it(`valid slugs are acceptable to ResourceSlugUtils`, async () => {
    for (const resource_name of valid_slugs) {
      const slug = `${valid_slug}/${valid_slug}.services.${resource_name}`;
      expect(ResourceSlugUtils.Validator.test(slug)).to.be.true
    }
  });

  it(`invalid slugs are NOT acceptable to ResourceSlugUtils`, async () => {
    for (const resource_name of invalid_slugs) {
      const slug = `${valid_slug}/${valid_slug}.services.${resource_name}`;
      expect(ResourceSlugUtils.Validator.test(slug)).to.be.false
    }

    for (const component_name of invalid_slugs) {
      const slug = `${valid_slug}/${component_name}.services.${valid_slug}`;
      expect(ResourceSlugUtils.Validator.test(slug)).to.be.false
    }

    for (const account_name of invalid_slugs) {
      const slug = `${account_name}/${valid_slug}.services.${valid_slug}`;
      expect(ResourceSlugUtils.Validator.test(slug)).to.be.false
    }
  });
});
