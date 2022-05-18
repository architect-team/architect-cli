import { Dictionary } from '../utils/dictionary';

export type SecretType = boolean | number | string | null;
export type SecretsDict = Dictionary<Dictionary<SecretType>>;
