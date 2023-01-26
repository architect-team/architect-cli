import { SecretSpecValue } from '../spec/secret-spec';
import { Dictionary } from '../utils/dictionary';

export type SecretsDict = Dictionary<Dictionary<SecretSpecValue>>;
