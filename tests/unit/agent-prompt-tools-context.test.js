const assert = require('assert');
const { buildAgentMessages } = require('../../scripts/services/agent_prompt_tools');

function run() {
  const huge = 'X'.repeat(12000);
  const context = {
    shotId: 'SHOT_11',
    variation: 'B',
    tool: 'seedream',
    shot: {
      intent: {
        what: huge,
        why: huge,
        emotionalBeat: huge
      },
      timing: {
        musicSection: 'chorus_1'
      }
    },
    transcriptContext: {
      shotRange: { start: 12, end: 20 },
      snippet: huge,
      matches: [
        { id: 'chorus_1', label: huge, start: 10, end: 18, overlapSeconds: 6 },
        { id: 'chorus_2', label: huge, start: 18, end: 26, overlapSeconds: 2 }
      ]
    },
    characterContext: [
      {
        id: 'CHAR_01',
        name: 'Lead',
        prominence: 'primary',
        action: huge,
        look: huge,
        physicalCore: {
          face: huge,
          body: huge,
          silhouette: huge
        }
      }
    ],
    locationContext: {
      id: 'LOC_01',
      name: 'Neon Alley',
      visualDescription: huge,
      mood: huge
    },
    visualStyle: {
      negativePromptBase: huge,
      lookAndFeel: huge,
      lighting: huge,
      cameraLanguage: huge
    },
    existingPrompt: huge
  };

  const messages = buildAgentMessages(context, huge);
  assert.strictEqual(Array.isArray(messages), true, 'Messages should be an array');
  assert.strictEqual(messages.length, 2, 'Expected system + user messages');
  assert.strictEqual(messages[0].role, 'system');
  assert.strictEqual(messages[1].role, 'user');

  const userContent = String(messages[1].content || '');
  assert.ok(userContent.includes('Context budget summary:'), 'Expected budget summary marker in user content');
  assert.ok(userContent.includes('"existingPromptTruncated":true'), 'Expected existing prompt truncation flag');
  assert.ok(userContent.includes('"instructionTruncated":true'), 'Expected instruction truncation flag');
  assert.ok(userContent.length < 14000, 'Expected bounded user message length');

  console.log('agent-prompt-tools-context.test.js passed');
}

run();
