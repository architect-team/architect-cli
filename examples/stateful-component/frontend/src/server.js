const express = require('express');
const next = require('next');
const axios = require('axios');
const bodyParser = require('body-parser');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    const server = express();

    server.use(bodyParser());

    server.all('/api/*', async (req, res) => {
      try {
        console.log(req.method, `${process.env.API_ADDR}/${req.url.replace('/api/', '')}`, JSON.stringify(req.body || {}));
        const { status, data } = await axios({
          url: `${process.env.API_ADDR}/${req.url.replace('/api/', '')}`,
          method: req.method,
          body: JSON.stringify(req.body || {}),
          headers: req.headers,
        });
        console.log('success');
        return res.status(status).json(data);
      } catch (err) {
        console.log('error');
        return res.status(err.response.status).json(err.response.data || []);
      }
    });

    server.all('*', (req, res) => {
      return handle(req, res);
    });

    const port = process.env.PORT || 8081;
    server.listen(port, (err) => {
      if (err) throw err;
      console.log(`> Ready on port: ${port}`);
    })
  })
  .catch((ex) => {
    console.error(ex.stack);
    process.exit(1);
  });
