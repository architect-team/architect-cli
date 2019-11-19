import chalk from 'chalk';
import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import ARCHITECTPATHS from '../paths';
import ServiceConfig from './service-config';
import ServiceDependency from './service-dependency';
import SUPPORTED_LANGUAGES from './supported-languages';

namespace ProtocExecutor {
  const _postHooks = async (stub_directory: string, target_language?: string) => {
    if (target_language === SUPPORTED_LANGUAGES.PYTHON) {
      await fs.writeFile(path.join(`${stub_directory}/../`, '__init__.py'), '');
      await fs.writeFile(path.join(`${stub_directory}/../../`, '__init__.py'), '');
      await fs.writeFile(path.join(stub_directory, '__init__.py'), '');
    }
  };

  export const execute = async (dependency: ServiceDependency, target: ServiceDependency, error_logger: any): Promise<void> => {
    if (!dependency.config.api) {
      throw new Error(`${dependency.config.name} has no api configured.`);
    }
    if (!target.local) {
      throw new Error(`${dependency.config.name} is not a local service`);
    }
    const dependency_folder = ServiceConfig.convertServiceNameToFolderName(dependency.config.name);
    const target_folder = ServiceConfig.convertServiceNameToFolderName(target.config.name);

    // Make the folder to store dependency stubs
    const stub_directory = path.join(target.service_path, ARCHITECTPATHS.CODEGEN_DIR, dependency_folder);
    await fs.ensureDir(stub_directory);

    const checksums = [];
    for (const definition of dependency.config.api!.definitions || []) {
      const definition_contents = dependency.api_definitions[definition];
      const hash = crypto.createHash('md5').update(definition_contents).digest('hex');
      checksums.push(hash);
    }

    const checksum_path = path.join(stub_directory, 'checksum');
    const checksum = checksums.join('\n');
    const old_checksum = await fs.readFile(checksum_path, 'utf-8').catch(() => null);
    if (checksum === old_checksum) {
      await fs.writeFile(checksum_path, checksum);
      return;
    }

    const tmp_root = await fs.realpath(os.tmpdir());
    const tmp_dir = path.join(tmp_root, 'architect-grpc', `${dependency_folder}_${target_folder}`);
    const tmp_dependency_dir = path.join(tmp_dir, dependency_folder);
    await fs.ensureDir(tmp_dependency_dir);

    for (const definition of dependency.config.api.definitions || []) {
      const definition_contents = dependency.api_definitions[definition];
      await fs.outputFile(path.join(tmp_dependency_dir, definition), definition_contents);
    }

    try {
      await createGrpcDefinitions(target, stub_directory, tmp_dependency_dir, error_logger);
      await fs.writeFile(checksum_path, checksum);
    } finally {
      await fs.remove(tmp_dir);
    }

    await _postHooks(stub_directory, target.config.language);
  };

  const createGrpcDefinitions = (service: ServiceDependency, write_path: string, target_service_path: string, error_logger: any) => {
    const config = service.config;

    if (config && config.api && config.api.definitions) {
      const service_definitions = config.api.definitions;
      const current_service_language = config.language;

      if (current_service_language === SUPPORTED_LANGUAGES.NODE) {
        try {
          execSync('which grpc_tools_node_protoc');
        } catch (err) {
          execSync('npm install -g grpc-tools');
        }

        for (const definition of service_definitions) {
          const proto_path = path.join(target_service_path, definition);
          fs.ensureDirSync(write_path);
          execSync(`grpc_tools_node_protoc \
            -I ${target_service_path} \
            --js_out=import_style=commonjs,binary:${write_path} \
            --grpc_out=${write_path} \
            ${proto_path}`);
        }
      } else if (current_service_language === SUPPORTED_LANGUAGES.PYTHON) {
        try {
          execSync('python3 -c "import grpc_tools"');
        } catch (err) {
          execSync('pip3 install grpcio-tools');
        }

        for (const definition of service_definitions) {
          const proto_path = path.join(target_service_path, definition);
          fs.ensureDirSync(write_path);
          execSync(`python3 -m grpc_tools.protoc \
          -I ${target_service_path} \
          --python_out=${write_path} \
          --grpc_python_out=${write_path} \
          ${proto_path}`);
        }
      } else {
        error_logger.log(chalk.yellow(current_service_language ? `The CLI doesn't currently support ${current_service_language}` : 'Please add a service language'), { exit: true });
      }
    } else {
      error_logger.log(chalk.red('grpc service definitions not found'), { exit: true });
    }
  }
}

export default ProtocExecutor;
