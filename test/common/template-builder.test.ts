import { expect } from 'chai';
import { StringTemplateBuilder, TemplateValues } from '../../src/common/utils/template-builder'

describe('config spec v1', () => {
  let params: string[];
  let func: (p: TemplateValues) => string;

  beforeEach(() => {
    params = ['foo', 'bar', 'baz'];
    func = p => `${p.foo}-${p.bar}.${p.baz}`;
  });

  it('builder has expected parms', () => {
    const builder = new StringTemplateBuilder(params, func);
    expect(builder.params).to.deep.eq(params);
  });

  it('builder sets values in constructor', () => {
    const builder = new StringTemplateBuilder(params, func, { foo: 1, bar: 2, baz: 3 });
    expect(builder.build()).to.eq('1-2.3');
  });

  it('builder templates string', () => {
    const builder = new StringTemplateBuilder(params, func, { foo: 1, bar: 2, baz: 3 });
    expect(builder.build()).to.eq('1-2.3');
  });

  it('builder templates string with override', () => {
    const builder = new StringTemplateBuilder(params, func, { foo: 1, bar: 2, baz: 3 });
    expect(builder.build({ foo: 4 })).to.eq('4-2.3');
  });

  it('builder.with creates new instances without shared values', () => {
    const builder = new StringTemplateBuilder(params, func);
    const fooInst = builder.with({ foo: 1 });
    const barInst = builder.with({ bar: 2 });
    const bazInst = builder.with({ baz: 3 });
    expect(() => fooInst.build()).to.throw('Missing template parameters: bar,baz');
    expect(() => barInst.build()).to.throw('Missing template parameters: foo,baz');
    expect(() => bazInst.build()).to.throw('Missing template parameters: foo,bar');
  });

  it('builder.with includes params from previous instance', () => {
    const emptyInst = new StringTemplateBuilder(params, func);
    const fooInst = emptyInst.with({ foo: 1 });
    const barInst = fooInst.with({ bar: 2 });
    const bazInst = barInst.with({ baz: 3 });
    expect(() => emptyInst.build()).to.throw('Missing template parameters: foo,bar,baz');
    expect(() => fooInst.build()).to.throw('Missing template parameters: bar,baz');
    expect(() => barInst.build()).to.throw('Missing template parameters: baz');
    expect(bazInst.build()).to.eq('1-2.3');
  });

  it('builder throws while setting unexpected param', () => {
    const builder = new StringTemplateBuilder(params, func);
    let completeBuilder;
    expect(() => {
      completeBuilder = builder.with({ unexpected: 123 });
    }).to.throw('Unexpected url parameter: unexpected. Expected properties are: foo,bar,baz');
  });
});
