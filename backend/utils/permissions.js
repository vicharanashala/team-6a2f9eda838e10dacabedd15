const ROLES = {
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  USER: 'user',
};

const PERMISSIONS = {
  MANAGE_USERS: 'manage_users',
  MANAGE_SETTINGS: 'manage_settings',
  VIEW_ANALYTICS: 'view_analytics',
  DELETE_QUESTIONS: 'delete_questions',
  DELETE_ANSWERS: 'delete_answers',
  EDIT_ANY_QUESTION: 'edit_any_question',
  EDIT_ANY_ANSWER: 'edit_any_answer',
  CREATE_QUESTION: 'create_question',
  CREATE_ANSWER: 'create_answer',
  EDIT_OWN_QUESTION: 'edit_own_question',
  EDIT_OWN_ANSWER: 'edit_own_answer',
  DELETE_OWN_QUESTION: 'delete_own_question',
  DELETE_OWN_ANSWER: 'delete_own_answer',
  VIEW_PUBLIC_CONTENT: 'view_public_content',
  UPVOTE_DOWNVOTE: 'upvote_downvote',
  FLAG_CONTENT: 'flag_content',
  REVIEW_FLAGGED: 'review_flagged',
  APPROVE_POSTS: 'approve_posts',
  EDIT_TAGS: 'edit_tags',
  PIN_DISCUSSIONS: 'pin_discussions',
  CLOSE_QUESTIONS: 'close_questions',
  HIDE_QUESTIONS: 'hide_questions',
};

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.DELETE_QUESTIONS,
    PERMISSIONS.DELETE_ANSWERS,
    PERMISSIONS.EDIT_ANY_QUESTION,
    PERMISSIONS.EDIT_ANY_ANSWER,
    PERMISSIONS.CREATE_QUESTION,
    PERMISSIONS.CREATE_ANSWER,
    PERMISSIONS.EDIT_OWN_QUESTION,
    PERMISSIONS.EDIT_OWN_ANSWER,
    PERMISSIONS.DELETE_OWN_QUESTION,
    PERMISSIONS.DELETE_OWN_ANSWER,
    PERMISSIONS.VIEW_PUBLIC_CONTENT,
    PERMISSIONS.UPVOTE_DOWNVOTE,
    PERMISSIONS.FLAG_CONTENT,
    PERMISSIONS.REVIEW_FLAGGED,
    PERMISSIONS.APPROVE_POSTS,
    PERMISSIONS.EDIT_TAGS,
    PERMISSIONS.PIN_DISCUSSIONS,
    PERMISSIONS.CLOSE_QUESTIONS,
    PERMISSIONS.HIDE_QUESTIONS,
  ],
  [ROLES.MODERATOR]: [
    PERMISSIONS.REVIEW_FLAGGED,
    PERMISSIONS.APPROVE_POSTS,
    PERMISSIONS.EDIT_TAGS,
    PERMISSIONS.PIN_DISCUSSIONS,
    PERMISSIONS.CLOSE_QUESTIONS,
    PERMISSIONS.HIDE_QUESTIONS,
    PERMISSIONS.CREATE_QUESTION,
    PERMISSIONS.CREATE_ANSWER,
    PERMISSIONS.EDIT_OWN_QUESTION,
    PERMISSIONS.EDIT_OWN_ANSWER,
    PERMISSIONS.DELETE_OWN_QUESTION,
    PERMISSIONS.DELETE_OWN_ANSWER,
    PERMISSIONS.VIEW_PUBLIC_CONTENT,
    PERMISSIONS.UPVOTE_DOWNVOTE,
    PERMISSIONS.FLAG_CONTENT,
  ],
  [ROLES.USER]: [
    PERMISSIONS.CREATE_QUESTION,
    PERMISSIONS.CREATE_ANSWER,
    PERMISSIONS.EDIT_OWN_QUESTION,
    PERMISSIONS.EDIT_OWN_ANSWER,
    PERMISSIONS.DELETE_OWN_QUESTION,
    PERMISSIONS.DELETE_OWN_ANSWER,
    PERMISSIONS.VIEW_PUBLIC_CONTENT,
    PERMISSIONS.UPVOTE_DOWNVOTE,
    PERMISSIONS.FLAG_CONTENT,
  ],
};

const hasPermission = (userRole, permission) => {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes(permission);
};

const canDeleteQuestion = (user, question) => {
  if (user.role === ROLES.ADMIN) return true;
  if (user.role === ROLES.MODERATOR) return false;
  return question.author.toString() === user._id.toString();
};

const canEditQuestion = (user, question) => {
  if (user.role === ROLES.ADMIN) return true;
  if (user.role === ROLES.MODERATOR) return true;
  return question.author.toString() === user._id.toString();
};

const canModerate = (user) => {
  return user.role === ROLES.ADMIN || user.role === ROLES.MODERATOR;
};

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  canDeleteQuestion,
  canEditQuestion,
  canModerate,
};