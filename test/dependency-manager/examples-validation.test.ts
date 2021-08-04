import Ajv from "ajv";
import fs from 'fs-extra';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Register from '../../src/commands/register';
import PortUtil from '../../src/common/utils/port';
import { ComponentConfigBuilder } from '../../src/dependency-manager/src';

// This test validates the architect.yml file for each of our example components to ensure that none go out of date
describe('example component validation', function () {
  beforeEach(async () => {
    // Stub the logger
    sinon.replace(Register.prototype, 'log', sinon.stub());
    moxios.install();
    moxios.wait(function () {
      let request = moxios.requests.mostRecent()
      if (request) {
        request.respondWith({
          status: 404,
        })
      }
    })
    sinon.replace(PortUtil, 'isPortAvailable', async () => true);
    PortUtil.reset();
  });

  afterEach(function () {
    // Restore stubs
    sinon.restore();
    // Restore fs
    mock_fs.restore();
    moxios.uninstall();
  });

  describe('example components', function () {
    const EXAMPLES_DIR = 'examples';
    var example_architect_dirs = fs.readdirSync(EXAMPLES_DIR);

    it(`${EXAMPLES_DIR}/hello-world/architect.yml passes ajv json schema validation`, async () => {
      const { file_path, file_contents, raw_config } = await ComponentConfigBuilder.rawFromPath(`${EXAMPLES_DIR}/hello-world/architect.yml`);
      const config = ComponentConfigBuilder.buildFromJSON(raw_config);

      const schema_string = fs.readFileSync('/Users/dp/code/architect/architect-cli/src/dependency-manager/architect-schema.json', 'utf-8');
      const schema = JSON.parse(schema_string);
      const ajv = new Ajv();
      const validate = ajv.compile(schema);
      const valid = validate(config);
      if (!valid) {
        console.debug(validate.errors);
        throw new Error();
      }
    });

    // for (const example_dir of example_architect_dirs) {
    //   if (fs.existsSync(`${EXAMPLES_DIR}/${example_dir}/architect.yml`)) {

    //     // it(`${EXAMPLES_DIR}/${example_dir}/architect.yml passes validOrReject for the developer group`, async () => {
    //     //   const component_config = await ComponentConfigBuilder.buildFromPath(`${EXAMPLES_DIR}/${example_dir}/architect.yml`);

    //     //   try {
    //     //     await component_config.validateOrReject({ groups: ['developer'] });
    //     //   } catch (err) {
    //     //     console.log('An example architect file is failing the #validateOrReject() method', err);
    //     //     throw err;
    //     //   }
    //     // });

    //     it(`${EXAMPLES_DIR}/${example_dir}/architect.yml passes ajv json schema validation`, async () => {
    //       const { file_path, file_contents, raw_config } = await ComponentConfigBuilder.rawFromPath(`${EXAMPLES_DIR}/${example_dir}/architect.yml`);
    //       const config = ComponentConfigBuilder.buildFromJSON(raw_config);

    //       console.log(JSON.stringify(config));

    //       const schema_string = fs.readFileSync('/Users/dp/code/architect/architect-cli/src/dependency-manager/src/schema/architect-schema.json', 'utf-8');
    //       const schema = JSON.parse(schema_string);
    //       const ajv = new Ajv();
    //       const validate = ajv.compile(schema);
    //       const valid = validate(config);
    //       if (!valid) {
    //         console.debug(validate.errors);
    //         throw new Error();
    //       }
    //     });

    //   }
    // }
  });
});
