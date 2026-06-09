require('dotenv').config({ path: require('path').join(__dirname, '../../secrets.env') });


const cleanEnv = (val) => {
  if (typeof val === 'string') {
    return val.replace(/^['"]|['"]$/g, '').trim();
  }
  return val;
};

const config = {
  env: cleanEnv(process.env.NODE_ENV) || 'development',
  port: parseInt(cleanEnv(process.env.PORT), 10) || 5000,
  mongodb: {
    uri: cleanEnv(process.env.MONGODB_URI) || 'mongodb://localhost:27017/quorafaq',
  },
  fastApiUrl: cleanEnv(process.env.FASTAPI_URL) || 'http://localhost:8000',
  redis: {
    url: cleanEnv(process.env.REDIS_URL) || 'redis://localhost:6379',
  },
  elasticsearch: {
    node: cleanEnv(process.env.ELASTICSEARCH_URL) || 'http://localhost:9200',
  },
  kafka: {
    brokers: (cleanEnv(process.env.KAFKA_BROKERS) || 'localhost:9092').split(','),
  },
  jwt: {
    secret: cleanEnv(process.env.JWT_SECRET) || 'quorafaq_jwt_secret',
    expiresIn: cleanEnv(process.env.JWT_EXPIRES_IN) || '7d',
  },
  clientUrl: cleanEnv(process.env.CLIENT_URL) || 'http://localhost:3000',
  webPush: {
    subject: cleanEnv(process.env.VAPID_SUBJECT) || 'mailto:admin@quorafaq.com',
    publicKey: cleanEnv(process.env.VAPID_PUBLIC_KEY) || 'BN0Wi1zWP6LkN25bI_c9Fo7YJKqjuslbjF2lB3Qslc59YsIp7PM48k56fRcSsIamXVnag5Bu2dazjhsdOQJC5Uc',
    privateKey: cleanEnv(process.env.VAPID_PRIVATE_KEY) || '5PmrXpU-msoypetPodmJqENnH8T1LKmRtCiNWrxbXE0',
  },
  firebase: {
    apiKey: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    serviceAccount: cleanEnv(process.env.FIREBASE_SERVICE_ACCOUNT),
  },
  smtp: {
    user: cleanEnv(process.env.GMAIL_USER) || cleanEnv(process.env.SMTP_USER) || 'faqportal.in@gmail.com',
    pass: cleanEnv(process.env.GMAIL_APP_PASSWORD) || cleanEnv(process.env.SMTP_PASS) || 'your_app_password_here',
  },
};

module.exports = config;
