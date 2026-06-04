const Question = require('../models/Question');
const Answer = require('../models/Answer');
const Report = require('../models/Report');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { AppError } = require('../middleware/errorHandler');

exports.reportPost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const validReasons = ["spam", "abusive", "off_topic", "duplicate", "harassment", "misleading"];
    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({ error: 'Invalid report reason', validReasons });
    }

    let post = await Question.findById(id);
    let postType = 'Question';

    if (!post) {
      post = await Answer.findById(id);
      postType = 'Answer';
    }

    if (!post || post.isDeleted) {
      throw new AppError('Post not found', 404);
    }

    // Check if user already reported this post
    const alreadyReported = post.reportedBy.some(userId => userId.toString() === req.user._id.toString());
    if (alreadyReported) {
      return res.status(400).json({ error: 'You have already reported this post' });
    }

    // Store report in Reports collection
    await Report.create({
      postId: post._id,
      postType,
      reportedBy: req.user._id,
      reason
    });

    // Add to post.reportedBy and increment reportCount
    post.reportedBy.push(req.user._id);
    post.reportCount = (post.reportCount || 0) + 1;

    // If reportCount >= 3 -> hide the post
    if (post.reportCount >= 3) {
      post.visibility = 'hidden';
      post.triggeredRule = 'report_threshold_exceeded';

      // Deduct trust score of the author: -10 for confirmed report
      const author = await User.findById(post.author);
      if (author) {
        author.trustScore = Math.max(0, author.trustScore - 10);
        await author.save();
      }

      // Notify admins
      const admins = await User.find({ role: 'admin' });
      const notifications = admins.map(admin => ({
        recipient: admin._id,
        type: 'post_hidden_reported',
        title: 'Post hidden due to multiple reports',
        message: `The post has been hidden automatically because it received 3+ community reports.`,
        link: `/questions/${postType === 'Question' ? post._id : post.question}`,
        referenceType: postType,
        reference: post._id
      }));
      await Notification.insertMany(notifications);
    }

    await post.save();

    try {
      const { emitToAdmin } = require('../socket');
      emitToAdmin('moderation:updated', { action: 'report_post', postType, postId: post._id });
    } catch (err) {
      console.error('Socket notification error in reportPost:', err.message);
    }

    res.json({ message: 'Post reported successfully', reportCount: post.reportCount });
  } catch (err) {
    next(err);
  }
};
