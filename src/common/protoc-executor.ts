import execa from 'execa';
import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'fs';
import { remove } from 'fs-extra';
import os from 'os';
import path from 'path';

import MANAGED_PATHS from './managed-paths';
import ServiceConfig from './service-config';
import ServiceDependency from './service-dependency';
import SUPPORTED_LANGUAGES from './supported-languages';

namespace ProtocExecutor {
  const _postHooks = (stub_directory: string, target_language: SUPPORTED_LANGUAGES): void => {
    if (target_language === SUPPORTED_LANGUAGES.PYTHON) {
      writeFileSync(path.join(stub_directory, '__init__.py'), '');
    }
  };

  export const clear = async (target: ServiceDependency) => {
    const stub_directory = path.join(target.service_path, MANAGED_PATHS.DEPENDENCY_STUBS_DIRECTORY);
    return remove(stub_directory);
  };

  export const execute = async (dependency: ServiceDependency, target: ServiceDependency): Promise<void> => {
    if (!dependency.config.interface) {
      throw new Error(`${dependency.config.name} has no interface configured.`);
    }
    if (!target.local) {
      throw new Error(`${dependency.config.name} is not a local service`);
    }
    const dependency_folder = ServiceConfig.convertServiceNameToFolderName(dependency.config.name);
    // Prevent race conditions when building the same service concurrently for different targets
    const namespace = `${ServiceConfig.convertServiceNameToFolderName(target.config.name)}__${dependency_folder}`;

    // Make the folder to store dependency stubs
    const stub_directory = path.join(target.service_path, MANAGED_PATHS.DEPENDENCY_STUBS_DIRECTORY, dependency_folder);
    if (!existsSync(stub_directory)) {
      mkdirSync(stub_directory, { recursive: true });
    }

    const tmp_root = realpathSync(os.tmpdir());
    const tmp_dir = path.join(tmp_root, namespace);
    const tmp_dependency_dir = path.join(tmp_dir, dependency_folder);
    if (!existsSync(tmp_dependency_dir)) {
      mkdirSync(tmp_dependency_dir, { recursive: true });
    }

    for (const definition of dependency.config.interface.definitions) {
      writeFileSync(path.join(tmp_dependency_dir, definition), dependency.interface_definitions[definition]);
    }

    const mount_dirname = '/opt/protoc';
    // TODO figure out mounting of multiple definitions
    const mounted_proto_path = path.posix.join(mount_dirname, dependency_folder, dependency.config.interface.definitions[0]);

    await execa('docker', [
      'run',
      '--rm', '--init',
      '-v', `${target.service_path}:/defs`,
      '-v', `${tmp_dir}:${mount_dirname}`,
      'architectio/protoc-all',
      '-f', `${mounted_proto_path}`,
      '-i', mount_dirname,
      '-l', target.config.language,
      '-o', MANAGED_PATHS.DEPENDENCY_STUBS_DIRECTORY
    ]);
    await execa('rm', ['-rf', tmp_dir]);

    _postHooks(stub_directory, target.config.language);
  };
}

export default ProtocExecutor;
