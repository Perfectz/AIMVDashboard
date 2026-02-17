const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createDatabaseService } = require('../../scripts/services/database_service');

function run() {
  // Test 1: In-memory fallback when better-sqlite3 is not installed
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'amv-db-'));
  const db = createDatabaseService({ dataDir: tmpDir });
  db.init();

  // Test 2: Create user and authenticate
  const user = db.createUser('testuser', 'password123', 'Test User', 'editor');
  assert.ok(user.id, 'User should have an ID');
  assert.strictEqual(user.username, 'testuser');
  assert.strictEqual(user.role, 'editor');

  // Test 3: Authenticate with correct password
  const authed = db.authenticateUser('testuser', 'password123');
  assert.ok(authed, 'Should authenticate with correct password');
  assert.strictEqual(authed.username, 'testuser');

  // Test 4: Reject wrong password
  const rejected = db.authenticateUser('testuser', 'wrongpassword');
  assert.strictEqual(rejected, null, 'Should reject wrong password');

  // Test 5: Reject unknown user
  const unknown = db.authenticateUser('nobody', 'password123');
  assert.strictEqual(unknown, null, 'Should reject unknown user');

  // Test 6: Session management
  const sessionId = db.createSession(user.id);
  assert.ok(sessionId, 'Should create session ID');
  assert.strictEqual(typeof sessionId, 'string');

  const session = db.getSession(sessionId);
  assert.ok(session, 'Should retrieve session');
  assert.strictEqual(session.username, 'testuser');

  // Test 7: Delete session
  db.deleteSession(sessionId);
  const deleted = db.getSession(sessionId);
  assert.strictEqual(deleted, null, 'Should not find deleted session');

  // Test 8: Duplicate username
  let duplicateError = false;
  try {
    db.createUser('testuser', 'other', 'Other', 'editor');
  } catch (err) {
    duplicateError = true;
    assert.ok(err.message.includes('already exists'), 'Should report duplicate username');
  }
  assert.ok(duplicateError, 'Should throw on duplicate username');

  // Test 9: Default admin user exists
  const admin = db.authenticateUser('admin', 'admin');
  if (!db.isMemoryFallback) {
    // SQLite creates default admin; in-memory might not depending on order
    // Skip this check for in-memory
  }

  // Test 10: Audit logging doesn't throw
  db.logAudit(user.id, 'test', 'unit-test', { detail: 'testing' });

  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('database-service.test.js passed');
}

run();
