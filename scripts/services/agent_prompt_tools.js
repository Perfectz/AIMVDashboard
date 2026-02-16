const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const projectManager = require('../project_manager');
const { resolveTimedTranscriptForShot } = require('./timed_context_service');

function safeReadJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function inferShotNumber(shotId, shotObj = null) {
  const id = String(shotId || '');
  const match = id.match(/^SHOT_(\d{1,4})$/i);
  if (match) return String(Number(match[1])).padStart(2, '0');
  if (shotObj && Number.isFinite(shotObj.shotNumber)) {
    return String(shotObj.shotNumber).padStart(2, '0');
  }
  return '01';
}

function resolvePromptTargetPath(projectPath, shotId, variation, tool = 'seedream') {
  const index = safeReadJson(path.join(projectPath, 'prompts_index.json'), {});
  const shot = Array.isArray(index.shots) ? index.shots.find((s) => s && s.shotId === shotId) : null;
  if (shot && shot.variations && Array.isArray(shot.variations[tool])) {
    const exact = shot.variations[tool].find((v) => v && String(v.variation || '').toUpperCase() === variation);
    if (exact && exact.path) return exact.path;
    const first = shot.variations[tool][0];
    if (first && first.path) return first.path;
  }

  const shotNumber = inferShotNumber(shotId);
  return `prompts/${tool}/shot_${shotNumber}_${variation}.txt`;
}

function loadShotContext(input) {
  const projectId = input.projectId;
  const shotId = input.shotId;
  const variation = String(input.variation || 'A').toUpperCase();
  const tool = (input.tool || 'seedream').toLowerCase();

  const projectPath = projectManager.getProjectPath(projectId);
  const shotList = safeReadJson(path.join(projectPath, 'bible', 'shot_list.json'), {});
  const characters = safeReadJson(path.join(projectPath, 'bible', 'characters.json'), {});
  const locations = safeReadJson(path.join(projectPath, 'bible', 'locations.json'), {});
  const visualStyle = safeReadJson(path.join(projectPath, 'bible', 'visual_style.json'), {});
  const analysis = safeReadJson(path.join(projectPath, 'music', 'analysis.json'), {});
  const songInfo = fs.existsSync(path.join(projectPath, 'music', 'song_info.txt'))
    ? fs.readFileSync(path.join(projectPath, 'music', 'song_info.txt'), 'utf8')
    : '';

  const shots = Array.isArray(shotList.shots) ? shotList.shots : [];
  const shot = shots.find((s) => s && (s.id === shotId || s.shotId === shotId));
  if (!shot) {
    throw new Error(`Shot '${shotId}' not found in bible/shot_list.json`);
  }

  const promptRelativePath = resolvePromptTargetPath(projectPath, shotId, variation, tool);
  const promptAbsPath = path.resolve(projectPath, promptRelativePath);
  const existingPrompt = fs.existsSync(promptAbsPath) ? fs.readFileSync(promptAbsPath, 'utf8') : '';

  const charMap = new Map((characters.characters || []).map((c) => [c.id, c]));
  const locMap = new Map((locations.locations || []).map((l) => [l.id, l]));

  const characterContext = (shot.characters || []).map((ref) => {
    const c = charMap.get(ref.id) || {};
    return {
      id: ref.id || '',
      name: c.name || ref.id || '',
      prominence: ref.prominence || '',
      action: ref.action || '',
      look: c.look || '',
      physicalCore: c.physicalCore || {}
    };
  });
  const locationContext = shot.location ? (locMap.get(shot.location.id) || shot.location) : null;
  const transcriptContext = resolveTimedTranscriptForShot({
    shot,
    analysis,
    songInfo,
    preferredSectionId: shot?.timing?.musicSection || ''
  });

  return {
    projectId,
    projectPath,
    shotId,
    variation,
    tool,
    promptRelativePath,
    existingPrompt,
    shot,
    characterContext,
    locationContext,
    visualStyle,
    transcriptContext
  };
}

const MAX_INTENT_FIELD_CHARS = 600;
const MAX_TRANSCRIPT_SNIPPET_CHARS = 520;
const MAX_INSTRUCTION_CHARS = 1600;
const MAX_EXISTING_PROMPT_CHARS = 6000;
const MAX_CHARACTER_LOOK_CHARS = 260;
const MAX_LOCATION_FIELD_CHARS = 260;
const MAX_STYLE_SECTION_CHARS = 360;
const MAX_STYLE_JSON_CHARS = 2400;

