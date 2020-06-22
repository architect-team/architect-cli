module.exports = {
  publicRuntimeConfig: {
    ECHO_ADDR: process.env.ECHO_ADDR,
    NODE_ENV: process.env.NODE_ENV,
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    return config;
  }
};
