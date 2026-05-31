#!/bin/sh
set -e

echo "Waiting for MongoDB..."
node -e "
const net = require('net');
const connect = () => {
  const s = net.createConnection(27017, 'mongodb', () => { s.end(); process.exit(0); });
  s.on('error', () => { setTimeout(connect, 1000); });
};
connect();
"

echo "Waiting for Redis..."
node -e "
const net = require('net');
const connect = () => {
  const s = net.createConnection(6379, 'redis', () => { s.end(); process.exit(0); });
  s.on('error', () => { setTimeout(connect, 1000); });
};
connect();
"

echo "Starting backend..."
exec "$@"