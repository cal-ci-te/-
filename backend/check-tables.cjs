const initSqlJs = require('sql.js');
const fs = require('fs');

(async () => {
    const SQL = await initSqlJs();
    const data = fs.readFileSync('revachol.db');
    const db = new SQL.Database(data);
    const result = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('Tables:', result[0]?.values || []);
    db.close();
})();