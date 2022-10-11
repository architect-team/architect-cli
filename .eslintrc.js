module.exports = {
  extends: [
    'oclif',
    'oclif-typescript',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 0,

    'array-element-newline': 0,
    'camelcase': [0],
    'generator-star-spacing': 0,
    'lines-between-class-members': 0,
    'new-cap': 0,
    'no-else-return': 0,
    'object-curly-spacing': ['error', 'always'],
    'padding-line-between-statements': 0,
    'semi': [2, 'always'],

    'unicorn/no-zero-fractions': 'off',
    'unicorn/prefer-node-protocol': 'off',
    'unicorn/prefer-switch': 'off',

    // Def enable
    'eqeqeq': 0,
    'guard-for-in': 0,
    'indent': 0,
    'quotes': [0], // ['error', 'single', { 'allowTemplateLiterals': true }],

    'unicorn/no-array-for-each': 'off',
    'unicorn/no-for-loop': 'off',
    'unicorn/no-instanceof-array': 'off',
    'unicorn/prefer-set-has': 'off',
    'unicorn/prefer-spread': 'off',

    // Consider enabling
    'arrow-parens': 0,
    'complexity': 0,
    'max-depth': ['error', 6],
    'no-implicit-coercion': 0,
    'no-negated-condition': 0,
    'no-template-curly-in-string': 0,
    'no-warning-comments': 0,
    'one-var-declaration-per-line': 0,
    'prefer-regex-literals': 0,
    '@typescript-eslint/explicit-module-boundary-types': ['warn', {
      allowArgumentsExplicitlyTypedAsAny: true,
    }],
    'valid-jsdoc': 0,
    'unicorn/better-regex': 'off',
    'unicorn/catch-error-name': 'off',
    'unicorn/empty-brace-spaces': 'off',
    'unicorn/explicit-length-check': 'off',
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
