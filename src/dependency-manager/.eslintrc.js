module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['oclif'],
  parserOptions: {
    project: './tsconfig.json',
    sourceType: 'module',
  },
  rules: {
    camelcase: [0],
    'no-extra-semi': [2],
    'no-unused-vars': [0],
    'no-undef': [0],
    'comma-dangle': [1, 'always-multiline'],
    'semi': 'off',
    'no-prototype-builtins': [0],
    'space-before-function-paren': ['error', { 'anonymous': 'always', 'named': 'never', 'asyncArrow': 'always' }],
    'prefer-const': [1],

    '@typescript-eslint/camelcase': [0],
    '@typescript-eslint/explicit-function-return-type': [0],
    '@typescript-eslint/no-explicit-any': [0],
    '@typescript-eslint/no-unused-vars': [0],
    '@typescript-eslint/no-use-before-define': [1],
    '@typescript-eslint/no-var-requires': [0],
    '@typescript-eslint/no-namespace': [1],
    '@typescript-eslint/semi': ['warn', 'always'],
  }
}
