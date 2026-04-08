const Database = require('better-sqlite3');
const db = new Database('stories.db');
const users = db.prepare('SELECT id, username, email FROM users').all();
console.log(JSON.stringify(users, null, 2));
db.close();
