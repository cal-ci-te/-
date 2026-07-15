const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'revachol.db');
let db = null;
let dbInitialized = false;

async function initDb() {
    if (dbInitialized) return db;

    const SQL = await initSqlJs();
    let data = null;
    if (fs.existsSync(DB_PATH)) {
        data = fs.readFileSync(DB_PATH);
    }
    db = new SQL.Database(data);

    // 文章表
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
    // 设置表
    db.run(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `);
    // 贴图表（含 BLOB 图片数据）
    db.run(`
        CREATE TABLE IF NOT EXISTS decos (
            id TEXT PRIMARY KEY,
            name TEXT,
            position TEXT,
            style TEXT,
            image_data BLOB
        )
    `);
    // 新增：文章草稿历史表
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

    saveDb();
    dbInitialized = true;
    console.log('✅ SQLite 数据库初始化完成（含 BLOB 字段与草稿历史表）');
    return db;
}

function saveDb() {
    if (!db) return;
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

function run(sql, params = []) {
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
    const stmt = db.prepare(sql);
    const columnNames = stmt.getColumnNames();
    const values = stmt.get(params);
    stmt.free();
    if (!values) return null;
    const row = {};
    columnNames.forEach((col, i) => {
        const val = values[i];
        // BLOB 字段转为 Buffer
        if (val instanceof Uint8Array) {
            row[col] = Buffer.from(val);
        } else {
            row[col] = val;
        }
    });
    return row;
}

function queryAll(sql, params = []) {
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

module.exports = {
    initDb,
    getDb: () => db,
    saveDb,
    run,
    query,
    queryAll,
    exec
};

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
    closeDb,  // 导出关闭方法
};