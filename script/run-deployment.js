const fs = require('fs');
const http = require('http');

// add deployment server
http.createServer((req, res) => fs.createReadStream('deployment.local.json').pipe(res))
  .listen(8500, () => console.log('Deployment info server started at http://localhost:8500'));
