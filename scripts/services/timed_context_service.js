const MAX_DEFAULT_SNIPPET_CHARS = 420;
const MAX_DEFAULT_SECTION_CHARS = 220;

function asNumber(value, fallback = null) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeSectionTiming(section = {}) {
  const start = asNumber(section.startTime, asNumber(section.start, asNumber(section.begin, 0)));
  const endFallback = start + Math.max(0, asNumber(section.duration, 0));
  const end = asNumber(section.endTime, asNumber(section.end, asNumber(section.stop, endFallback)));
  return {
    start: Number.isFinite(start) ? start : 0,
    end: Number.isFinite(end) ? end : (Number.isFinite(start) ? start : 0)
  };
}

function normalizeAnalysisSections(analysis = {}, songInfo = '') {
  const sections = Array.isArray(analysis.sections) ? analysis.sections : [];
  const normalized = sections
    .map((section, idx) => {
      const timing = normalizeSectionTiming(section);
      const text = normalizeText(section.transcript || section.lyrics || section.notes || '');
      return {
        id: section.id || section.name || `section_${idx + 1}`,
        label: section.label || section.name || section.id || `Section ${idx + 1}`,
        start: timing.start,
        end: timing.end,
        duration: Math.max(0, timing.end - timing.start),
        text
      };
    })
    .filter((section) => Number.isFinite(section.start) && Number.isFinite(section.end) && section.end >= section.start);

  if (normalized.length === 0) {
    const fallback = normalizeText(songInfo);
    if (!fallback) return [];
    return [{
      id: 'song_info',
      label: 'Song Info',
      start: 0,
      end: asNumber(analysis.duration, 0) || 0,
      duration: asNumber(analysis.duration, 0) || 0,
      text: fallback
    }];
  }

  return normalized;
}

function getShotTimingRange(shotLike = {}) {
  const timing = shotLike.timing || shotLike;
  const start = asNumber(timing.startTime, asNumber(timing.start, 0));
  const endFromDuration = Number.isFinite(start)
    ? start + Math.max(0, asNumber(timing.duration, 0))
    : 0;
  const end = asNumber(timing.endTime, asNumber(timing.end, endFromDuration));
  return {
    start: Number.isFinite(start) ? start : 0,
    end: Number.isFinite(end) ? end : 0,
    musicSection: typeof timing.musicSection === 'string' ? timing.musicSection.trim() : ''
  };
}

function computeOverlapSeconds(aStart, aEnd, bStart, bEnd) {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return Math.max(0, end - start);
}

function chooseSectionMatches(input) {
  const shotRange = input.shotRange || { start: 0, end: 0, musicSection: '' };
  const sections = Array.isArray(input.sections) ? input.sections : [];
  const maxSections = Math.max(1, Math.floor(asNumber(input.maxSections, 2) || 2));
  const preferredSectionId = normalizeText(input.preferredSectionId);

  const withScores = sections.map((section) => {
    const overlapSeconds = computeOverlapSeconds(shotRange.start, shotRange.end, section.start, section.end);
    const shotCenter = (shotRange.start + shotRange.end) / 2;
    const secCenter = (section.start + section.end) / 2;
    const centerDistance = Math.abs(shotCenter - secCenter);
    const preferredBoost = preferredSectionId && (section.id === preferredSectionId || section.label === preferredSectionId) ? 1000 : 0;
    return {
      ...section,
      overlapSeconds,
      centerDistance,
      score: preferredBoost + (overlapSeconds * 100) - centerDistance
    };
  });

  const overlaps = withScores
    .filter((section) => section.overlapSeconds > 0)
    .sort((a, b) => b.score - a.score);

  if (overlaps.length > 0) {
    return overlaps.slice(0, maxSections);
  }

  const closest = withScores
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSections);

  return closest;
}

function resolveTimedTranscriptForShot(input = {}) {
  const analysis = input.analysis || {};
  const songInfo = input.songInfo || '';
  const shot = input.shot || {};
  const maxSnippetChars = Math.max(120, Math.floor(asNumber(input.maxSnippetChars, MAX_DEFAULT_SNIPPET_CHARS) || MAX_DEFAULT_SNIPPET_CHARS));
  const maxSectionChars = Math.max(80, Math.floor(asNumber(input.maxSectionChars, MAX_DEFAULT_SECTION_CHARS) || MAX_DEFAULT_SECTION_CHARS));
  const maxSections = Math.max(1, Math.floor(asNumber(input.maxSections, 2) || 2));
  const preferredSectionId = normalizeText(input.preferredSectionId || shot?.timing?.musicSection || '');

  const sections = normalizeAnalysisSections(analysis, songInfo);
  const shotRange = getShotTimingRange(shot);
  const matches = chooseSectionMatches({
    shotRange,
    sections,
    maxSections,
    preferredSectionId
  });

  const snippetParts = [];
  matches.forEach((match) => {
    const text = normalizeText(match.text);
    if (!text) return;
    if (snippetParts.includes(text)) return;
    snippetParts.push(text.slice(0, maxSectionChars));
  });

  let snippet = snippetParts.join(' ');
  if (!snippet && normalizeText(songInfo)) {
    snippet = normalizeText(songInfo).slice(0, maxSnippetChars);
  }
  if (snippet.length > maxSnippetChars) {
    snippet = snippet.slice(0, maxSnippetChars);
  }

  return {
    shotRange,
    snippet,
    matches: matches.map((match) => ({
      id: match.id,
      label: match.label,
      start: match.start,
      end: match.end,
      overlapSeconds: match.overlapSeconds,
      text: normalizeText(match.text).slice(0, maxSectionChars)
    }))
  };
}

module.exports = {
  normalizeAnalysisSections,
  getShotTimingRange,
  resolveTimedTranscriptForShot
};
