const http = require('http');
require('./proofa-bootstrap.js');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ok');
});

server.listen(8081, () => {
  http.get('http://localhost:8081', res => {
    console.log('Response headers:', res.headers);
    server.close();
  });
});
