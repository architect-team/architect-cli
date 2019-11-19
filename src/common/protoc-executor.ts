import chalk from 'chalk';
import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import ARCHITECTPATHS from '../paths';
import { LocalDependencyNode } from './dependency-manager/node/local';
import ServiceConfig from './service-config';
import SUPPORTED_LANGUAGES from './supported-languages';

namespace ProtocExecutor {
  const _postHooks = async (stub_directory: string, target_language?: string) => {
    if (target_language === SUPPORTED_LANGUAGES.PYTHON) {
      await fs.writeFile(path.join(`${stub_directory}/../`, '__init__.py'), '');
      await fs.writeFile(path.join(`${stub_directory}/../../`, '__init__.py'), '');
      await fs.writeFile(path.join(stub_directory, '__init__.py'), '');
    }
  };

  export const execute = async (dependency: LocalDependencyNode, target: LocalDependencyNode): Promise<void> => {
    if (!dependency.api_type) {
      throw new Error(`${dependency.name} has no api configured.`);
    }
    // if (!target.local) { // TODO: replace
    //   throw new Error(`${dependency.name} is not a local service`);
    // }
    const dependency_folder = ServiceConfig.convertServiceNameToFolderName(dependency.name);
    const target_folder = ServiceConfig.convertServiceNameToFolderName(target.name);

    // Make the folder to store dependency stubs
    const stub_directory = path.join(target.service_path, ARCHITECTPATHS.CODEGEN_DIR, dependency_folder);
    await fs.ensureDir(stub_directory);

    const checksums = [];
    if (dependency.api_definitions) {
      for (const definition of dependency.api_definitions) {
        const definition_contents = fs.readFileSync(path.join(dependency.service_path, definition));
        const hash = crypto.createHash('md5').update(definition_contents).digest('hex');
        checksums.push(hash);
      }
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

    if (dependency.api_definitions) {
      for (const definition of dependency.api_definitions) {
        const definition_contents = fs.readFileSync(path.join(dependency.service_path, definition));
        await fs.outputFile(path.join(tmp_dependency_dir, definition), definition_contents);
      }
    }

    try {
      await createGrpcDefinitions(target, stub_directory, tmp_dependency_dir);
      await fs.writeFile(checksum_path, checksum);
    } finally {
      await fs.remove(tmp_dir);
    }

    await _postHooks(stub_directory, target.language);
  };

  const createGrpcDefinitions = (service: LocalDependencyNode, write_path: string, target_service_path: string) => {
    if (service.api_type && service.api_definitions) {
      const service_definitions = service.api_definitions;
      const current_service_language = service.language;

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
        console.log(chalk.yellow(current_service_language ? `The CLI doesn't currently support ${current_service_language}` : 'Please add a service language'), { exit: true });
      }
    } else {
      console.log(chalk.red('grpc service definitions not found'), { exit: true });
    }
  }
}

export default ProtocExecutor;
