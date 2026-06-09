const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

let io = null;

const setupSocket = (server) => {
  // Accept connections on both /socket.io (local) and /_/backend/socket.io (Vercel routing)
  io = new Server(server, {
    path: '/socket.io',
    cors: {
      origin: [
        config.clientUrl,
        /\.vercel\.app$/,
        /localhost:\d+/,
        'https://prashnasarathi.vercel.app',
      ],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });

  // Also attach a second server path for Vercel's /_/backend prefix routing
  const io2 = new Server(server, {
    path: '/_/backend/socket.io',
    cors: {
      origin: [
        config.clientUrl,
        /\.vercel\.app$/,
        /localhost:\d+/,
        'https://prashnasarathi.vercel.app',
      ],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });

  const authMiddleware = async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) return next(new Error('No token'));
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  };

  const connectionHandler = (socket) => {
    const userId = socket.user._id.toString();
    socket.join(`user:${userId}`);
    if (socket.user.role === 'admin' || socket.user.role === 'moderator') {
      socket.join('admin');
      console.log(`[Socket] Admin/Moderator joined admin room: ${socket.user.username}`);
    } else {
      console.log(`[Socket] User connected: ${socket.user.username} (${socket.nsp.name})`);
    }

    socket.on('join:question', (questionId) => {
      socket.join(`question:${questionId}`);
    });

    socket.on('leave:question', (questionId) => {
      socket.leave(`question:${questionId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${socket.user.username}`);
    });
  };

  io.use(authMiddleware);
  io.on('connection', connectionHandler);

  // Mirror all events on the Vercel-prefixed server too
  io2.use(authMiddleware);
  io2.on('connection', (socket) => {
    connectionHandler(socket);
    // Bridge events to the primary io instance so emitToUser still works
    const userId = socket.user._id.toString();
    socket.join(`user:${userId}`);
    if (socket.user.role === 'admin' || socket.user.role === 'moderator') {
      socket.join('admin');
    }
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

const emitToQuestion = (questionId, event, data) => {
  if (io) {
    io.to(`question:${questionId}`).emit(event, data);
  }
};

const emitToAdmin = (event, data) => {
  if (io) {
    io.to('admin').emit(event, data);
  }
};

const broadcastAlert = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

module.exports = { setupSocket, getIO, emitToUser, emitToQuestion, emitToAdmin, broadcastAlert };
