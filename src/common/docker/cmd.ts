import execa, { Options } from 'execa';
import { DockerHelper } from './helper';

// eslint-disable-next-line unicorn/no-object-as-default-parameter
export const docker = async (args: string[], opts = { stdout: true }, execa_opts?: Options): Promise<any> => {
  if (process.env.TEST === '1') {
    return;
  }

  DockerHelper.verifyDocker();

  const cmd = execa('docker', args, execa_opts);
  if (opts.stdout) {
    cmd.stdout?.pipe(process.stdout);
    cmd.stderr?.pipe(process.stderr);
  }
  return cmd;
};
