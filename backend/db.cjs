// sql.js：纯 JavaScript 的 SQLite 实现（编译为 WASM），无需系统安装 SQLite。
// 选择理由：开发机无需额外配置数据库服务，部署时一个二进制文件就是完整数据库。
// 已知限制：WASM 在 Windows 下 BLOB 序列化偶发损坏，因此贴图改为文件系统存储（image_path），
// decos 表的 image_data 列仅保留用于兼容旧数据迁移。
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'revachol.db');
let db = null;
let dbInitialized = false;

async function initDb() {
    if (dbInitialized) return db;

    try {
        const SQL = await initSqlJs({});
        let data = null;
        if (fs.existsSync(DB_PATH)) {
            data = fs.readFileSync(DB_PATH);
            console.log('[DB] 数据库文件已读取，大小:', data.length, 'bytes');
        } else {
            console.log('[DB] 数据库文件不存在，将创建新数据库');
        }
        db = new SQL.Database(data);

        db.run(`CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT,
            category TEXT, updateTime TEXT, visible INTEGER DEFAULT 1)`);
        db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS decos (
            id TEXT PRIMARY KEY, name TEXT, position TEXT, style TEXT, image_data BLOB)`);
        db.run(`CREATE TABLE IF NOT EXISTS article_drafts (
            id INTEGER PRIMARY KEY AUTOINCREMENT, article_id INTEGER NOT NULL,
            title TEXT, content TEXT, category TEXT, saved_at TEXT NOT NULL,
            FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE)`);
        db.run('CREATE INDEX IF NOT EXISTS idx_drafts_article ON article_drafts(article_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_drafts_saved_at ON article_drafts(saved_at)');

        // 从 BLOB 迁移到文件系统存储的兼容列（旧表无此列）
        try {
            db.run(`ALTER TABLE decos ADD COLUMN image_path TEXT`);
            console.log('✅ 已添加 image_path 列');
        } catch (e) {
            console.log('ℹ️ image_path 列已存在');
        }

        saveDb();
        dbInitialized = true;
        console.log('✅ SQLite 数据库初始化完成');
        try {
          const count = db.exec('SELECT COUNT(*) as c FROM article_drafts');
          if (count && count[0] && count[0].values) {
            console.log('[DB] article_drafts 表行数:', count[0].values[0][0]);
          }
        } catch (e) {
          console.warn('[DB] article_drafts 表检查失败:', e.message);
        }
        return db;
    } catch (err) {
        console.error('[DB] 初始化失败:', err);
        throw err;
    }
}

// sql.js 在内存中操作，必须手动持久化到磁盘——每次写操作后立即 saveDb()
function saveDb() {
    if (!db) { console.warn('[DB] saveDb 被调用但 db 为空'); return; }
    try {
        const data = db.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (err) {
        console.error('[DB] 保存失败:', err);
        throw err;
    }
}

function run(sql, params = []) {
    if (!db) throw new Error('数据库未初始化');
    // 绕过 sql.js 参数绑定兼容性问题：手动替换 ? 为转义后的值后交给 db.exec()
    let idx = 0;
    const escapedSql = sql.replace(/\?/g, () => {
        const val = params[idx++];
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'number') return String(val);
        return "'" + String(val).replace(/'/g, "''") + "'";
    });
    db.exec(escapedSql);
    saveDb();
    let lastId = 0;
    try {
        const rows = db.exec('SELECT last_insert_rowid()');
        if (rows && rows.length > 0 && rows[0].values && rows[0].values[0]) {
            lastId = rows[0].values[0][0];
        }
    } catch (e) {
        /* fallback */
    }
    return { lastInsertRowid: lastId };
}

function query(sql, params = []) {
    if (!db) throw new Error('数据库未初始化');
    const stmt = db.prepare(sql);
    const columnNames = stmt.getColumnNames();
    const values = stmt.get(params);
    stmt.free();
    if (!values) return null;
    const row = {};
    columnNames.forEach((col, i) => {
        const val = values[i];
        row[col] = val instanceof Uint8Array ? Buffer.from(val) : val;
    });
    return row;
}

function queryAll(sql, params = []) {
    if (!db) throw new Error('数据库未初始化');
    const stmt = db.prepare(sql);
    const results = [];
    while (stmt.step()) {
        const row = {};
        const columns = stmt.getColumnNames();
        const values = stmt.get();
        columns.forEach((col, i) => {
            const val = values[i];
            row[col] = val instanceof Uint8Array ? Buffer.from(val) : val;
        });
        results.push(row);
    }
    stmt.free();
    return results;
}

function exec(sql, params = []) {
    if (!db) throw new Error('数据库未初始化');
    const stmt = db.prepare(sql);
    stmt.run(params);
    stmt.free();
    saveDb();
    let changes = 0;
    try {
        const rows = db.exec('SELECT changes()');
        if (rows && rows.length > 0 && rows[0].values && rows[0].values[0]) {
            changes = rows[0].values[0][0];
        }
    } catch (e) { /* ignore */ }
    return { changes };
}

function closeDb() {
    if (db) {
        try { db.close(); console.log('✅ 数据库连接已关闭'); }
        catch (err) { console.warn('⚠️ 关闭数据库时出错:', err.message); }
    }
}

process.on('exit', () => closeDb());
process.on('SIGINT', () => { closeDb(); process.exit(0); });

module.exports = { initDb, getDb: () => db, saveDb, run, query, queryAll, exec, closeDb };
