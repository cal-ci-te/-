const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function migrate() {
    const SQL = await initSqlJs();
    const dataPath = path.join(__dirname, 'data.json');

    if (!fs.existsSync(dataPath)) {
        console.log('data.json 不存在，跳过迁移');
        return;
    }

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const DB_PATH = path.join(__dirname, 'revachol.db');

    // 如果数据库已存在，先删除（确保干净）
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    const db = new SQL.Database();

    // 创建表（与 db.cjs 一致）
    db.run(`
        CREATE TABLE articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            content TEXT,
            category TEXT,
            updateTime TEXT,
            visible INTEGER DEFAULT 1
        )
    `);
    db.run(`
        CREATE TABLE settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `);
    db.run(`
        CREATE TABLE decos (
            id TEXT PRIMARY KEY,
            name TEXT,
            position TEXT,
            style TEXT,
            image_data BLOB
        )
    `);
    // 新增草稿表
    db.run(`
        CREATE TABLE article_drafts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            article_id INTEGER NOT NULL,
            title TEXT,
            content TEXT,
            category TEXT,
            saved_at TEXT NOT NULL,
            FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
        )
    `);
    db.run('CREATE INDEX idx_drafts_article ON article_drafts(article_id)');
    db.run('CREATE INDEX idx_drafts_saved_at ON article_drafts(saved_at)');

    // 迁移文章
    if (data.articles && data.articles.length > 0) {
        const stmt = db.prepare(`
            INSERT INTO articles (id, title, content, category, updateTime, visible) 
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        data.articles.forEach(a => {
            stmt.run([a.id, a.title, a.content, a.category, a.updateTime, a.visible !== undefined ? a.visible : 1]);
        });
        stmt.free();
        console.log('✅ 迁移文章:', data.articles.length);
    }

    // 迁移设置
    if (data.settings) {
        const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        Object.entries(data.settings).forEach(([key, value]) => {
            stmt.run([key, JSON.stringify(value)]);
        });
        stmt.free();
        console.log('✅ 迁移设置');
    }

    const exported = db.export();
    const buffer = Buffer.from(exported);
    fs.writeFileSync(DB_PATH, buffer);
    console.log('💾 数据库已重建，大小:', buffer.length, 'bytes');
    db.close();
    console.log('🎉 迁移完成！');
}

migrate().catch(err => {
    console.error('❌ 迁移失败:', err);
});