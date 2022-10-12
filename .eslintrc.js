// eslint-disable-next-line unicorn/prefer-module
module.exports = {
  extends: [
    'oclif',
    'oclif-typescript',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 0,
    '@typescript-eslint/semi': ['error'],

    'array-element-newline': 0,
    'camelcase': [0],
    'generator-star-spacing': 0,
    'indent': 0,
    'lines-between-class-members': 0,
    'new-cap': 0,
    'no-else-return': 0,
    'object-curly-spacing': ['error', 'always'],
    'padding-line-between-statements': 0,
    'radix': 0,
    'semi': 'off',
    'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],

    'unicorn/catch-error-name': 'off',
    'unicorn/no-zero-fractions': 'off',
    'unicorn/prefer-node-protocol': 'off',
    'unicorn/prefer-switch': 'off',

    // Consider enabling
    'default-param-last': 0,
    'arrow-parens': 0,
    'complexity': ['error', 50],
    'max-depth': ['error', 6],
    'no-await-in-loop': 0,
    'no-negated-condition': 0,
    'no-promise-executor-return': 0,
    'no-template-curly-in-string': 0,
    'no-warning-comments': 0,
    'one-var-declaration-per-line': 0,
    'prefer-regex-literals': 0,
    '@typescript-eslint/explicit-module-boundary-types': ['warn', {
      allowArgumentsExplicitlyTypedAsAny: true,
    }],
    'valid-jsdoc': 0,

    'unicorn/empty-brace-spaces': 'off',
    'unicorn/explicit-length-check': 'off',
    'unicorn/import-style': 'off',
    'unicorn/no-process-exit': 'off',
    'unicorn/no-static-only-class': 'off',
    'unicorn/no-useless-undefined': 'off',
    'unicorn/numeric-separators-style': 'off',
    'unicorn/prefer-optional-catch-binding': 'off',
    'unicorn/prefer-string-slice': 'off',
    'unicorn/prefer-ternary': 'off',
    'unicorn/prefer-type-error': 'off',
    'quote-props': 0,
  },
};
