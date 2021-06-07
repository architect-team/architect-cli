require('./tracer');

const express = require('express');
const next = require('next');
const { createProxyMiddleware } = require("http-proxy-middleware");

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    const server = express();

    server.use('/api', createProxyMiddleware({
      target: process.env.API_ADDR,
      pathRewrite: {
        '^/api': ''
      },
      changeOrigin: false
    }));

    server.all('*', (req, res) => {
      return handle(req, res);
    });

    const port = process.env.PORT || 8080;
    server.listen(port, (err) => {
      if (err) throw err;
      console.log('> Ready on port:', port);
    })
  })
  .catch((ex) => {
    console.error(ex.stack);
    process.exit(1);
  });
