import execa, { ExecaChildProcess, Options } from 'execa';

/**
 * Goal of this test is to test that the more complicated commands like dev -> exec -> shutdown of dev
 * work properly in various shells.
 * This program will get executed by our github workflows on multiple OS's and various shells so that 
 * we can be sure this flow is working as expected.
 */

function architect(args: string[], opts?: Options<string>) {
  return execa('./bin/run', args, opts);
}

// make architect.yml in tempdir and run dev, then exec on it

// TODO: write example yml that requires no dependencies to tmpfile
function runDev(shell: string): execa.ExecaChildProcess<string> {
  const dev_process = architect(['dev', 'examples/hello-world/architect.yml', '--no-browser'], 
    { shell, detached: true});
    
  process.on('SIGINT', () => {
    process.kill(dev_process.pid, 'SIGINT');
  });

  return dev_process;
}

async function runTest(shell: string) {
  console.log(`Running architect dev using ${shell}...`);
  const dev_process = runDev(shell);

  let dev_process_output = '';
  dev_process.stdout?.on('data', (data) => {
    dev_process_output += data.toString();
  });

  let attempts = 0;
  // Hack to make eslint happy, can fix this with an ignore later
  while (1 > 0 || attempts) {
    const compose_ls = (await execa('docker', ['compose', 'ls'])).stdout.toString();
    if (compose_ls.split('\n').length > 1) {
      break;
    }

    if (attempts % 5 == 0) {
      console.log('Waiting for architect dev to start containers...');
    }
  
    attempts += 1;
    const MAX_ATTEMPTS = 30;
    if (attempts > MAX_ATTEMPTS) {
      console.log(`architect dev not running anything after ${MAX_ATTEMPTS} attempts, giving up`);
      console.log('Dumping dev process output:');
      console.log(dev_process_output);
      process.exit(1);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  // Step 2: Run some exec commands
  try {
    const exec_process = architect(['exec', '-a', 'dev', 'hello-world.services.api', '--no-tty', '--', 'ls'], { shell });

    // exec_process.stdout?.on('data', (data) => {
    //   console.log(data.toString());
    // });

    await exec_process;
  } catch (e) {
    process.kill(dev_process.pid, 'SIGINT');
    console.log(`Failed to exec with error:\n${e}`);
    process.exit(1);
  }

  // Step 3: Interrupting process
  process.kill(dev_process.pid, 'SIGINT');
  await dev_process;
  console.log(`Dev exit code: ${dev_process.exitCode}`);

  const compose_ls = (await execa('docker', ['compose', 'ls'])).stdout.toString();
  if (compose_ls.split('\n').length !== 1) {
    console.log('Process is still running :(');
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
  } else {
    console.log('Got unexpected platform');
    process.exit(1);
  }
}

run();