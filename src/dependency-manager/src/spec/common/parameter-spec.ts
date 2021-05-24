
export type ParameterValue = string | number | boolean | null | undefined;

export interface ParameterDefinitionSpec {
  required?: string;
  description?: string;
  default?: ParameterValue;
}

export type ParameterValueSpec = ParameterValue | ParameterDefinitionSpec;
