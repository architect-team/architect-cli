import { expect } from "chai";
import { ValidationError } from "class-validator";
import { ParameterValueFromWrapperV1, ValueFromDependencySpecV1 } from '../src/configs/v1-spec/shared/parameters';

describe('validation', () => {
  it('should validate simple object successfully', async () => {
    const obj = new ValueFromDependencySpecV1();
    obj.dependency = 'tests/test';
    obj.value = 'test';

    const errors = await obj.validate();
    expect(errors).to.be.an('array');
    expect(errors.length).to.equal(0);
  });

  it('should validate nested object successfully', async () => {
    const obj = new ParameterValueFromWrapperV1();
    obj.value_from = new ValueFromDependencySpecV1();
    obj.value_from.dependency = 'tests/test';
    obj.value_from.value = 'test';

    const errors = await obj.validate();
    expect(errors).to.be.an('array');
    expect(errors.length).to.equal(0);
  });

  it('should fail to validate simple object', async () => {
    const obj = new ValueFromDependencySpecV1();

    const errors = await obj.validate();
    expect(errors).to.be.an('array');
    expect(errors.length).to.equal(2);
    errors.forEach(error => {
      expect(error).to.be.instanceOf(ValidationError);
      switch (error.property) {
        case 'dependency':
          expect(error.constraints).to.include({
            isString: 'dependency must be a string',
          });
          break;
        case 'value':
          expect(error.constraints).to.include({
            isString: 'value must be a string',
          });
          break;
        default:
          throw new Error('Unexpected validation error');
      }
    });
  });

  it('should fail to validate nested object', async () => {
    const obj = new ParameterValueFromWrapperV1();
    obj.value_from = new ValueFromDependencySpecV1();
    obj.value_from.dependency = 'tests/test';

    const errors = await obj.validate();
    expect(errors).to.be.an('array');
    expect(errors.length).to.equal(1);
    expect(errors[0]).to.be.instanceOf(ValidationError);
    expect(errors[0].property).to.equal('value_from');
    expect(errors[0].children.length).to.equal(1);
    expect(errors[0].children[0]).to.be.instanceOf(ValidationError);
    expect(errors[0].children[0].property).to.equal('value');
    expect(errors[0].children[0].constraints).to.include({
      isString: 'value must be a string',
    });
  });
});
