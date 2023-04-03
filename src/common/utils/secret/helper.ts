import { isNumberString } from 'class-validator';

export const parseEnvironmentVariable = (secret_value: string | undefined): (string | number | null) => {
  if (!secret_value) {
    return null;
  }

  let value: string | number = secret_value;
  if (value && isNumberString(value)) {
    value = Number.parseFloat(value);
  }
  if (`${value}`.length !== secret_value?.length) {
    value = secret_value;
  }
  return value;
};
