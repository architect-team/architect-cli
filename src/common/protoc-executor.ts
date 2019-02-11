import {execSync} from 'child_process';
import {copyFileSync, existsSync, mkdirSync, writeFileSync} from 'fs';
import * as os from 'os';
import * as path from 'path';

import ServiceConfig from './service-config';
import SUPPORTED_LANGUAGES from './supported-languages';

namespace ProtocExecutor {
  const _getOutputOptions = (stub_directory: string, target_language: SUPPORTED_LANGUAGES): [string, string][] => {
    let options: [string, string][] = [];

    switch (target_language) {
      case SUPPORTED_LANGUAGES.NODE:
        options.push(['js_out', `import_style=commonjs,binary:${stub_directory}`]);
        options.push(['grpc_out', `minimum_node_version=8:${stub_directory}`]);
        break;
      default:
        options.push([`${target_language}_out`, stub_directory]);
        options.push(['grpc_out', stub_directory]);
    }

    return options;
  };

  const _postHooks = (stub_directory: string, target_language: SUPPORTED_LANGUAGES): void => {
    if (target_language === SUPPORTED_LANGUAGES.PYTHON) {
      writeFileSync(path.join(stub_directory, '__init__.py'), '');
    }
  };

  export const execute = (dependency_path: string, target_path: string, target_language: SUPPORTED_LANGUAGES): void => {
    const dependency_config = ServiceConfig.loadFromPath(dependency_path);
    if (!dependency_config.proto) {
      throw new Error(`${dependency_config.name} has no .proto file configured.`);
    }

    const stub_directory = path.join(target_path, ServiceConfig.convertServiceNameToFolderName(dependency_config.name));
    if (!existsSync(stub_directory)) {
      mkdirSync(stub_directory);
    }

    let protobuf_options: [string, string][] = [];
    const tmpDir = path.join(os.tmpdir(), ServiceConfig.convertServiceNameToFolderName(dependency_config.name));
    if (!existsSync(tmpDir)) {
      mkdirSync(tmpDir);
    }
    copyFileSync(
      path.join(dependency_path, dependency_config.proto),
      path.join(tmpDir, dependency_config.proto)
    );
    protobuf_options.push(['proto_path', os.tmpdir()]);

    const grpc_plugin_path = path.join(
      process.env.ARCHITECT_PATH || path.join(os.homedir(), '.architect'),
      'grpc/bins/opt/',
      `grpc_${target_language}_plugin`
    );
    protobuf_options.push(['plugin', `protoc-gen-grpc=${grpc_plugin_path}`]);
    protobuf_options = protobuf_options.concat(_getOutputOptions(target_path, target_language));

    const protobuf_options_string = protobuf_options.map(pair => `--${pair.join('=')}`).join(' ');
    execSync(`protoc ${protobuf_options_string} ${path.join(tmpDir, dependency_config.proto)}`);
    execSync(`rm -rf ${tmpDir}`);

    _postHooks(stub_directory, target_language);
  };
}

export default ProtocExecutor;
