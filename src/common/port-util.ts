import net from 'net';

namespace PortUtil {
  const AVAILABLE_PORTS = Array.from({ length: 1000 }, (_, k) => k + 50000);

  export const isPortAvailable = async (port: number) => new Promise<boolean>(resolve => {
    const tester: net.Server = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () =>
        tester.once('close', () => resolve(true)).close()
      )
      .listen(port, '0.0.0.0');
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
