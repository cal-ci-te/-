const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'revachol.db');
let db = null;
let dbInitialized = false;

async function initDb() {
    console.log('[DB] initDb 被调用');

    if (dbInitialized) {
        console.log('[DB] 已初始化，返回现有 db');
        return db;
    }

    try {
        console.log('[DB] 开始加载 sql.js (从 CDN)');
        const SQL = await initSqlJs({
            // 可选：指定本地 WASM 文件路径，提高可靠性
            // locateFile: (file) => path.join(__dirname, 'node_modules/sql.js/dist', file)
        });
        console.log('[DB] sql.js 加载成功');

        let data = null;
        if (fs.existsSync(DB_PATH)) {
            console.log('[DB] 数据库文件存在，读取中...');
            data = fs.readFileSync(DB_PATH);
            console.log('[DB] 读取完成，大小:', data.length, 'bytes');
        } else {
            console.log('[DB] 数据库文件不存在，将创建新数据库');
        }

        db = new SQL.Database(data);
        console.log('[DB] 数据库实例创建成功');

        // 创建表
        console.log('[DB] 创建表...');
        db.run(`
            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                content TEXT,
                category TEXT,
                updateTime TEXT,
                visible INTEGER DEFAULT 1
            )
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS decos (
                id TEXT PRIMARY KEY,
                name TEXT,
                position TEXT,
                style TEXT,
                image_data BLOB
            )
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS article_drafts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                article_id INTEGER NOT NULL,
                title TEXT,
                content TEXT,
                category TEXT,
                saved_at TEXT NOT NULL,
                FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
            )
        `);
        db.run('CREATE INDEX IF NOT EXISTS idx_drafts_article ON article_drafts(article_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_drafts_saved_at ON article_drafts(saved_at)');

        // 添加 image_path 列（如果不存在）
        try {
            db.run(`ALTER TABLE decos ADD COLUMN image_path TEXT`);
            console.log('✅ 已添加 image_path 列');
        } catch (e) {
            console.log('ℹ️ image_path 列已存在或添加失败:', e.message);
        }

        // 保存数据库到磁盘
        console.log('[DB] 保存数据库到磁盘...');
        saveDb();
        dbInitialized = true;
        console.log('✅ SQLite 数据库初始化完成（含 BLOB 字段与草稿历史表）');
        return db;
    } catch (err) {
        console.error('[DB] ❌ 初始化失败:', err);
        console.error('[DB] 错误详情:', err.stack);
        throw err; // 重新抛出以便上层捕获
    }
}

function saveDb() {
    if (!db) {
        console.warn('[DB] saveDb 被调用但 db 为空');
        return;
    }
    try {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
        console.log('[DB] 数据库已保存到:', DB_PATH);
    } catch (err) {
        console.error('[DB] 保存数据库失败:', err);
        throw err;
    }
}

function run(sql, params = []) {
    if (!db) throw new Error('数据库未初始化');
    const stmt = db.prepare(sql);
    const result = stmt.run(params);
    stmt.free();
    saveDb();
    let lastId = 0;
    try {
        const rows = db.exec('SELECT last_insert_rowid()');
        if (rows && rows.length > 0 && rows[0].values && rows[0].values[0]) {
            lastId = rows[0].values[0][0];
        }
    } catch (e) {
        if (result && typeof result.lastInsertRowid !== 'undefined') {
            lastId = result.lastInsertRowid;
        } else if (result && typeof result.lastID !== 'undefined') {
            lastId = result.lastID;
        }
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
        if (val instanceof Uint8Array) {
            row[col] = Buffer.from(val);
        } else {
            row[col] = val;
        }
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
            if (val instanceof Uint8Array) {
                row[col] = Buffer.from(val);
            } else {
                row[col] = val;
            }
        });
        results.push(row);
    }
    stmt.free();
    return results;
}

function exec(sql, params = []) {
    if (!db) throw new Error('数据库未初始化');
    const stmt = db.prepare(sql);
    const result = stmt.run(params);
    stmt.free();
    saveDb();
    let changes = 0;
    try {
        const rows = db.exec('SELECT changes()');
        if (rows && rows.length > 0 && rows[0].values && rows[0].values[0]) {
            changes = rows[0].values[0][0];
        }
    } catch (e) {
        // ignore
    }
    return { changes };
}

function closeDb() {
    if (db) {
        try {
            db.close();
            console.log('✅ 数据库连接已关闭');
        } catch (err) {
            console.warn('⚠️ 关闭数据库时出错:', err.message);
        }
    }
}

// 注册进程退出钩子
process.on('exit', () => {
    closeDb();
});

process.on('SIGINT', () => {
    closeDb();
    process.exit(0);
});

module.exports = {
    initDb,
    getDb: () => db,
    saveDb,
    run,
    query,
    queryAll,
    exec,
    closeDb,
};