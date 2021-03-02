import isWindows from 'is-windows';
import net from 'net';

const PORT_RANGE = Array.from({ length: 1000 }, (_, k) => k);

// eslint-disable-next-line no-undef
const _isPortAvailable = async (host: string, port: number) => new Promise((resolve, reject) => {
  const tester: net.Server = net.createServer()
    .once('error', err => reject(err))
    .once('listening', () => tester.once('close', () => resolve(undefined)).close())
    .listen(port, host);
});

export default class PortUtil {
  // eslint-disable-next-line no-undef
  private static tested_ports = new Set();

  static async isPortAvailable(port: number): Promise<boolean> {
    try {
      await Promise.all([
        _isPortAvailable('0.0.0.0', port),
        isWindows() ? _isPortAvailable('::', port) : Promise.resolve(), // Check for windows
      ]);
      return true;
    } catch {
      return false;
    }
  }

  static async getAvailablePort(starting_port = 50000) {
    let port = 0;

    for (const pr of PORT_RANGE) {
      const p = pr + starting_port;
      if (PortUtil.tested_ports.has(p)) continue;
      PortUtil.tested_ports.add(p);
      const isAvailable = await PortUtil.isPortAvailable(p);
      if (isAvailable) {
        port = p;
        break;
      }
    }

    if (!port) throw new Error('No ports available in configured range (50000 -> 51000)');
    return port;
  }

  static reset() {
    PortUtil.tested_ports = new Set();
  }
}
