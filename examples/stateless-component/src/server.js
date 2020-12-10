const express = require('express');
const next = require('next');
const axios = require('axios');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    const server = express();

    server.get('/hello', async (req, res) => {
      const { data } = await axios.get(process.env.HELLO_WORLD_ADDR);
      return res.send(data);
    });

    server.all('*', (req, res) => {
      return handle(req, res);
    });

    const port = process.env.PORT || 8080;
    server.listen(port, (err) => {
      if (err) throw err;
      console.log(`> Ready on port: ${port}`);
    })
  })
  .catch((ex) => {
    console.error(ex.stack);
    process.exit(1);
  });
