const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const db = new Database('stories.db');

async function createUser() {
    const hashedPassword = await bcrypt.hash('password123', 10);
    try {
        const stmt = db.prepare("INSERT INTO users (username, email, password) VALUES (?, ?, ?)");
        stmt.run('tester', 'test@example.com', hashedPassword);
        console.log('User test@example.com created with password: password123');
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            console.log('User test@example.com already exists.');
        } else {
            console.error(err);
        }
    }
    db.close();
}

createUser();
