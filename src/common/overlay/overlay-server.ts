import fs from 'fs-extra';
import http from 'http';

export class OverlayServer {
  listen(): void {
    const server = http.createServer(function (req, res) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // eslint-disable-next-line unicorn/prefer-module
      const file_path = __dirname + '/overlay.js';
      const file = fs.readFileSync(file_path);
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end(file);
    });

    server.listen(60001); // TODO:TJ
  }
}
