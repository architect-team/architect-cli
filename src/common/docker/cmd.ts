import execa, { Options } from 'execa';

export const docker = async (args: string[], opts = { stdout: true }, execa_opts?: Options): Promise<any> => {
  if (process.env.TEST === '1') {
    return;
  }
  const cmd = execa('docker', args, execa_opts);
  if (opts.stdout) {
    cmd.stdout?.pipe(process.stdout);
    cmd.stderr?.pipe(process.stderr);
  }
  return await cmd;
};

export const restart = async (container_id: string): Promise<void> => {
  return docker(['restart', container_id]);
};
