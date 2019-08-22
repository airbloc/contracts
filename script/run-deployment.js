const fs = require('fs');
const http = require('http');

const env = process.argv[2]; // 'test', 'local', None
const path = `deployment${env ? `.${env}` : ''}.json`;

const host = 'localhost';
const port = 8500;

if (fs.existsSync(path)) {
  // add deployment server
  http.createServer((req, res) => fs.createReadStream(path).pipe(res))
    .listen(port, () => {
      console.log(`Deployment info server started at http://${host}:${port}.`);
      console.log(`Deployment path is ./${path}`);
    });
} else {
  console.error(`file ${path} does not exist`);
}
