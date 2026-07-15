console.log('✅ 开始加载...');

try {
    const dbModule = require('./db.cjs');
    console.log('✅ db.cjs 加载成功');
    
    dbModule.initDb()
        .then(() => {
            console.log('✅ 数据库初始化成功');
            console.log('✅ 一切正常');
            // 优雅关闭
            dbModule.closeDb();
            setTimeout(() => process.exit(0), 50);
        })
        .catch(err => {
            console.error('❌ 数据库初始化失败:', err);
            process.exit(1);
        });
} catch (err) {
    console.error('❌ 加载失败:', err);
    process.exit(1);
}