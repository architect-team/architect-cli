import Command from '@oclif/command';
import * as keytar from 'keytar';
import * as request from 'request';
import * as url from 'url';

export default abstract class extends Command {
  architect!: ArchitectClient;

  async init() {
    this.architect = new ArchitectClient();
  }

  styled_json(obj: object) {
    let json = JSON.stringify(obj, null, 2);
    this.log(json);
  }
}

class ArchitectClient {
  private readonly domain = 'https://api.architect.io';

  async get(path: string) {
    return this.request('GET', path);
  }

  async put(path: string, body: object) {
    return this.request('PUT', path, body);
  }

  async delete(path: string) {
    return this.request('DELETE', path);
  }

  async post(path: string, body: object) {
    return this.request('POST', path, body);
  }

  private async request(method: string, path: string, body?: object) {
    const credentials = await keytar.findCredentials('architect.io');
    if (credentials.length === 0) {
      throw Error('denied: `architect login` required');
    }
    const access_token = JSON.parse(credentials[0].password).access_token;

    const options = {
      url: url.resolve(this.domain, path),
      headers: {
        authorization: `Bearer ${access_token}`,
        method,
      },
      json: true,
      method,
      body
    };

    return new Promise<request.Response>((resolve, reject) => {
      request(options, (err, res) => {
        if (err) {
          reject(err);
        } else {
          if (res.statusCode < 400) {
            resolve(res);
          } else {
            if (res.statusCode === 401) {
              reject(Error('denied: `architect login` required'));
            } else {
              let json;
              try {
                json = JSON.stringify(res.body, null, 2);
              } catch {
                json = '';
              }
              reject(new Error(`failed: request ${res.statusCode} ${res.statusMessage} ${json}`));
            }
          }
        }
      });
    });
  }
}
