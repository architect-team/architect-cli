import yaml from 'js-yaml';

function resolveYamlNull(data: any) {
  if (data === null) return true;

  const max = data.length;

  return (max === 1 && data === '~') ||
    (max === 4 && (data === 'null' || data === 'Null' || data === 'NULL'));
}

function constructYamlNull() {
  return null;
}

function isNull(object: any) {
  return object === null;
}

export default new yaml.Type('tag:yaml.org,2002:null', {
  kind: 'scalar',
  resolve: resolveYamlNull,
  construct: constructYamlNull,
  predicate: isNull,
  represent: {
    canonical: function () { return '~'; },
    lowercase: function () { return 'null'; },
    uppercase: function () { return 'NULL'; },
    camelcase: function () { return 'Null'; },
    empty: function () { return ''; },
  },
  defaultStyle: 'lowercase',
});
