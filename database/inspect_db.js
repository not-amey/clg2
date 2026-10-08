const Database = require('better-sqlite3');
const db = new Database('./database/college.db');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
console.log('Tables:', tables.map(t => t.name));

for (const t of tables) {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${t.name}`).all()[0].count;
    console.log(`Table ${t.name}: ${count} rows`);
}
