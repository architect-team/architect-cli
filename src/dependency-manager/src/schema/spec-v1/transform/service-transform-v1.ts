import { ServiceConfig } from '../../config/service-config';
import { ServiceSpecV1 } from '../service-spec-v1';

export const transformComponentSpecV1 = (spec: ServiceSpecV1): ServiceConfig => {

};

// TODO:269:transform
// export const transformServiceInterfaces = function (input?: Dictionary<string | Dictionary<any>>): Dictionary<InterfaceSpecV1> | undefined {
//   if (!input) {
//     return {};
//   }
//   if (!(input instanceof Object)) {
//     return input;
//   }

//   const output: Dictionary<InterfaceSpecV1> = {};
//   for (const [key, value] of Object.entries(input)) {
//     output[key] = value instanceof Object
//       ? plainToClass(InterfaceSpecV1, value)
//       : plainToClass(InterfaceSpecV1, { port: value });
//   }
//   return output;
// };

  // TODO:269:transform
  // getInterfaces() {
  //   return transformServiceInterfaces(this.interfaces) || {};
  // }

  // getLivenessProbe(): LivenessProbeSpec | undefined {
  //   if (!this.liveness_probe || !Object.keys(this.liveness_probe).length) { return undefined; }

  //   const liveness_probe = {
  //     success_threshold: '1',
  //     failure_threshold: '3',
  //     timeout: '5s',
  //     interval: '30s',
  //     initial_delay: '0s',
  //     ...this.liveness_probe,
  //   };

  //   if (this.liveness_probe.command && typeof this.liveness_probe.command === 'string') {
  //     const env: Dictionary<string> = {};
  //     for (const key of Object.keys(this.getEnvironmentVariables())) {
  //       env[key] = `$${key}`;
  //     }
  //     liveness_probe.command = shell_parse(this.liveness_probe.command, env).map(e => `${e}`);
  //   }

  //   return liveness_probe as LivenessProbeSpec;
  // }

  // getReplicas() {
  //   return this.replicas || '1';
  // }

  // /** @return New expanded copy of the current config */
  // expand() {
  //   const config = super.expand();
  //   for (const [key, value] of Object.entries(this.getInterfaces())) {
  //     config.setInterface(key, value);
  //   }
  //   return config;
  // }
}
