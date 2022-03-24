import { ArchitectError } from '../../dependency-manager/utils/errors';

export default class InvalidConfigOption extends ArchitectError {
  constructor(option: string) {
    super();
    this.name = 'invalid_config_option';
    this.message = `The CLI config option, "${option}", is not a valid option.`;
  }
}
