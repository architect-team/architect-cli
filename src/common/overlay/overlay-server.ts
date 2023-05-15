import fs from 'fs-extra';
import http from 'http';
import path from 'path';
import DevRestart from '../../commands/dev/restart';
import { Config } from '@oclif/core';
import AppService from '../../app-config/service';
import Logs from '../../commands/logs';
import { ServiceKey } from '../docker-compose';

export class OverlayServer {
  private app: AppService;
  private config: Config;
  private environment: string;
  private services: ServiceKey[];

  constructor(app: AppService, config: Config, environment: string, services: ServiceKey[]) {
    this.app = app;
    this.config = config;
    this.environment = environment;
    this.services = services;
  }

  listen(port: number): void {
    const server = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.url === '/overlay.js') {
        this.handleOverlay(res);
      } else if (req.url === '/favicon.ico') {
        this.handleFavicon(res);
      } else if (req.url?.startsWith('/restart/')) {
        const [_, __, service_name] = req.url.split('/');
        const restart_cmd = new DevRestart([service_name, '-e', this.environment], this.config);
        restart_cmd.app = this.app;

        await restart_cmd.run();

        res.writeHead(200);
        res.end(`Restarted ${service_name}.`);
      } else if (req.url?.startsWith('/logs/')) {
        const [_, __, service_name] = req.url.split('/');
        const logs_cmd = new Logs([service_name, '-e', this.environment, '--raw'], this.config);
        logs_cmd.app = this.app;

        res.writeHead(200);
        res.write(`Logs can be viewed in the CLI with the command: 'architect logs -e ${this.environment} ${service_name}'`);
        res.write('\n----------------\n\n');

        // Overwrite log function to instead send data to our response.
        logs_cmd.log = (...message: string[]) => {
          for (const m of message) {
            // log writes include ansi characters because we're using chalk to color text.
            res.write(stripAnsi(m));
          }
          res.write('\n');
        };

        await logs_cmd.run();

        res.end();
      } else {
        res.writeHead(200);
        let service_rows = '';
        for (const service_key of this.services) {
          service_rows += '<tr>';

          service_rows += `
            <td>${service_key.name}</td>
            <td><a href="#" onclick="fetch('http://localhost:${port}/restart/${service_key.name}')">Restart</a></td>
            <td><a href="http://localhost:${port}/logs/${service_key.name}" target="_blank">View Logs</a></td>
          `;

          service_rows += '</tr>';
        }

        res.write(`
          <!DOCTYPE html>
            <head>
              <title>Architect Control</title>
            </head>
            <body>
              <table>
                <tr>
                  <th>Service</th>
                  <th></th>
                  <th></th>
                </tr>
                ${service_rows}
              </table>
            </body>
          </html>
        `);
        res.end();
      }
    });

    server.on('error', err => console.log(err));

    console.log(`Starting overlay server on port: ${port}`);
    server.listen(port);
  }

  private handleOverlay(res: http.ServerResponse): void {
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
  }

  private handleFavicon(res: http.ServerResponse): void {
    try {
      // eslint-disable-next-line unicorn/prefer-module
      const file_path = path.join(__dirname, '../../static/favicon.ico');
      const file = fs.readFileSync(file_path);
      res.writeHead(200, { 'Content-Type': 'image/x-icon' });
      res.end(file);
    } catch {
      // No favicon for you :(
    }
  }
}

/**
 * Remove ansi characters from a string.
 * Pulled from https://github.com/chalk/strip-ansi
 */
function stripAnsi(string: string) {
  const pattern = [
		'[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
		'(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))'
	].join('|');
	return string.replace(new RegExp(pattern, 'g'), '');
}
