const assert = require('assert');
const {
  validateContentType,
  validateNonEmptyContent,
  validateAnalysisJsonContent
} = require('../../ui/domain/content-domain.js');

function run() {
  const typeOk = validateContentType('concept');
  assert.strictEqual(typeOk.ok, true);

  const typeBad = validateContentType('unknown');
  assert.strictEqual(typeBad.ok, false);

  const textOk = validateNonEmptyContent(' hello ');
  assert.strictEqual(textOk.ok, true);
  assert.strictEqual(textOk.value, 'hello');

  const textBad = validateNonEmptyContent('   ');
  assert.strictEqual(textBad.ok, false);

  const analysisOk = validateAnalysisJsonContent(JSON.stringify({
    version: '1',
    duration: 120,
    bpm: 120,
    sections: []
  }));
  assert.strictEqual(analysisOk.ok, true);

  const analysisBadJson = validateAnalysisJsonContent('{bad json');
  assert.strictEqual(analysisBadJson.ok, false);

  const analysisBadFields = validateAnalysisJsonContent(JSON.stringify({ version: '1' }));
  assert.strictEqual(analysisBadFields.ok, false);

  console.log('content-domain.test.js passed');
}

run();
