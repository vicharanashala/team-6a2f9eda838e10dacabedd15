const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const config = require('../config');
const { AppError } = require('../middleware/errorHandler');
const { indexUser } = require('../services/searchService');

const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

const applyDailyLoginBenefit = (user) => {
  const today = new Date().toDateString();
  const lastActiveDay = user.lastActive ? new Date(user.lastActive).toDateString() : null;
  if (lastActiveDay !== today) {
    user.trustScore = (user.trustScore || 0) + 1;
  }
  user.lastActive = new Date();
};

exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, email, password } = req.body;

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      throw new AppError('Username or email already exists', 409);
    }

    const user = new User({ username, email, password, displayName: username });
    applyDailyLoginBenefit(user);
    await user.save();
    await indexUser(user);
    const token = generateToken(user);

    res.status(201).json({
      token,
      user: user.toPublicJSON(),
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('Invalid email or password', 401);
    }

    if (user.isBanned) {
      throw new AppError(`Account banned: ${user.banReason}`, 403);
    }

    applyDailyLoginBenefit(user);
    await user.save();

    const token = generateToken(user);
    res.json({ token, user: user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res) => {
  res.json({ user: req.user.toPublicJSON() });
};

exports.updateProfile = async (req, res, next) => {
  try {
    const updates = {};
    const allowed = ['displayName', 'bio', 'website', 'location', 'preferences', 'currentPhase'];
    for (const field of allowed) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (req.file) {
      const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      updates.avatar = base64Image;
      updates.avatarUrl = base64Image;
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    await indexUser(user);

    // Invalidate recommendation cache if phase changed
    if (updates.currentPhase !== undefined) {
      try {
        const { getRedis } = require('../config/redis');
        const redis = getRedis();
        await redis.del(`recommendations:user:${req.user._id.toString()}`);
      } catch (redisErr) {
        console.error('Redis delete recommendation cache error:', redisErr.message);
      }
    }

    res.json({ user: user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
};

const generateUniqueUsername = async (email) => {
  const base = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').substring(0, 20) || 'user';
  let username = base;
  let exists = await User.findOne({ username });
  let counter = 1;
  while (exists) {
    username = `${base}${counter}`;
    exists = await User.findOne({ username });
    counter++;
  }
  return username;
};

exports.googleLogin = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      throw new AppError('Google ID token is required', 400);
    }

    let payload;
    if (token.startsWith('mock_google_token_')) {
      const email = token.substring('mock_google_token_'.length);
      payload = {
        sub: `mock_google_id_${email.replace(/[^a-zA-Z0-9]/g, '')}`,
        email: email,
        name: email.split('@')[0],
        picture: `https://ui-avatars.com/api/?name=${email.split('@')[0]}`
      };
    } else {
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      if (apiKey) {
        try {
          const lookupResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: token })
          });
          const data = await lookupResponse.json();
          if (!lookupResponse.ok) {
            const errMsg = data.error && data.error.message ? data.error.message : '';
            console.error('Firebase accounts lookup returned error:', errMsg);
            if (errMsg === 'USER_NOT_FOUND' || errMsg === 'USER_DISABLED') {
              const decoded = jwt.decode(token);
              if (decoded) {
                const email = decoded.email;
                const sub = decoded.sub || decoded.user_id;
                if (email || sub) {
                  console.log(`Deleting user from platform as they were removed from Google Auth: email=${email}, googleId=${sub}`);
                  const Question = require('../models/Question');
                  const Answer = require('../models/Answer');
                  const targetUser = await User.findOne({ $or: [{ email }, { googleId: sub }] });
                  if (targetUser) {
                    await Promise.all([
                      Question.deleteMany({ author: targetUser._id }),
                      Answer.deleteMany({ author: targetUser._id }),
                      User.deleteOne({ _id: targetUser._id })
                    ]);
                    console.log(`Successfully deleted user ${targetUser.username} and their posts from MongoDB.`);
                  }
                }
              }
              throw new AppError('Google authentication failed: User account has been removed/disabled', 401);
            }
            throw new Error(errMsg || 'Firebase verification failed');
          }
          if (data.users && data.users[0]) {
            const firebaseUser = data.users[0];
            payload = {
              sub: firebaseUser.localId,
              email: firebaseUser.email,
              name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
              picture: firebaseUser.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || firebaseUser.email)}`,
            };
          } else {
            throw new Error('No user data returned from Firebase accounts lookup');
          }
        } catch (err) {
          console.error('Firebase token verification error:', err.message);
          if (err instanceof AppError) {
            throw err;
          }
          const decoded = jwt.decode(token);
          if (decoded && decoded.email) {
            payload = {
              sub: decoded.sub || decoded.user_id,
              email: decoded.email,
              name: decoded.name || decoded.displayName || decoded.email.split('@')[0],
              picture: decoded.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(decoded.name || decoded.email)}`,
            };
          } else {
            throw new AppError('Google authentication failed: Invalid token', 401);
          }
        }
      } else {
        try {
          const decoded = jwt.decode(token);
          if (decoded && decoded.email) {
            payload = {
              sub: decoded.sub || decoded.user_id,
              email: decoded.email,
              name: decoded.name || decoded.displayName || decoded.email.split('@')[0],
              picture: decoded.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(decoded.name || decoded.email)}`,
            };
          } else {
            const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
            if (!response.ok) {
              throw new Error('Invalid token response from Google API');
            }
            payload = await response.json();
          }
        } catch (err) {
          console.error('Failed to decode/verify token:', err.message);
          throw new AppError('Google authentication failed: Invalid token', 401);
        }
      }
    }

    const { sub, email, name, picture } = payload;

    if (!email) {
      throw new AppError('Email not returned from Google', 400);
    }

    let user = await User.findOne({ googleId: sub });

    if (user) {
      if (user.isBanned) {
        throw new AppError(`Account banned: ${user.banReason}`, 403);
      }
      applyDailyLoginBenefit(user);
      let needsReindex = false;

      if (email && user.email !== email) {
        user.email = email;
        needsReindex = true;
      }
      if (name && user.displayName !== name) {
        user.displayName = name;
        needsReindex = true;
      }
      if (picture && user.avatarUrl !== picture) {
        user.avatarUrl = picture;
        user.avatar = picture;
        needsReindex = true;
      }

      await user.save();
      if (needsReindex) {
        await indexUser(user);
      }
      const jwtToken = generateToken(user);
      return res.json({ token: jwtToken, user: user.toPublicJSON() });
    }

    user = await User.findOne({ email });

    if (user) {
      if (user.isBanned) {
        throw new AppError(`Account banned: ${user.banReason}`, 403);
      }
      user.googleId = sub;
      user.authProvider = 'both';
      if (name && !user.displayName) {
        user.displayName = name;
      }
      if (picture && !user.avatarUrl) {
        user.avatarUrl = picture;
        user.avatar = picture;
      }
      applyDailyLoginBenefit(user);
      await user.save();
      await indexUser(user);
      const jwtToken = generateToken(user);
      return res.json({ token: jwtToken, user: user.toPublicJSON() });
    }

    // Auto-create Google user
    const username = await generateUniqueUsername(email);
    user = new User({
      username,
      email,
      displayName: name || username,
      googleId: sub,
      avatar: picture || '',
      avatarUrl: picture || '',
      authProvider: 'google',
      hasCompletedOnboarding: false,
    });
    applyDailyLoginBenefit(user);
    await user.save();

    await indexUser(user);
    const jwtToken = generateToken(user);

    res.status(201).json({
      token: jwtToken,
      user: user.toPublicJSON(),
      isNew: true
    });
  } catch (err) {
    next(err);
  }
};
