import net from 'net';

const PORT_RANGE = Array.from({ length: 1000 }, (_, k) => k + 50000);

// eslint-disable-next-line no-undef
const _isPortAvailable = async (host: string, port: number) => new Promise((resolve, reject) => {
  const tester: net.Server = net.createServer()
    .once('error', err => reject(err))
    .once('listening', () => tester.once('close', () => resolve()).close())
    .listen(port, host);
});

export default class PortManager {
  // eslint-disable-next-line no-undef
  static tested_ports = new Set();

  static async isPortAvailable(port: number): Promise<boolean> {
    try {
      await _isPortAvailable('0.0.0.0', port);
      return true;
    } catch {
      return false;
    }
  }

  static async getAvailablePort() {
    let port: number;

    for (const p of PORT_RANGE) {
      if (PortManager.tested_ports.has(p)) continue;
      const isAvailable = await PortManager.isPortAvailable(p);
      if (isAvailable) {
        port = p;
        break;
      }
    }

    if (!port) throw new Error('No ports available in configured range (50000 -> 51000)');
    PortManager.tested_ports.add(port);
    return port;
  }
}
