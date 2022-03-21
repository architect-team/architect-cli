import net from 'net';

const PORT_RANGE = Array.from({ length: 1000 }, (_, k) => k);

export default class PortUtil {
  private static tested_ports = new Set();

  static async isPortAvailable(port: number): Promise<boolean> {
    const promise = new Promise(((resolve, reject) => {
      const socket = new net.Socket();

      const onError = (err: any) => {
        socket.destroy();
        reject(err);
      };

      socket.setTimeout(5000);
      socket.once('error', onError);
      socket.once('timeout', resolve);

      socket.connect(port, '0.0.0.0', () => {
        socket.end();
        resolve(true);
      });
    }));

    try {
      await promise;
      return false;
    } catch {
      return true;
    }
  }

  static async getAvailablePort(starting_port = 50000): Promise<number> {
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

  static reset(): void {
    PortUtil.tested_ports = new Set();
  }
}
