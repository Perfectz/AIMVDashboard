/**
 * Review metadata normalization service.
 * Extracted from serve_ui.js — Phase 4 architecture optimization.
 */

const REVIEW_STATUSES = new Set(['draft', 'in_review', 'approved', 'changes_requested']);
const MAX_COMMENT_AUTHOR_LENGTH = 60;
const MAX_COMMENT_TEXT_LENGTH = 1000;

function normalizeReviewStatus(value) {
  return REVIEW_STATUSES.has(value) ? value : 'draft';
}

function normalizeComment(comment) {
  if (!comment || typeof comment !== 'object') return null;

  const author = typeof comment.author === 'string' ? comment.author.trim() : '';
  const text = typeof comment.text === 'string' ? comment.text.trim() : '';
  const timestamp = typeof comment.timestamp === 'string' && comment.timestamp.trim()
    ? comment.timestamp
    : new Date().toISOString();

  if (!author || !text) {
    return null;
  }

  if (author.length > MAX_COMMENT_AUTHOR_LENGTH || text.length > MAX_COMMENT_TEXT_LENGTH) {
    return null;
  }

  return { author, text, timestamp };
}

function sanitizeReviewMetadata(payload = {}) {
  return {
    reviewStatus: normalizeReviewStatus(payload.reviewStatus),
    comments: Array.isArray(payload.comments)
      ? payload.comments.map(normalizeComment).filter(Boolean)
      : [],
    assignee: typeof payload.assignee === 'string'
      ? payload.assignee.trim()
      : ''
  };
}

function getReviewMetadataMap(sequence) {
  const metadata = {};
  if (!sequence || !Array.isArray(sequence.selections)) {
    return metadata;
  }

  sequence.selections.forEach((shot) => {
    if (!shot || !shot.shotId) return;
    const normalized = sanitizeReviewMetadata(shot);
    shot.reviewStatus = normalized.reviewStatus;
    shot.comments = normalized.comments;
    shot.assignee = normalized.assignee;
    metadata[shot.shotId] = normalized;
  });

  return metadata;
}

module.exports = {
  REVIEW_STATUSES,
  MAX_COMMENT_AUTHOR_LENGTH,
  MAX_COMMENT_TEXT_LENGTH,
  normalizeReviewStatus,
  normalizeComment,
  sanitizeReviewMetadata,
  getReviewMetadataMap
};
