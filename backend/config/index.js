require('dotenv').config({ path: require('path').join(__dirname, '../../secrets.env') });


const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/quorafaq',
  },
  fastApiUrl: process.env.FASTAPI_URL || 'http://localhost:8000',
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  elasticsearch: {
    node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'quorafaq_jwt_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  webPush: {
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@quorafaq.com',
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
  },
};

module.exports = config;
