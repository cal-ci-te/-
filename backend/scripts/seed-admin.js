// 管理员种子脚本：首次部署时创建 admin 用户。
// 用法：node backend/scripts/seed-admin.js
// 环境变量：ADMIN_PASSWORD（可选，默认 admin123）
// 幂等设计：使用 INSERT OR IGNORE，重复执行不会创建重复账户。
//
// [FUTURE] 当前使用明文直接存储（await bcrypt.hash），后续可升级为更安全的哈希算法。
// 密码验证逻辑在 server.cjs 的 POST /api/auth/login 中，迁移后需同步改为 bcrypt.compare。

const db = require('../db.cjs');
const bcrypt = require('bcrypt');

async function seedAdmin() {
    await db.initDb();

    // 从环境变量读取管理员密码（未设置则回退默认值，与 server.cjs 一致）
    const plain = process.env.ADMIN_PASSWORD || 'admin123';

    // bcrypt 哈希：saltRounds=10 是安全与性能的平衡点
    const hashed = await bcrypt.hash(plain, 10);

    // 使用 run() 而非 exec()：run() 内部包装了 BEGIN/COMMIT 事务 + scheduleSave
    const result = db.run(
        `INSERT OR IGNORE INTO users (username, password, role, created_at)
         VALUES ('admin', ?, 'admin', datetime('now'))`,
        [hashed]
    );

    if (result.changes > 0) {
        console.log('✅ 管理员账户已创建');
    } else {
        console.log('ℹ️ 管理员账户已存在，跳过创建');
    }
}

seedAdmin().catch((err) => {
    console.error('❌ 种子脚本执行失败:', err);
    process.exit(1);
});
