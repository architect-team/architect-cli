import execa, { ExecaChildProcess, Options } from 'execa';

/**
 * Goal of this test is to test that the more complicated commands like dev -> exec -> shutdown of dev
 * work properly in various shells.
 * This program will get executed by our github workflows on multiple OS's and various shells so that 
 * we can be sure this flow is working as expected.
 */

const EXEC_TESTS = [
  ['ls'],
  ['sh', '-c', '\'ls; echo "hey"; ls | cat\''],
  ['sh', '-c', '"echo \"quotes\""'],
];

function wait(seconds: number): Promise<void> {
  return new Promise(r => setTimeout(r, seconds * 1000));
}


function architect(args: string[], opts?: Options<string>) {
  return execa('./bin/run', args, opts);
}

// make architect.yml in tempdir and run dev, then exec on it

// TODO: write example yml that requires no dependencies to tmpfile
function runDev(shell: string): execa.ExecaChildProcess<string> {
  const dev_process = architect(['dev', 'examples/hello-world/architect.yml', '--no-browser', '--ssl=false'], 
    { shell, stdio: 'inherit' });

  process.on('SIGINT', () => {
    dev_process.kill('SIGINT');
  });

  return dev_process;
}

async function runExec(shell: string, cmd: string[]) {
  const cmd_array = ['exec'].concat('-a dev hello-world.services.api --no-tty --'.split(' ')).concat(cmd);
  try {
    console.log(`Testing: ${cmd_array}`);
    const exec_process = architect(cmd_array, { shell });
    await exec_process;
  } catch (e) {
    console.log(`Test failed! ${cmd_array}`);
    console.log(e);
    process.exit(1);
  }
}

async function runTest(shell: string) {
  console.log(`Running architect dev using ${shell}...`);
  const dev_process = runDev(shell);

  let attempts = 0;
  // Hack to make eslint happy, can fix this with an ignore later
  while (dev_process.exitCode === null) {
    const compose_ls = (await execa('docker', ['compose', 'ls'])).stdout.toString();
    if (compose_ls.split('\n').length > 1) {
      console.log('Containers running!');
      break;
    }

    if (attempts % 5 == 0) {
      console.log('Waiting for architect dev to start containers...');
    }
  
    attempts += 1;
    const MAX_ATTEMPTS = 30;
    if (attempts > MAX_ATTEMPTS) {
      console.log(`architect dev not running anything after ${MAX_ATTEMPTS} attempts, giving up`);
      process.exit(1);
    }
    await wait(1);
  }

  if (dev_process.exitCode !== null) {
    console.log('Dev process exited early!');
    process.exit(1);
  }

  console.log('waiting 10 seconds before running exec tests..');
  await wait(10);

  // Step 2: Run some exec commands
  for (let i = 0; i < EXEC_TESTS.length; i++) {
    await runExec(shell, EXEC_TESTS[i]);
  }

  if (process.env.CI) {
    console.log('All tests passed!');
    // todo: hardcoded location
    await execa('docker', ['compose', '-f', '/home/runner/.config/architect/docker-compose/architect.yml', '-p', 'architect', 'stop']);
    wait(5);
    return;
  }

  /** TODO:
   * This doesn't currently work when run within a GH action. The child process gets killed: true set,
   * but the signal is not received for some reason. For now, going to settle with testing exec
   * and dev will automatically shut down because the test will end.
   */

  // Step 3: Interrupting process
  dev_process.kill('SIGINT');
  try {
    await dev_process;
  } catch (e) {
    console.log(`Process failed to be killed: ${dev_process}`);
    console.log(e);
  }
  
  console.log(`Dev exit code: ${dev_process.exitCode}`);

  const compose_ls = (await execa('docker', ['compose', 'ls'])).stdout.toString();
  if (compose_ls.split('\n').length !== 1) {
    console.log('ERROR: Process is still running');
    console.log(compose_ls);
    process.exit(1);
  }

  console.log(`Test passed for ${shell}`);
}

async function run() {
  interface TestShells {
    darwin: string[];
    linux: string[];
    win32: string[];
  }
          
  // Note: darwin currently isn't tested because docker isn't installed in the macos runner image.
  // It is used locally though for people using a Mac, so it's still handled in this script.
  const shells: TestShells = {
    darwin: ['sh', 'bash'],
    linux: ['sh', 'bash'],
    win32: ['cmd.exe', 'pwsh'],
  };

  console.log(`Running test for platform: ${process.platform}`);
  if (process.platform in shells) {
    const shells_to_test: string[] = shells[process.platform as keyof TestShells];
    for (const shell of shells_to_test) {
      await runTest(shell);
    }

    console.log('All tests on all shells finished successfully.');
    process.exit(0);
  } else {
    console.log('Got unexpected platform');
    process.exit(1);
  }
}

run();