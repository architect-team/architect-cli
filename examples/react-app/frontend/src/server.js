const express = require('express');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    const server = express();

    server.all('*', (req, res) => {
      return handle(req, res);
    });

    const port = process.env.INTERNAL_PORT || 8080;
    server.listen(port, (err) => {
      if (err) throw err;
      console.log(`> Ready on http://${process.env.INTERNAL_HOST}:${port}`);
    })
  })
  .catch((ex) => {
    console.error(ex.stack);
    process.exit(1);
  });
