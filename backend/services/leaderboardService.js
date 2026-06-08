const User = require('../models/User');
const Answer = require('../models/Answer');
const { getIO } = require('../socket');

const getLeaderboardData = async () => {
  // Primary: users who resolved doubts (accepted answers or solved-my-doubt votes)
  let leaderboard = await Answer.aggregate([
    { $match: { isDeleted: { $ne: true }, status: { $ne: 'deleted' }, $or: [{ isAccepted: true }, { solvedMyDoubtCount: { $gt: 0 } }] } },
    { $group: { 
        _id: '$author', 
        resolvedCount: { $sum: 1 }, 
        totalSolvedVotes: { $sum: '$solvedMyDoubtCount' } 
      } 
    },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $match: { 'user.isBanned': { $ne: true } } },
    { $addFields: {
        score: {
          $add: [
            { $multiply: ['$resolvedCount', 15] },
            { $multiply: ['$totalSolvedVotes', 5] },
            { $ifNull: ['$user.spurtiPoints', 0] },
            { $ifNull: ['$user.reputation', 0] }
          ]
        }
      }
    },
    { $sort: { score: -1, resolvedCount: -1 } },
    { $limit: 20 },
    { $project: {
        _id: 0,
        resolvedCount: 1,
        totalSolvedVotes: 1,
        score: 1,
        'user.username': 1,
        'user.displayName': 1,
        'user.avatar': 1,
        'user.reputation': 1,
        'user.spurtiPoints': 1,
    }}
  ]);

  // If we have fewer than 20 users with resolved counts, fill up the remaining spots with top reputation/spurtiPoints users
  if (leaderboard.length < 20) {
    const excludedUsernames = leaderboard
      .filter(row => row.user && row.user.username)
      .map(row => row.user.username);

    const remainingCount = 20 - leaderboard.length;
    const topUsers = await User.find({ 
      isBanned: { $ne: true },
      username: { $nin: excludedUsernames }
    })
      .sort({ spurtiPoints: -1, reputation: -1 })
      .limit(remainingCount)
      .select('username displayName avatar reputation spurtiPoints')
      .lean();

    const fallbackRows = topUsers.map(u => ({
      resolvedCount: 0,
      totalSolvedVotes: 0,
      score: (u.spurtiPoints || 0) + (u.reputation || 0),
      user: {
        username: u.username,
        displayName: u.displayName,
        avatar: u.avatar,
        reputation: u.reputation || 0,
        spurtiPoints: u.spurtiPoints || 0,
      }
    }));

    leaderboard = [...leaderboard, ...fallbackRows];
  }

  return leaderboard;
};

const broadcastLeaderboard = async () => {
  try {
    const data = await getLeaderboardData();
    const io = getIO();
    io.emit('leaderboard:update', { leaderboard: data });

    // Top 10 email notifications are disabled to prevent non-compliant outbound emails
  } catch (err) {
    // Socket might not be initialized yet during startup/seeding, ignore
    console.log('Socket not ready to broadcast leaderboard update.');
  }
};

module.exports = {
  getLeaderboardData,
  broadcastLeaderboard
};
