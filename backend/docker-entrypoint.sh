# Wait for all required services before starting
#!/bin/sh
set -e

echo "Waiting for MongoDB..."
node -e "
const net = require('net');
const connect = () => {
  const s = net.createConnection(27017, 'mongodb', () => { s.end(); process.exit(0); });
  s.on('error', () => { setTimeout(connect, 2000); });
};
connect();
" || { echo "MongoDB not available, continuing anyway..."; }

echo "Waiting for Redis..."
node -e "
const net = require('net');
const connect = () => {
  const s = net.createConnection(6379, 'redis', () => { s.end(); process.exit(0); });
  s.on('error', () => { setTimeout(connect, 2000); });
};
connect();
" || { echo "Redis not available, continuing anyway..."; }

echo "Waiting for Elasticsearch..."
node -e "
const http = require('http');
const check = () => {
  const req = http.get('http://elasticsearch:9200', (res) => {
    if (res.statusCode === 200) { process.exit(0); }
    setTimeout(check, 3000);
  });
  req.on('error', () => { setTimeout(check, 3000); });
  req.setTimeout(5000, () => { req.destroy(); setTimeout(check, 3000); });
};
check();
" || { echo "Elasticsearch not available, continuing anyway..."; }

echo "Starting backend..."
exec "$@"