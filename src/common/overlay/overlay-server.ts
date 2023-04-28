import fs from 'fs-extra';
import http from 'http';
import path from 'path';

export class OverlayServer {
  listen(port: number): void {
    const server = http.createServer(function (req, res) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      try {
        // eslint-disable-next-line unicorn/prefer-module
        const file_path = path.join(__dirname, '../../static/overlay.js');
        const file = fs.readFileSync(file_path);
        res.writeHead(200, { 'Content-Type': 'text/javascript' });
        res.end(file);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error');
      }
    });

    server.on('error', err => console.log(err));

    server.listen(port);
  }
}
