const assert = require('assert');
const {
  normalizeAnalysisSections,
  getShotTimingRange,
  resolveTimedTranscriptForShot
} = require('../../scripts/services/timed_context_service');

function run() {
  const analysis = {
    sections: [
      { id: 'verse_1', startTime: 0, endTime: 10, lyrics: 'Verse line one and two' },
      { id: 'chorus_1', startTime: 10, endTime: 20, lyrics: 'Chorus hook lyric goes here' }
    ]
  };

  const normalized = normalizeAnalysisSections(analysis, '');
  assert.strictEqual(normalized.length, 2, 'Expected two normalized sections');
  assert.strictEqual(normalized[0].id, 'verse_1');
  assert.strictEqual(normalized[1].start, 10);

  const shotRange = getShotTimingRange({ timing: { startTime: 12, endTime: 16, musicSection: 'chorus_1' } });
  assert.strictEqual(shotRange.start, 12);
  assert.strictEqual(shotRange.end, 16);
  assert.strictEqual(shotRange.musicSection, 'chorus_1');

  const resolved = resolveTimedTranscriptForShot({
    analysis,
    shot: { timing: { startTime: 12, endTime: 16, musicSection: 'chorus_1' } }
  });
  assert.ok(resolved.snippet.includes('Chorus hook lyric'), 'Expected overlap snippet from chorus section');
  assert.strictEqual(resolved.matches[0].id, 'chorus_1', 'Expected chorus section to rank first');

  const fallback = resolveTimedTranscriptForShot({
    analysis: {},
    songInfo: 'Fallback song info line',
    shot: { timing: { startTime: 30, endTime: 35 } }
  });
  assert.ok(fallback.snippet.includes('Fallback song info line'), 'Expected song_info fallback snippet');

  console.log('timed-context-service.test.js passed');
}

run();
