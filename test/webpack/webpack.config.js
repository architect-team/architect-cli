const TerserPlugin = require('terser-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const path = require('path');

module.exports = {
  plugins: [
    // new BundleAnalyzerPlugin(),
  ],
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({
      terserOptions: {
        keep_classnames: /^\w+Spec$/,
        compress: true,
        mangle: true,
      },
    })],
  },
  node: {
    fs: 'empty',
    net: 'empty',
  },
  externals: {
    acorn: '{}',
    'acorn-loose': '{ LooseParser: { BaseParser: { extend: function() {} } } }',
    'fs-extra': '{}',
    '@oclif/core': '{}',
  },
  entry: './test.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'lib'),
  },
};
