import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { ArchitectError } from '../dependency-manager/utils/errors';

export default class CallbackServer {
  async listenForCallback(port: number): Promise<string> {
    const [success_file, failure_file] = await Promise.all([this.get_success_file(), this.get_failure_file()]);

    return new Promise((resolve, reject) => {
      const server = http.createServer();

      server.on('request', async (req, res) => {
        try {
          const queryObject = new URL(req.url, 'http://localhost').searchParams;
          if (queryObject.has('error')) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            const failure_html = failure_file.toString().replace('%%FAILURE_MESSAGE%%', (queryObject.get('error_description') as string));
            res.end(failure_html);
            reject(new ArchitectError('Login failed: ' + queryObject.get('error_description')));
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(success_file);
            resolve(queryObject.get('code') as string);
          }
        } finally {
          server.close();
        }
      });

      server.on('error', async (err) => {
        reject(err);
      });

      server.listen(port);
    });
  }

  async get_success_file(): Promise<Buffer> {
    // eslint-disable-next-line unicorn/prefer-module
    const success_path = path.join(path.dirname(fs.realpathSync(__filename)), '../static/login_callback_success.html');
    return new Promise((resolve, reject) => {
      fs.readFile(success_path, function (err, html) {
        if (err) {
          reject(err);
        }
        resolve(html);
      });
    });
  }

  async get_failure_file(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line unicorn/prefer-module
      const failure_path = path.join(path.dirname(fs.realpathSync(__filename)), '../static/login_callback_failure.html');
      fs.readFile(failure_path, function (err, html) {
        if (err) {
          reject(err);
        }
        resolve(html);
      });
    });
  }
}