function truncateText(value, maxChars) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const max = Math.max(1, Number(maxChars) || 1);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 3)).trim()}...`;
}

function compactCharacterContext(list) {
  const chars = Array.isArray(list) ? list : [];
  return chars.slice(0, 6).map((char) => ({
    id: char.id || '',
    name: char.name || '',
    prominence: char.prominence || '',
    action: truncateText(char.action || '', 180),
    look: truncateText(char.look || '', MAX_CHARACTER_LOOK_CHARS),
    physicalCore: char.physicalCore && typeof char.physicalCore === 'object'
      ? {
          face: truncateText(char.physicalCore.face || '', 120),
          body: truncateText(char.physicalCore.body || '', 120),
          silhouette: truncateText(char.physicalCore.silhouette || '', 120)
        }
      : {}
  }));
}

function compactLocationContext(location) {
  const loc = location && typeof location === 'object' ? location : {};
  return {
    id: loc.id || '',
    name: loc.name || '',
    visualDescription: truncateText(loc.visualDescription || loc.description || '', MAX_LOCATION_FIELD_CHARS),
    mood: truncateText(loc.mood || '', 140),
    lighting: truncateText(loc.lighting || '', 140)
  };
}

function compactVisualStyle(style) {
  const base = style && typeof style === 'object' ? style : {};
  const compact = {
    negativePromptBase: truncateText(base.negativePromptBase || '', MAX_STYLE_SECTION_CHARS),
    lookAndFeel: truncateText(base.lookAndFeel || '', MAX_STYLE_SECTION_CHARS),
    lighting: truncateText(base.lighting || '', MAX_STYLE_SECTION_CHARS),
    cameraLanguage: truncateText(base.cameraLanguage || '', MAX_STYLE_SECTION_CHARS)
  };
  const serialized = JSON.stringify(compact);
  if (serialized.length <= MAX_STYLE_JSON_CHARS) return compact;
  return {
    negativePromptBase: compact.negativePromptBase,
    lookAndFeel: compact.lookAndFeel
  };
}

function buildAgentMessages(context, instruction = '') {
  const system = [
    'You are a prompt compiler agent for AI music video generation.',
    'Never invent unrelated canon.',
    'Use only provided shot/canon context.',
    'Return plain prompt file content only (no markdown fences).',
    'Include section markers if existing prompt uses them.',
    'Keep style consistent with existing project prompts.'
  ].join(' ');

  const compactCharacters = compactCharacterContext(context.characterContext || []);
  const compactLocation = compactLocationContext(context.locationContext || {});
  const compactStyle = compactVisualStyle(context.visualStyle || {});
  const transcriptSnippet = truncateText(context.transcriptContext?.snippet || '', MAX_TRANSCRIPT_SNIPPET_CHARS);
  const matchedSections = (context.transcriptContext?.matches || []).slice(0, 4).map((m) => ({
    id: m.id,
    label: truncateText(m.label || '', 80),
    start: m.start,
    end: m.end,
    overlapSeconds: m.overlapSeconds
  }));
  const intentWhat = truncateText(context.shot?.intent?.what || '', MAX_INTENT_FIELD_CHARS);
  const intentWhy = truncateText(context.shot?.intent?.why || '', MAX_INTENT_FIELD_CHARS);
  const emotionalBeat = truncateText(context.shot?.intent?.emotionalBeat || '', 180);
  const timingSection = truncateText(context.shot?.timing?.musicSection || '', 120);
  const boundedInstruction = truncateText(instruction || '', MAX_INSTRUCTION_CHARS);
  const existingPromptRaw = String(context.existingPrompt || '');
  const existingPrompt = truncateText(existingPromptRaw, MAX_EXISTING_PROMPT_CHARS);

  const user = [
    `Generate an updated prompt for ${context.shotId} variation ${context.variation} tool ${context.tool}.`,
    `Shot intent WHAT: ${intentWhat}`,
    `Shot intent WHY: ${intentWhy}`,
    `Emotional beat: ${emotionalBeat}`,
    `Timing section: ${timingSection}`,
    `Timing range: ${context.transcriptContext?.shotRange?.start ?? ''}-${context.transcriptContext?.shotRange?.end ?? ''}s`,
    `Transcript snippet: ${transcriptSnippet}`,
    `Matched transcript sections: ${JSON.stringify(matchedSections)}`,
    `Characters: ${JSON.stringify(compactCharacters)}`,
    `Location: ${JSON.stringify(compactLocation)}`,
    `Visual style: ${JSON.stringify(compactStyle)}`,
    boundedInstruction ? `Additional instruction: ${boundedInstruction}` : '',
    context.existingPrompt ? `Existing prompt to preserve structure:\n${existingPrompt}` : 'No existing prompt file yet.',
    `Context budget summary: ${JSON.stringify({
      characterCount: (context.characterContext || []).length,
      transcriptMatchCount: (context.transcriptContext?.matches || []).length,
      existingPromptChars: existingPromptRaw.length,
      existingPromptTruncated: existingPromptRaw.length > existingPrompt.length,
      instructionChars: String(instruction || '').length,
      instructionTruncated: String(instruction || '').length > boundedInstruction.length
    })}`
  ].filter(Boolean).join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

function buildFallbackPrompt(context, instruction = '') {
  const shot = context.shot || {};
  const intentWhat = shot.intent?.what || 'Visual storytelling beat';
  const intentWhy = shot.intent?.why || 'Support narrative flow';
  const emotion = shot.intent?.emotionalBeat || 'cinematic';
  const section = shot.timing?.musicSection || 'unknown';
  const neg = context.visualStyle?.negativePromptBase || 'no text, no logos, no watermark';
  const notes = [shot.notes, instruction].filter(Boolean).join(' | ');

  return [
    `=== SHOT ${context.shotId} - Variation ${context.variation} (Agent) ===`,
    `Shot: ${context.shotId} | Section: ${section}`,
    `Version: ${new Date().toISOString().slice(0, 10)}`,
    `Variation: ${context.variation}`,
    '',
    `--- ${context.tool.toUpperCase()} PROMPT ---`,
    '',
    `Scene: ${intentWhat}.`,
    `Purpose: ${intentWhy}.`,
    `Mood: ${emotion}.`,
    `Characters: ${(context.characterContext || []).map((c) => `${c.name || c.id} (${c.action || 'present'})`).join(', ') || 'none specified'}.`,
    `Location: ${context.locationContext?.name || context.locationContext?.id || 'unspecified'}.`,
    '',
    '--- NEGATIVE PROMPT ---',
    '',
    neg,
    notes ? `\n--- DIRECTOR NOTES ---\n\n${notes}\n` : ''
  ].join('\n');
}

function validateSeedreamPromptStructure(content) {
  const errors = [];
  const warnings = [];
  const text = String(content || '').trim();

  if (!text) {
    errors.push('Prompt content is empty');
    return { ok: false, errors, warnings };
  }

  if (!/^===\s*SHOT\s+/im.test(text)) {
    errors.push('Missing shot header (=== SHOT ... ===)');
  }
  if (!/Variation:\s*[A-D]/i.test(text)) {
    errors.push('Missing variation metadata (Variation: A-D)');
  }
  if (!/---\s*SEEDREAM\s+PROMPT\s*---/i.test(text)) {
    errors.push('Missing --- SEEDREAM PROMPT --- section');
  }
  if (!/---\s*NEGATIVE\s+PROMPT\s*---/i.test(text)) {
    errors.push('Missing --- NEGATIVE PROMPT --- section');
  }

  const promptMatch = text.match(/---\s*SEEDREAM\s+PROMPT\s*---\s*\n([\s\S]*?)(?=---\s*NEGATIVE\s+PROMPT\s*---|$)/i);
  const promptBody = promptMatch ? String(promptMatch[1] || '').trim() : '';
  if (!promptBody) {
    errors.push('SeedDream prompt body is empty');
  } else {
    if (promptBody.length < 140) warnings.push('SeedDream prompt body is very short');
    if (promptBody.length > 3000) errors.push('SeedDream prompt body is too long (>3000 chars)');
    if (!/Create\s+\d+\s+Images?/i.test(promptBody) && !/Scene:/i.test(promptBody)) {
      warnings.push('Prompt body is missing expected "Create N Images" or scene directives');
    }
  }

  const negativeMatch = text.match(/---\s*NEGATIVE\s+PROMPT\s*---\s*\n([\s\S]*?)(?=---\s*DIRECTOR\s+NOTES\s*---|$)/i);
  const negativeBody = negativeMatch ? String(negativeMatch[1] || '').trim() : '';
  if (!negativeBody) {
    errors.push('Negative prompt section is empty');
  } else if (negativeBody.length < 12) {
    warnings.push('Negative prompt appears too short');
  }

  if (/```/.test(text)) {
    warnings.push('Prompt contains markdown fences; plain text is preferred');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}

function validatePromptStructure(content, tool = 'seedream') {
  const errors = [];
  const warnings = [];
  const text = String(content || '').trim();

  if (String(tool || '').toLowerCase() === 'seedream') {
    return validateSeedreamPromptStructure(text);
  }

  if (!text) errors.push('Prompt content is empty');
  if (text.length < 80) warnings.push('Prompt appears very short');
  if (!/PROMPT/i.test(text)) warnings.push('Prompt marker not found');

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}

function refreshIndex(projectId) {
  const root = path.join(__dirname, '..', '..');
  const scriptPath = path.join(root, 'scripts', 'generate_index.js');
  const result = spawnSync(process.execPath, [scriptPath, projectId], {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8'
  });

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

module.exports = {
  loadShotContext,
  buildAgentMessages,
  buildFallbackPrompt,
  validatePromptStructure,
  validateSeedreamPromptStructure,
  refreshIndex,
  resolvePromptTargetPath
};
