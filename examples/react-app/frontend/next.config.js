module.exports = {
  publicRuntimeConfig: {
    API_ADDR: process.env.API_ADDR,
    WORLD_TEXT: process.env.WORLD_TEXT,
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
