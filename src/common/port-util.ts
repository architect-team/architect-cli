import net from 'net';

namespace PortUtil {
  const AVAILABLE_PORTS = Array.from({ length: 1000 }, (_, k) => k + 50000);

  const _isPortAvailable = async (host: string, port: number) => new Promise((resolve, reject) => {
    const tester: net.Server = net.createServer()
      .once('error', err => reject(err))
      .once('listening', () => tester.once('close', () => resolve()).close())
      .listen(port, host);
  });

  export const isPortAvailable = async (port: number) => new Promise<boolean>(resolve => {
    Promise.all([
      _isPortAvailable('0.0.0.0', port), // IPv4
      _isPortAvailable('::', port)]) // IPv6
      .then(() => resolve(true))
      .catch(() => resolve(false));
  });

  export const getAvailablePort = async () => {
    let port;

    for (let p of AVAILABLE_PORTS) {
      const isAvailable = await isPortAvailable(p);
      if (isAvailable) {
        port = p;
        break;
      }
    }

    if (!port) throw new Error('No valid ports available');
    return port;
  };
}

export default PortUtil;
