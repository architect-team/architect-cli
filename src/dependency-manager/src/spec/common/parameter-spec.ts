
export type ParameterValue = string | number | boolean | undefined;

export interface ParameterDefinitionSpec {
  required?: boolean;
  description?: string;
  default?: ParameterValue;
}

export type ParameterValueSpec = ParameterValue | ParameterDefinitionSpec;
