// eslint-disable-next-line import/no-extraneous-dependencies
const csv = require('csvtojson');
const fs = require('fs');
// eslint-disable-next-line import/no-extraneous-dependencies
const yaml = require('yaml');
const { spawn } = require('child_process');

const henesisArchive = yaml.parse(fs.readFileSync('./henesis-archive.yaml', 'utf-8'));
const deployments = require('../deployment.local.json');

function exec(name, command, args, isLive = true) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);

    let outbuf = '';
    let errbuf = '';

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (data) => {
      if (isLive) {
        console.log(data.toString());
      }
      outbuf += data.toString();
    });

    child.stderr.on('data', (data) => {
      if (isLive) {
        console.log(`${name}-error: ${data}`);
      }
      errbuf += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        console.log(`${name} - Command execution failed with code: ${code}`);
        reject(errbuf);
      } else {
        console.log(`${name} - Command execution completed with code: ${code}`);
        resolve(outbuf);
      }
    });
  });
}

const henesis = {
  status: async () => {
    let status = await exec('status', 'henesis', ['integration:status'], false);

    status = status.split('\n').slice(2, -1);
    status = status.map(n => n.replace(/\s+/g, ',').slice(0, -1));
    status = status.join('\n');

    const csvStatus = await csv().fromString(status);

    return csvStatus;
  },
  deploy: async (name) => {
    await exec(`deploy ${name}`, 'henesis', ['integration:deploy'], false);
  },
  delete: async (name, id) => {
    await exec(`delete ${name}`, 'henesis', ['integration:delete', id], false);
  },
  deleteAll: async () => {
    const status = await henesis.status();

    status.forEach((stat) => {
      exec('deleteAll', 'henesis', ['integration:delete', stat.Id], true);
    });
  },
};

async function main() {
  const config = {
    version: henesisArchive.henesisVersion,
    name: 'airbloc',

    blockchain: henesisArchive.blockchain,

    webhook: henesisArchive.webhook,
  };

  const filepath = './henesis.yaml';

  console.log(await henesis.status());

  Object.entries(henesisArchive.contracts).forEach((contractName, contractInfo) => {
    const { contract, handlers, webhook } = contractInfo;

    const updateSource = { contract, handlers };

    if (webhook !== undefined) {
      updateSource.webhook = webhook;
    }

    Object.assign(config, updateSource);

    config.name = `${henesisArchive.namePrefix}-${contractName}`;
    config.contract.address = deployments[contract.name];
    config.contract.compilerVersion = henesisArchive.solidityVersion;
    config.contract.path = `${henesisArchive.pathPrefix}/${config.contract.path}`;

    try {
      fs.writeFileSync(filepath, yaml.stringify(config), 'utf-8');

      henesis.deploy(contractName);
    } catch (err) {
      console.error(err);
    } finally {
      fs.unlinkSync(filepath);
    }
  });

  console.log(await henesis.status());
}

main().catch(err => console.error(`Uncaught error : ${err.stack}`));

// henesis.deleteAll();
