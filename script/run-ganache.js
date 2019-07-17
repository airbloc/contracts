const { spawn } = require('child_process');

function startGanache(customArguments) {
  if (process.env.DOCKER) {
    return spawn('node', ['/app/ganache-core.docker.cli.js', '-i', '1337', ...customArguments]);
  }
  // assume that ganache-cli is installed
  return spawn('ganache-cli', ['-i', '1337', ...customArguments]);
}

const customArguments = process.argv.slice(2);
const ganache = startGanache(customArguments);

ganache.stdout.pipe(process.stdout);
ganache.stderr.pipe(process.stderr);

process.on('SIGINT', process.exit);
process.on('SIGTERM', process.exit);
process.on('exit', () => ganache.kill());
