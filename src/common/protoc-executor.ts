import * as execa from 'execa';
import { copyFileSync, existsSync, mkdirSync, realpathSync, writeFileSync } from 'fs';
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

  export const execute = async (dependency_path: string, target_path: string, target_language: SUPPORTED_LANGUAGES): Promise<void> => {
    const dependency_config = ServiceConfig.loadFromPath(dependency_path);
    if (!dependency_config.proto) {
      throw new Error(`${dependency_config.name} has no .proto file configured.`);
    }
    const dependency_folder = ServiceConfig.convertServiceNameToFolderName(dependency_config.name);
    const target_config = ServiceConfig.loadFromPath(target_path);
    // Prevent race conditions when building the same service concurrently for different targets
    const namespace = `${ServiceConfig.convertServiceNameToFolderName(target_config.name)}__${dependency_folder}`;

    // Make the folder to store dependency stubs
    const stub_directory = path.join(target_path, MANAGED_PATHS.DEPENDENCY_STUBS_DIRECTORY, dependency_folder);
    if (!existsSync(stub_directory)) {
      mkdirSync(stub_directory, { recursive: true });
    }

    const tmp_root = realpathSync(os.tmpdir());
    const tmp_dir = path.join(tmp_root, namespace);
    const tmp_dependency_dir = path.join(tmp_dir, dependency_folder);
    if (!existsSync(tmp_dependency_dir)) {
      mkdirSync(tmp_dependency_dir, { recursive: true });
    }
    copyFileSync(
      path.join(dependency_path, dependency_config.proto),
      path.join(tmp_dependency_dir, dependency_config.proto)
    );

    const mount_dirname = '/opt/protoc';
    const mounted_proto_path = path.posix.join(mount_dirname, dependency_folder, dependency_config.proto);

    await execa.shell([
      'docker', 'run',
      '-v', `${target_path}:/defs`,
      '-v', `${tmp_dir}:${mount_dirname}`,
      '--user', process.platform === 'win32' ? '1000:1000' : '$(id -u):$(id -g)',  // TODO figure out correct user for windows
      'architectio/protoc-all',
      '-f', `${mounted_proto_path}`,
      '-i', mount_dirname,
      '-l', target_language,
      '-o', MANAGED_PATHS.DEPENDENCY_STUBS_DIRECTORY
    ].join(' '));
    await execa.shell(`rm -rf ${tmp_dir}`);

    _postHooks(stub_directory, target_language);
  };
}

export default ProtocExecutor;
