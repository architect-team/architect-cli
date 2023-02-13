const express = require('express');
const next = require('next');
const axios = require('axios');
const bodyParser = require('body-parser');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();

  server.all('/api/*', bodyParser.json(), async (req, res) => {
    try {
      const { status, data } = await axios({
        url: `${process.env.API_ADDR}/${req.url.replace('/api/', '')}`,
        method: req.method,
        data: req.body,
        headers: req.headers,
      });
      return res.status(status).json(data);
    } catch (err) {
      if (err.response) {
        return res.status(err.response.status).json(err.response.data);
      } else {
        return res.status(500).json({});
      }
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
