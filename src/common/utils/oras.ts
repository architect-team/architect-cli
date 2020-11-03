import execa, { Options } from 'execa';

export const oras = async (args: string[], options?: Options): Promise<any> => {
  // TODO:274 figure out stdio
  options = { ...{ stdio: 'pipe' }, ...options };
  const cmd = execa('oras', args, options);
  try {
    return await cmd;
  } catch (err) {
    try {
      await execa('which', ['oras']);
    } catch {
      throw new Error('Architect requires oras to be installed for custom modules.\nhttps://github.com/deislabs/oras#cli-installation');
    }
    throw err;
  }
};
