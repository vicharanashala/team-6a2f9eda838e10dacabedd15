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
    { $sort: { resolvedCount: -1, totalSolvedVotes: -1 } },
    { $limit: 20 },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $project: {
        _id: 0,
        resolvedCount: 1,
        totalSolvedVotes: 1,
        'user.username': 1,
        'user.displayName': 1,
        'user.avatar': 1,
        'user.reputation': 1,
    }}
  ]);

  // If we have fewer than 20 users with resolved counts, fill up the remaining spots with top reputation users
  if (leaderboard.length < 20) {
    const remainingCount = 20 - leaderboard.length;
    const excludedUsernames = leaderboard
      .filter(row => row.user && row.user.username)
      .map(row => row.user.username);

    const topUsers = await User.find({ 
      isBanned: { $ne: true },
      username: { $nin: excludedUsernames }
    })
      .sort({ reputation: -1 })
      .limit(remainingCount)
      .select('username displayName avatar reputation')
      .lean();

    const fallbackRows = topUsers.map(u => ({
      resolvedCount: 0,
      totalSolvedVotes: 0,
      user: {
        username: u.username,
        displayName: u.displayName,
        avatar: u.avatar,
        reputation: u.reputation || 0,
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

    // Handle Top 10 leaderboard email notifications
    try {
      const top10 = data.slice(0, 10);
      const { sendLeaderboardTop10Email } = require('./emailService');
      for (const row of top10) {
        if (row.user && row.user.username) {
          const userObj = await User.findOne({ username: row.user.username });
          if (userObj && !userObj.receivedTop10Email) {
            await sendLeaderboardTop10Email(userObj);
          }
        }
      }
    } catch (top10Err) {
      console.error('Error handling Top 10 email triggers:', top10Err.message);
    }
  } catch (err) {
    // Socket might not be initialized yet during startup/seeding, ignore
    console.log('Socket not ready to broadcast leaderboard update.');
  }
};

module.exports = {
  getLeaderboardData,
  broadcastLeaderboard
};
