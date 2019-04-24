import {execSync} from 'child_process';
import {copyFileSync, existsSync, mkdirSync, realpathSync, writeFileSync} from 'fs';
import * as os from 'os';
import * as path from 'path';

import MANAGED_PATHS from './managed-paths';
import ServiceConfig from './service-config';
import SUPPORTED_LANGUAGES from './supported-languages';

namespace ProtocExecutor {
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

    // Make the folder to store dependency stubs
    const stubs_directory = path.join(target_path, MANAGED_PATHS.DEPENDENCY_STUBS_DIRECTORY);
    if (!existsSync(stubs_directory)) {
      mkdirSync(stubs_directory);
    }

    const stub_directory = path.join(stubs_directory, ServiceConfig.convertServiceNameToFolderName(dependency_config.name));
    if (!existsSync(stub_directory)) {
      mkdirSync(stub_directory);
    }

    const tmpRoot = realpathSync(os.tmpdir());
    const tmpDir = path.join(tmpRoot, ServiceConfig.convertServiceNameToFolderName(dependency_config.name));
    if (!existsSync(tmpDir)) {
      mkdirSync(tmpDir);
    }
    copyFileSync(
      path.join(dependency_path, dependency_config.proto),
      path.join(tmpDir, dependency_config.proto)
    );

    const mount_dirname = '/opt/protoc';
    const mounted_proto_path = path.posix.join(mount_dirname, ServiceConfig.convertServiceNameToFolderName(dependency_config.name), dependency_config.proto);
    execSync([
      'docker', 'run',
      '-v', `${target_path}:/defs`,
      '-v', `${tmpRoot}:${mount_dirname}`,
      process.platform === 'win32' ? '' : '$(id -u):$(id -g)',  // TODO figure out correct user for windows
      'architectio/protoc-all',
      '-f', `${mounted_proto_path}`,
      '-i', mount_dirname,
      '-l', target_language,
      '-o', MANAGED_PATHS.DEPENDENCY_STUBS_DIRECTORY
    ].join(' '), {stdio: 'ignore'});
    execSync(`rm -rf ${tmpDir}`);

    _postHooks(stub_directory, target_language);
  };
}

export default ProtocExecutor;
