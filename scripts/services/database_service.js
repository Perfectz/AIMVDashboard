/**
 * Database Service — SQLite-backed persistent storage
 *
 * Provides session persistence, user management, and audit logging.
 * Uses better-sqlite3 for synchronous, zero-config embedded database.
 *
 * Falls back gracefully to in-memory mode if better-sqlite3 is not installed.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let Database;
try {
  Database = require('better-sqlite3');
} catch {
  Database = null;
}

function createDatabaseService({ dataDir }) {
  const dbPath = path.join(dataDir, 'aimv.db');
  let db = null;
  let inMemoryFallback = false;

  function init() {
    if (!Database) {
      console.warn('[DB] better-sqlite3 not installed — using in-memory fallback. Run: npm install better-sqlite3');
      inMemoryFallback = true;
      return;
    }

    try {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      migrate();
      console.log('[DB] SQLite database ready at', dbPath);
    } catch (err) {
      console.warn('[DB] Failed to open SQLite database:', err.message, '— using in-memory fallback');
      inMemoryFallback = true;
    }
  }

  function migrate() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        role TEXT DEFAULT 'editor',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        data TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        action TEXT NOT NULL,
        resource TEXT,
        details TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
    `);

    // Create default admin user if no users exist
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount.count === 0) {
      const adminId = crypto.randomUUID();
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync('admin', salt, 64).toString('hex');
      db.prepare(
        'INSERT INTO users (id, username, password_hash, display_name, role) VALUES (?, ?, ?, ?, ?)'
      ).run(adminId, 'admin', salt + ':' + hash, 'Administrator', 'admin');
      console.log('[DB] Created default admin user (username: admin, password: admin). Change this immediately!');
    }
  }

  // --- In-memory fallback stores ---
  const memUsers = new Map();
  const memSessions = new Map();

  function initMemoryFallback() {
    if (memUsers.size === 0) {
      const adminId = crypto.randomUUID();
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync('admin', salt, 64).toString('hex');
      memUsers.set('admin', {
        id: adminId,
        username: 'admin',
        password_hash: salt + ':' + hash,
        display_name: 'Administrator',
        role: 'admin'
      });
    }
  }

  // --- User management ---

  function verifyPassword(storedHash, password) {
    const [salt, hash] = storedHash.split(':');
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
  }

  function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return salt + ':' + hash;
  }

  function authenticateUser(username, password) {
    if (inMemoryFallback) {
      initMemoryFallback();
      const user = memUsers.get(username);
      if (!user) return null;
      if (!verifyPassword(user.password_hash, password)) return null;
      return { id: user.id, username: user.username, displayName: user.display_name, role: user.role };
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return null;
    if (!verifyPassword(user.password_hash, password)) return null;
    return { id: user.id, username: user.username, displayName: user.display_name, role: user.role };
  }

  function createUser(username, password, displayName, role) {
    const id = crypto.randomUUID();
    const passwordHash = hashPassword(password);

    if (inMemoryFallback) {
      initMemoryFallback();
      if (memUsers.has(username)) throw new Error('Username already exists');
      memUsers.set(username, { id, username, password_hash: passwordHash, display_name: displayName, role: role || 'editor' });
      return { id, username, displayName, role: role || 'editor' };
    }

    try {
      db.prepare(
        'INSERT INTO users (id, username, password_hash, display_name, role) VALUES (?, ?, ?, ?, ?)'
      ).run(id, username, passwordHash, displayName || username, role || 'editor');
      return { id, username, displayName: displayName || username, role: role || 'editor' };
    } catch (err) {
      if (err.message.includes('UNIQUE constraint')) throw new Error('Username already exists');
      throw err;
    }
  }

  // --- Session management ---

  function createSession(userId) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    if (inMemoryFallback) {
      memSessions.set(sessionId, { id: sessionId, user_id: userId, expires_at: expiresAt, data: '{}' });
      return sessionId;
    }

    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionId, userId, expiresAt);
    return sessionId;
  }

  function getSession(sessionId) {
    if (!sessionId) return null;

    if (inMemoryFallback) {
      const session = memSessions.get(sessionId);
      if (!session) return null;
      if (new Date(session.expires_at) < new Date()) {
        memSessions.delete(sessionId);
        return null;
      }
      initMemoryFallback();
      for (const user of memUsers.values()) {
        if (user.id === session.user_id) {
          return { userId: user.id, username: user.username, displayName: user.display_name, role: user.role };
        }
      }
      return null;
    }

    const row = db.prepare(`
      SELECT s.*, u.username, u.display_name, u.role
      FROM sessions s JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND s.expires_at > datetime('now')
    `).get(sessionId);

    if (!row) return null;
    return { userId: row.user_id, username: row.username, displayName: row.display_name, role: row.role };
  }

  function deleteSession(sessionId) {
    if (inMemoryFallback) {
      memSessions.delete(sessionId);
      return;
    }
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  }

  // --- Audit logging ---

  function logAudit(userId, action, resource, details) {
    if (inMemoryFallback) return;
    try {
      db.prepare('INSERT INTO audit_log (user_id, action, resource, details) VALUES (?, ?, ?, ?)').run(
        userId, action, resource, typeof details === 'string' ? details : JSON.stringify(details || {})
      );
    } catch { /* audit failures should not break the app */ }
  }

  function close() {
    if (db) db.close();
  }

  return {
    init,
    authenticateUser,
    createUser,
    createSession,
    getSession,
    deleteSession,
    logAudit,
    close,
    get isMemoryFallback() { return inMemoryFallback; }
  };
}

module.exports = { createDatabaseService };
