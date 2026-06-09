const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const { setupSocket } = require('./socket');
const { initIndices, syncToElasticsearch, seedDatabase } = require('./services/searchService');

// Ensure uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Routes
const authRoutes = require('./routes/auth');
const questionRoutes = require('./routes/questions');
const answerRoutes = require('./routes/answers');
const postRoutes = require('./routes/posts');
const voteRoutes = require('./routes/votes');
const faqRoutes = require('./routes/faqs');
const searchRoutes = require('./routes/search');
const userRoutes = require('./routes/users');
const tagRoutes = require('./routes/tags');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const recommendationRoutes = require('./routes/recommendations');
const categoryRoutes = require('./routes/categories');

const app = express();
const server = http.createServer(app);

// Strip Vercel service route prefix if present
app.use((req, res, next) => {
  if (req.url && req.url.startsWith('/_/backend')) {
    req.url = req.url.substring('/_/backend'.length);
    if (!req.url.startsWith('/')) {
      req.url = '/' + req.url;
    }
  }
  next();
});

// Socket.IO
setupSocket(server);

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [config.clientUrl, /\.vercel\.app$/];
    if (!origin || allowed.some(o => typeof o === 'string' ? o === origin : o.test(origin))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api', apiLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// App Version check for in-app updates
app.get('/api/app-version', async (req, res, next) => {
  try {
    const AppVersion = require('./models/AppVersion');
    let versionInfo = await AppVersion.findOne().sort({ createdAt: -1 });
    if (!versionInfo) {
      versionInfo = await AppVersion.create({
        latestVersion: '1.1.0',
        latestVersionCode: 2,
        apkUrl: 'https://prashnasarathi.vercel.app/downloads/prashnasarathi-app.apk',
        changelog: 'Performance improvements, smoother client-side navigation transitions, and native deep linking support.',
        forceUpdate: false
      });
    }
    res.json({
      latestVersion: versionInfo.latestVersion,
      latestVersionCode: versionInfo.latestVersionCode,
      apkUrl: versionInfo.apkUrl,
      changelog: versionInfo.changelog,
      forceUpdate: versionInfo.forceUpdate,
      updatedAt: versionInfo.updatedAt
    });
  } catch (err) {
    next(err);
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/answers', answerRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/categories', categoryRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  await connectDB();

  try {
    await seedDatabase();
    const { cleanupOrphanedData } = require('./utils/cleanup');
    await cleanupOrphanedData();
    await initIndices();
    await syncToElasticsearch();
  } catch (err) {
    console.log('Startup init skipped:', err.message);
  }

  server.listen(config.port, () => {
    console.log(`Server running on port ${config.port} in ${config.env} mode`);

    // Start Anomaly Auto-Escalation Check Job every 60 seconds
    const { checkAndEscalateAnomalies } = require('./services/anomalyService');
    setInterval(checkAndEscalateAnomalies, 60000);

    // Start Firebase Google user sync on startup and run it every 10 minutes
    const { syncGoogleUsers } = require('./services/syncService');
    syncGoogleUsers().catch(err => console.error('Initial Google user sync failed:', err.message));
    setInterval(() => {
      syncGoogleUsers().catch(err => console.error('Interval Google user sync failed:', err.message));
    }, 600000); // 10 minutes

    // Start Nodemailer Queue Worker
    const { startEmailWorker } = require('./services/emailWorker');
    startEmailWorker();
  });
};

if (process.env.VERCEL) {
  // Vercel: connect DB and run seed check on container init
  connectDB().then(async () => {
    try {
      const Category = require('./models/Category');
      const count = await Category.countDocuments();
      if (count === 0) {
        console.log('MongoDB is empty. Seeding database on Vercel...');
        const { seedDatabase } = require('./services/searchService');
        await seedDatabase();
      }
    } catch (err) {
      console.error('Seeding check failed on Vercel:', err.message);
    }
  }).catch(err => console.error('DB connection error on Vercel:', err));
} else {
  startServer();
}

// Export app for Vercel serverless (needs plain Express app, not {app,server})
module.exports = app;
