const Database = require('better-sqlite3');
const db = new Database('./database/college.db');

console.log('--- SITE SETTINGS ---');
console.log(db.prepare("SELECT * FROM site_settings").all());

console.log('--- FACULTY ---');
console.log(db.prepare("SELECT * FROM faculty").all());

console.log('--- NOTICES ---');
console.log(db.prepare("SELECT * FROM notices").all());

console.log('--- APPLICATIONS ---');
console.log(db.prepare("SELECT * FROM applications").all());
