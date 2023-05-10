import net from 'net';

const PORT_RANGE = Array.from({ length: 1000 }, (_, k) => k);

/**
 * Chromium restricted ports:
 *   https://chromium.googlesource.com/chromium/src.git/+/refs/heads/master/net/base/port_util.cc#27
 * Firefox restricted ports is a subset of this list as well:
 *   https://www-archive.mozilla.org/projects/netlib/portbanning#portlist
 * Browsers will not allow you to connect to local services on these ports, so
 * they aren't allowed to be assigned to services.
 */
export const RESTRICTED_PORTS = new Set([
  1,      // tcpmux
  7,      // echo
  9,      // discard
  11,     // systat
  13,     // daytime
  15,     // netstat
  17,     // qotd
  19,     // chargen
  20,     // ftp data
  21,     // ftp access
  22,     // ssh
  23,     // telnet
  25,     // smtp
  37,     // time
  42,     // name
  43,     // nicname
  53,     // domain
  69,     // tftp
  77,     // priv-rjs
  79,     // finger
  87,     // ttylink
  95,     // supdup
  101,    // hostriame
  102,    // iso-tsap
  103,    // gppitnp
  104,    // acr-nema
  109,    // pop2
  110,    // pop3
  111,    // sunrpc
  113,    // auth
  115,    // sftp
  117,    // uucp-path
  119,    // nntp
  123,    // NTP
  135,    // loc-srv /epmap
  137,    // netbios
  139,    // netbios
  143,    // imap2
  161,    // snmp
  179,    // BGP
  389,    // ldap
  427,    // SLP (Also used by Apple Filing Protocol)
  465,    // smtp+ssl
  512,    // print / exec
  513,    // login
  514,    // shell
  515,    // printer
  526,    // tempo
  530,    // courier
  531,    // chat
  532,    // netnews
  540,    // uucp
  548,    // AFP (Apple Filing Protocol)
  554,    // rtsp
  556,    // remotefs
  563,    // nntp+ssl
  587,    // smtp (rfc6409)
  601,    // syslog-conn (rfc3195)
  636,    // ldap+ssl
  989,    // ftps-data
  990,    // ftps
  993,    // ldap+ssl
  995,    // pop3+ssl
  1719,   // h323gatestat
  1720,   // h323hostcall
  1723,   // pptp
  2049,   // nfs
  3659,   // apple-sasl / PasswordServer
  4045,   // lockd
  5060,   // sip
  5061,   // sips
  6000,   // X11
  6566,   // sane-port
  6665,   // Alternate IRC [Apple addition]
  6666,   // Alternate IRC [Apple addition]
  6667,   // Standard IRC [Apple addition]
  6668,   // Alternate IRC [Apple addition]
  6669,   // Alternate IRC [Apple addition]
  6697,   // IRC + TLS
  10080,  // Amanda
]);

export default class PortUtil {
  private static tested_ports = new Set();

  static async isPortAvailable(port: number): Promise<boolean> {
    if (RESTRICTED_PORTS.has(port)) {
      return false;
    }

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
