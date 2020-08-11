import { flags } from '@oclif/command';
import { AccountUtils } from '../common/utils/account';
import { EnvironmentUtils } from '../common/utils/environment';
import { ComponentVersionSlugUtils, EnvironmentConfig, EnvironmentConfigBuilder, RawEnvironmentConfig } from '../dependency-manager/src';
import { Dictionary } from '../dependency-manager/src/utils/dictionary';
import { replaceBrackets } from '../dependency-manager/src/utils/interpolation';
import { DeployCommand } from './deploy';

export default class Destroy extends DeployCommand {
  auth_required() {
    return true;
  }

  static description = 'Destroy components from an environment';

  static args = [];
  static flags = {
    ...DeployCommand.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,
    components: flags.string({
      char: 'c',
      description: 'Component(s) to destroy',
      multiple: true,
    }),
  };

  async run() {
    const { flags } = this.parse(Destroy);

    const account = await AccountUtils.getAccount(this.app.api, flags.account);
    const environment = await EnvironmentUtils.getEnvironment(this.app.api, account, flags.environment);

    let new_env_config: EnvironmentConfig;
    if (flags.components) {
      const { data } = await this.app.api.get(`/environments/${environment.id}/state`);
      if (!data.env_config || Object.keys(data.env_config).length === 0) {
        this.warn('The environment is already empty');
        return;
      }
      const env_config = EnvironmentConfigBuilder.buildFromJSON(data.env_config);
      new_env_config = this.removeComponents(data.env_config, env_config, flags.components);
    } else {
      new_env_config = EnvironmentConfigBuilder.buildFromJSON({});
    }

    await this.deployRemote(environment, new_env_config, false);
  }

  removeComponents(raw_env_config: RawEnvironmentConfig, env_config: EnvironmentConfig, component_refs_to_remove: string[]): EnvironmentConfig {
    const current_component_refs = Object.values(env_config.getComponents()).map((c) => c.getRef());

    for (const component_ref of component_refs_to_remove) {
      // Validate regex
      if (!ComponentVersionSlugUtils.Validator.test(component_ref)) {
        this.log(`Componenents defined in environment config:\n${current_component_refs.join('\n')}`);
        throw new Error(`'${component_ref}' ${ComponentVersionSlugUtils.Description}`);
      }
      // Validate existence
      if (!current_component_refs.includes(component_ref)) {
        this.log(`Componenents defined in environment config:\n${current_component_refs.join('\n')}`);
        throw new Error(`'${component_ref}' does not exist in the environment`);
      }
    }

    // Remove components
    const components: Dictionary<any> = {};
    const component_names_removed = [];
    for (const [component_name, component] of Object.entries(env_config.getComponents())) {
      if (component_refs_to_remove.includes(component.getRef())) {
        component_names_removed.push(component_name);
      } else {
        components[component_name] = raw_env_config.components[component_name];
      }
    }
    env_config.setComponents(components);

    // Remove interfaces for removed components
    const interfaces: Dictionary<any> = {};
    for (const [interface_name, interface_obj] of Object.entries(env_config.getInterfaces())) {
      const normalized_port = replaceBrackets(interface_obj.port);
      if (!component_names_removed.some((component_name) => normalized_port.includes(`components.${component_name}.interfaces`))) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        interfaces[interface_name] = raw_env_config.interfaces![interface_name];
      }
    }
    env_config.setInterfaces(interfaces);

    return env_config;
  }
}
