#!/bin/sh
set -e

# MongoDB is hosted on Atlas (cloud) - no local connectivity check needed.
# The backend Node.js app handles connection retries internally via Mongoose.
echo "MongoDB: Using Atlas (cloud) — skipping local port check."

echo "Waiting for Redis..."
REDIS_HOST="${REDIS_URL:-redis://redis:6379}"
# Extract just the host from REDIS_URL (redis://host:port -> host)
REDIS_HOST_CLEAN=$(echo "$REDIS_HOST" | sed 's|redis://||' | cut -d: -f1)
REDIS_PORT_CLEAN=$(echo "$REDIS_HOST" | sed 's|redis://||' | cut -d: -f2)
node -e "
const net = require('net');
const host = '$REDIS_HOST_CLEAN' || 'redis';
const port = parseInt('$REDIS_PORT_CLEAN') || 6379;
let tries = 0;
const connect = () => {
  if (tries++ > 30) { console.log('Redis timeout, continuing...'); process.exit(0); }
  const s = net.createConnection(port, host, () => { s.end(); process.exit(0); });
  s.on('error', () => { setTimeout(connect, 2000); });
};
connect();
" || { echo "Redis not available, continuing anyway..."; }

echo "Waiting for Elasticsearch..."
node -e "
const http = require('http');
let tries = 0;
const check = () => {
  if (tries++ > 30) { console.log('Elasticsearch timeout, continuing...'); process.exit(0); }
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
