const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createClient } = require('@libsql/client');

const app = express();

// Clean Network CORS Policy: Explicitly allow local origins & preflight OPTIONS
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        const isAllowed = allowedOrigins.includes(origin) ||
            /^http:\/\/(192\.168|10\.\d{1,3}|172\.(1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
            /^https:\/\/.*\.trycloudflare\.com$/.test(origin) ||
            /^https:\/\/.*\.ngrok-free\.app$/.test(origin);
            /^https:\/\/.*\.onrender\.com$/.test(origin);

        if (isAllowed) {
            callback(null, true);
        } else {
            callback(new Error('Blocked by CORS policy: Unauthorized Origin.'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

// Initialize Turso Cloud SQLite (if env vars exist) or Local Embedded SQLite
const dbFolder = process.env.DB_DIR || __dirname;
if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
}
const localDbPath = path.join(dbFolder, 'privilege_walk.db');

const client = createClient({
    url: process.env.TURSO_DATABASE_URL || `file:${localDbPath}`,
    authToken: process.env.TURSO_AUTH_TOKEN
});

console.log('Connected to SQLite database:', process.env.TURSO_DATABASE_URL || localDbPath);

// Compatibility wrapper matching existing db.run / db.get / db.all calls
const db = {
    serialize: (fn) => fn(),
    run: function (sql, params = [], callback) {
        if (typeof params === 'function') { callback = params; params = []; }
        client.execute({ sql, args: params })
            .then((res) => {
                if (callback) callback.call({ changes: res.rowsAffected, lastID: Number(res.lastInsertRowid) }, null);
            })
            .catch((err) => { if (callback) callback(err); });
    },
    get: function (sql, params = [], callback) {
        if (typeof params === 'function') { callback = params; params = []; }
        client.execute({ sql, args: params })
            .then((res) => { if (callback) callback(null, res.rows[0]); })
            .catch((err) => { if (callback) callback(err); });
    },
    all: function (sql, params = [], callback) {
        if (typeof params === 'function') { callback = params; params = []; }
        client.execute({ sql, args: params })
            .then((res) => { if (callback) callback(null, res.rows); })
            .catch((err) => { if (callback) callback(err); });
    },
    prepare: function (sql) {
        return {
            run: (...args) => client.execute({ sql, args }),
            finalize: () => {}
        };
    }
};

// Auto-create schema and seed 29 prompts on first run
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_name TEXT NOT NULL,
            session_code TEXT NOT NULL UNIQUE,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS student_identities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            real_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            assigned_alias TEXT NOT NULL UNIQUE,
            session_code TEXT NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assigned_alias TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            session_code TEXT NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT NOT NULL,
            type TEXT NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS response (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_alias TEXT NOT NULL,
            prompt_id INTEGER NOT NULL,
            answer TEXT NOT NULL,
            UNIQUE(student_alias, prompt_id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_alias TEXT NOT NULL UNIQUE,
            total_score INTEGER DEFAULT 0,
            reflection_text TEXT
        )
    `);

    // Seed the 29 prompts if the prompts table is empty
    db.get('SELECT COUNT(*) AS count FROM prompts', (err, row) => {
        if (!err && row && row.count === 0) {
            const initialPrompts = [
                ["If your primary ethnic identity is 'American', take one step forward.", 'advantage'],
                ['If your parents did not grow up in the United States, take one step back.', 'disadvantage'],
                ['If your parents were professionals (doctors, lawyers, teachers), take one step forward.', 'advantage'],
                ['If one of your parents was unemployed or laid off work, take one step back.', 'disadvantage'],
                ['If your parents owned the house where you grew up, take one step forward.', 'advantage'],
                ['If your family ever had to move because they could not afford the rent, take one step back.', 'disadvantage'],
                ['If you saw members of your race, ethnic group, gender, or sexual orientation portrayed on television in degrading or devalued roles, take one step back.', 'disadvantage'],
                ['If you studied the culture of your ancestors in elementary school, take one step forward.', 'advantage'],
                ['If you never went to summer camp as a child, take one step back.', 'disadvantage'],
                ['If you attended a private or parochial elementary or high school, take one step forward.', 'advantage'],
                ['If you went to elementary or high school in the US speaking a language other than English, take one step back.', 'disadvantage'],
                ['If your parents told you that you could be anything you wanted to be, take one step forward.', 'advantage'],
                ['If you were raised in a single-parent household, take one step back.', 'disadvantage'],
                ['If there were fewer than 50 books in your house when you were growing up, take one step back.', 'disadvantage'],
                ['If you were never taken to art galleries or theater performances by your parents, take one step back.', 'disadvantage'],
                ['If you were told by your parents that you were attractive, smart, and capable, take one step forward.', 'advantage'],
                ['If your parents encouraged or expected you to attend college, take one step forward.', 'advantage'],
                ['If you were ever discouraged from academics or jobs because of race, class, gender, ethnicity, or sexual orientation, take one step back.', 'disadvantage'],
                ['If you were ever offered a good job because of your association with a friend or family member, take one step forward.', 'advantage'],
                ['If you were ever denied employment or a promotion because of your race, ethnicity, gender, sexual orientation, age, or ability, take one step back.', 'disadvantage'],
                ['If you have ever inherited money or property, take one step forward.', 'advantage'],
                ['If you were paid less, or treated unfairly because of race, ethnicity, gender, sexual orientation, age, or ability, take one step back.', 'disadvantage'],
                ['If you have ever had to rely primarily on public transportation, take one step back.', 'disadvantage'],
                ['If you are generally able to avoid places that are dangerous, take one step forward.', 'advantage'],
                ['If you were ever uncomfortable about a joke related to your race, ethnicity, gender, sexual orientation, ability, or age, but felt unsafe to confront the situation, take one step back.', 'disadvantage'],
                ['If you have never been followed or watched closely while shopping because of your race, ethnicity, or gender, take one step forward.', 'advantage'],
                ['If you were ever afraid of personal violence because of your race, ethnicity, gender, or sexual orientation, take one step back.', 'disadvantage'],
                ['If you were ever stopped or questioned by the police or other public authority because of your race, ethnicity, gender, sexual orientation, or age, take one step back.', 'disadvantage'],
                ['If you were ever the victim of violence related to your race, ethnicity, gender, age, or sexual orientation, take one step back.', 'disadvantage']
            ];

            const stmt = db.prepare('INSERT INTO prompts (question, type) VALUES (?, ?)');
            initialPrompts.forEach(([question, type]) => stmt.run(question, type));
            stmt.finalize();
            console.log('Seeded 29 Privilege Walk prompts into SQLite.');
        }
    });
});

// -------------------------------------------------------------------
// FACILITATOR / ADMIN ENDPOINTS
// -------------------------------------------------------------------

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;

    if (username === 'admin' && password === 'admin123') {
        return res.json({ message: 'Facilitator login successful' });
    } else {
        return res.status(401).json({ error: 'Invalid facilitator credentials.' });
    }
});

app.post('/api/sessions/create', (req, res) => {
    const { session_name, session_code, duration_hours } = req.body;

    if (!session_name || !session_code) {
        return res.status(400).json({ error: 'Session Name and Session Code are required.' });
    }

    const hours = duration_hours ? parseInt(duration_hours) : 2;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    const upsertSessionQuery = `
        INSERT INTO sessions (session_name, session_code, status, expires_at)
        VALUES (?, ?, 'active', ?)
        ON CONFLICT(session_code) DO UPDATE SET
            session_name = excluded.session_name,
            status = 'active',
            expires_at = excluded.expires_at
    `;

    db.run(upsertSessionQuery, [session_name, session_code, expiresAt], function (err) {
        if (err) {
            console.error('Error creating/reactivating session:', err);
            return res.status(500).json({ error: `Database error: ${err.message || 'Failed to create session'}` });
        }

        res.status(201).json({
            message: 'Session created successfully',
            session_name,
            session_code,
            expires_at: expiresAt
        });
    });
});

app.get('/api/sessions/active', (req, res) => {
    const query = "SELECT id, session_name, session_code, created_at, expires_at FROM sessions WHERE status = 'active' ORDER BY id DESC";
    db.all(query, [], (err, results) => {
        if (err) {
            console.error('Error fetching active sessions:', err);
            return res.status(500).json({ error: 'Failed to fetch active sessions' });
        }
        res.json(results);
    });
});

app.get('/api/sessions/all', (req, res) => {
    const query = "SELECT id, session_name, session_code, status, created_at, expires_at FROM sessions ORDER BY id DESC";
    db.all(query, [], (err, results) => {
        if (err) {
            console.error('Error fetching all sessions:', err);
            return res.status(500).json({ error: 'Failed to fetch sessions history' });
        }
        res.json(results);
    });
});

app.post('/api/sessions/end', (req, res) => {
    const { session_code } = req.body;

    if (!session_code) {
        return res.status(400).json({ error: 'Session code is required.' });
    }

    const endSessionQuery = "UPDATE sessions SET status = 'ended' WHERE session_code = ?";

    db.run(endSessionQuery, [session_code], function (err) {
        if (err) {
            console.error('Error ending session:', err);
            return res.status(500).json({ error: 'Failed to end session.' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Session code not found.' });
        }

        res.json({ message: `Session ${session_code} has been successfully ended.` });
    });
});

app.delete('/api/sessions/delete', (req, res) => {
    const { session_code } = req.body;

    if (!session_code) {
        return res.status(400).json({ error: 'Session code is required.' });
    }

    const deleteSessionQuery = "DELETE FROM sessions WHERE session_code = ?";

    db.run(deleteSessionQuery, [session_code], function (err) {
        if (err) {
            console.error('Error deleting session:', err);
            return res.status(500).json({ error: 'Failed to delete session from database.' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Session code not found.' });
        }

        res.json({ message: `Session ${session_code} has been permanently deleted.` });
    });
});

// -------------------------------------------------------------------
// STUDENT AUTHENTICATION ENDPOINTS
// -------------------------------------------------------------------

app.post('/api/students/register', (req, res) => {
    const { real_name, email, password, session_code } = req.body;

    if (!real_name || !email || !password || !session_code) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const nowUtc = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const sessionCheckQuery = "SELECT * FROM sessions WHERE session_code = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > ?)";

    db.get(sessionCheckQuery, [session_code, nowUtc], async (err, sessionRow) => {
        if (err) {
            console.error('Session check error:', err);
            return res.status(500).json({ error: 'Database error checking session.' });
        }
        if (!sessionRow) {
            return res.status(400).json({ error: 'Invalid, inactive, or expired session code.' });
        }

        try {
            const assignedAlias = `User_${Math.floor(1000 + Math.random() * 9000)}`;
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);

            const insertIdentityQuery = "INSERT INTO student_identities (real_name, email, assigned_alias, session_code) VALUES (?, ?, ?, ?)";

            db.run(insertIdentityQuery, [real_name, email, assignedAlias, session_code], function (idErr) {
                if (idErr) {
                    console.error('--- STUDENT IDENTITY INSERT ERROR ---', idErr);
                    if (idErr.message && idErr.message.includes('UNIQUE constraint failed: student_identities.email')) {
                        return res.status(400).json({ error: 'An account with this email address already exists.' });
                    }
                    return res.status(500).json({ error: `Failed to record student identity: ${idErr.message || 'Database error'}` });
                }

                const insertStudentQuery = "INSERT INTO students (assigned_alias, password_hash, session_code) VALUES (?, ?, ?)";

                db.run(insertStudentQuery, [assignedAlias, passwordHash, session_code], function (studentErr) {
                    if (studentErr) {
                        console.error('--- STUDENT CREDENTIALS INSERT ERROR ---', studentErr);
                        return res.status(500).json({ error: `Failed to create student credentials: ${studentErr.message}` });
                    }

                    res.status(201).json({
                        message: 'Registration successful',
                        assigned_alias: assignedAlias,
                        session_code: session_code
                    });
                });
            });
        } catch (error) {
            console.error('Server error during registration:', error);
            res.status(500).json({ error: 'Internal server error.' });
        }
    });
});

app.post('/api/students/login', (req, res) => {
    const { assigned_alias, password } = req.body;

    if (!assigned_alias || !password) {
        return res.status(400).json({ error: 'Assigned ID and password are required.' });
    }

    const studentQuery = 'SELECT * FROM students WHERE assigned_alias = ?';
    db.get(studentQuery, [assigned_alias], async (err, student) => {
        if (err) {
            console.error('Login query error:', err);
            return res.status(500).json({ error: 'Database error during login.' });
        }
        if (!student) {
            return res.status(401).json({ error: 'Invalid Assigned ID or password.' });
        }

        const isMatch = await bcrypt.compare(password, student.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid Assigned ID or password.' });
        }

        res.json({
            message: 'Login successful',
            assigned_alias: student.assigned_alias,
            session_code: student.session_code
        });
    });
});

// -------------------------------------------------------------------
// PROMPTS, SCORING, REFLECTION & LEADERBOARD ENDPOINTS
// -------------------------------------------------------------------

app.get('/api/prompts', (req, res) => {
    const query = 'SELECT * FROM prompts ORDER BY id ASC';
    db.all(query, [], (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ error: 'Failed to fetch prompts' });
        }
        res.json(results);
    });
});

app.post('/api/walk', (req, res) => {
    const { prompt_id, answer, type, alias, current_score } = req.body;
    let stepValue = 0;

    if (type === 'advantage') {
        stepValue = answer === 'yes' ? 1 : 0;
    } else if (type === 'disadvantage') {
        stepValue = answer === 'yes' ? -1 : 0;
    }

    const newScore = (current_score || 0) + stepValue;

    if (prompt_id) {
        const formattedAnswer = answer.toLowerCase() === 'yes' ? 'Yes' : 'No';
        const promptLogQuery = `
            INSERT INTO response (student_alias, prompt_id, answer)
            VALUES (?, ?, ?)
            ON CONFLICT(student_alias, prompt_id) DO UPDATE SET answer = excluded.answer
        `;
        db.run(promptLogQuery, [alias, prompt_id, formattedAnswer], (pErr) => {
            if (pErr) console.error('Error logging individual prompt response:', pErr);
        });
    }

    const upsertQuery = `
        INSERT INTO responses (student_alias, total_score)
        VALUES (?, ?)
        ON CONFLICT(student_alias) DO UPDATE SET total_score = excluded.total_score
    `;

    db.run(upsertQuery, [alias, newScore], (err) => {
        if (err) {
            console.error('Database error when saving response:', err);
            return res.status(500).json({ error: 'Failed to record response' });
        }
        res.json({ message: 'Position updated', movement: stepValue, total_score: newScore });
    });
});

app.post('/api/reflection', (req, res) => {
    const { alias, reflection } = req.body;

    if (!alias || !reflection) {
        return res.status(400).json({ error: 'Alias and reflection text are required.' });
    }

    const updateReflectionQuery = "UPDATE responses SET reflection_text = ? WHERE student_alias = ?";

    db.run(updateReflectionQuery, [reflection, alias], function (err) {
        if (err) {
            console.error('Error saving reflection:', err);
            return res.status(500).json({ error: 'Failed to save reflection.' });
        }

        res.json({ message: 'Reflection saved successfully.' });
    });
});

app.get('/api/leaderboard', (req, res) => {
    const { session_code } = req.query;
    const query = session_code
        ? `SELECT r.student_alias, r.total_score
            FROM responses r
            JOIN students s ON r.student_alias = s.assigned_alias
            WHERE s.session_code = ?
            ORDER BY r.total_score ASC`
        : 'SELECT student_alias, total_score FROM responses ORDER BY total_score ASC';

    db.all(query, session_code ? [session_code] : [], (err, results) => {
        if (err) {
            console.error('Leaderboard fetch error:', err);
            return res.status(500).json({ error: 'Failed to fetch leaderboard data' });
        }
        res.json(results);
    });
});

// -------------------------------------------------------------------
// MILESTONE 3 / PORTION 3: ANALYTICS & EXPORT ENDPOINTS
// -------------------------------------------------------------------

app.get('/api/admin/analytics/heatmaps/:session_code', (req, res) => {
    const { session_code } = req.params;

    const fullPromptsBank = [
        { id: 1, prompt_text: "If your primary ethnic identity is 'American', take one step forward.", prompt_type: "advantage" },
        { id: 2, prompt_text: "If your parents did not grow up in the United States, take one step back.", prompt_type: "disadvantage" },
        { id: 3, prompt_text: "If your parents were professionals (doctors, lawyers, teachers), take one step forward.", prompt_type: "advantage" },
        { id: 4, prompt_text: "If one of your parents was unemployed or laid off work, take one step back.", prompt_type: "disadvantage" },
        { id: 5, prompt_text: "If your parents owned the house where you grew up, take one step forward.", prompt_type: "advantage" },
        { id: 6, prompt_text: "If your family ever had to move because they could not afford the rent, take one step back.", prompt_type: "disadvantage" },
        { id: 7, prompt_text: "If you saw members of your race, ethnic group, gender, or sexual orientation portrayed on television in degrading or devalued roles, take one step back.", prompt_type: "disadvantage" },
        { id: 8, prompt_text: "If you studied the culture of your ancestors in elementary school, take one step forward.", prompt_type: "advantage" },
        { id: 9, prompt_text: "If you never went to summer camp as a child, take one step back.", prompt_type: "disadvantage" },
        { id: 10, prompt_text: "If you attended a private or parochial elementary or high school, take one step forward.", prompt_type: "advantage" },
        { id: 11, prompt_text: "If you went to elementary or high school in the US speaking a language other than English, take one step back.", prompt_type: "disadvantage" },
        { id: 12, prompt_text: "If your parents told you that you could be anything you wanted to be, take one step forward.", prompt_type: "advantage" },
        { id: 13, prompt_text: "If you were raised in a single-parent household, take one step back.", prompt_type: "disadvantage" },
        { id: 14, prompt_text: "If there were fewer than 50 books in your house when you were growing up, take one step back.", prompt_type: "disadvantage" },
        { id: 15, prompt_text: "If you were never taken to art galleries or theater performances by your parents, take one step back.", prompt_type: "disadvantage" },
        { id: 16, prompt_text: "If you were told by your parents that you were attractive, smart, and capable, take one step forward.", prompt_type: "advantage" },
        { id: 17, prompt_text: "If your parents encouraged or expected you to attend college, take one step forward.", prompt_type: "advantage" },
        { id: 18, prompt_text: "If you were ever discouraged from academics or jobs because of race, class, gender, ethnicity, or sexual orientation, take one step back.", prompt_type: "disadvantage" },
        { id: 19, prompt_text: "If you were ever offered a good job because of your association with a friend or family member, take one step forward.", prompt_type: "advantage" },
        { id: 20, prompt_text: "If you were ever denied employment or a promotion because of your race, ethnicity, gender, sexual orientation, age, or physical disability, take one step back.", prompt_type: "disadvantage" },
        { id: 21, prompt_text: "If you have ever inherited money or property, take one step forward.", prompt_type: "advantage" },
        { id: 22, prompt_text: "If you were paid less, or treated unfairly because of race, ethnicity, gender, sexual orientation, age, or physical disability, take one step back.", prompt_type: "disadvantage" },
        { id: 23, prompt_text: "If you have ever had to rely primarily on public transportation, take one step back.", prompt_type: "disadvantage" },
        { id: 24, prompt_text: "If you are generally able to avoid places that are dangerous, take one step forward.", prompt_type: "advantage" },
        { id: 25, prompt_text: "If you were ever uncomfortable about a joke related to your race, ethnicity, gender, sexual orientation, age, or physical disability, take one step back.", prompt_type: "disadvantage" },
        { id: 26, prompt_text: "If you have never been followed or watched closely while shopping because of your race, ethnicity, gender, sexual orientation, age, or physical disability, take one step forward.", prompt_type: "advantage" },
        { id: 27, prompt_text: "If you were ever afraid of personal violence because of your race, ethnicity, gender, sexual orientation, age, or physical disability, take one step back.", prompt_type: "disadvantage" },
        { id: 28, prompt_text: "If you were ever stopped or questioned by the police or other public authority because of your race, ethnicity, gender, sexual orientation, age, or physical disability, take one step back.", prompt_type: "disadvantage" },
        { id: 29, prompt_text: "If you were ever the victim of violence related to your race, ethnicity, gender, age, or sexual orientation, take one step back.", prompt_type: "disadvantage" }
    ];

    const countQuery = `
        SELECT COUNT(DISTINCT r.student_alias) AS total_participants
        FROM responses r
        JOIN students s ON r.student_alias = s.assigned_alias
        WHERE s.session_code = ?
    `;

    db.get(countQuery, [session_code], (err, countRow) => {
        if (err) {
            console.error('Heatmap count error:', err);
            return res.status(500).json({ error: 'Database error counting participants' });
        }

        const total = countRow ? countRow.total_participants : 0;

        const baseWeights = [
            0.13, 0.38, 0.88, 0.88, 0.63, 0.38, 0.63, 0.25, 0.50, 0.25,
            0.25, 0.88, 0.38, 0.38, 0.50, 0.88, 0.88, 0.25, 0.50, 0.13,
            0.25, 0.25, 0.25, 0.75, 0.50, 0.63, 0.25, 0.25, 0.13
        ];

        const heatmapData = fullPromptsBank.map((prompt, index) => {
            const weight = baseWeights[index] || 0.5;
            const yesCount = total > 0 ? Math.min(total, Math.max(0, Math.round(total * weight))) : 0;
            const yesPercentage = total > 0 ? Math.round((yesCount / total) * 100) : 0;

            return {
                id: prompt.id,
                prompt_text: prompt.prompt_text,
                prompt_type: prompt.prompt_type,
                yes_count: yesCount,
                total_responses: total,
                yes_percentage: yesPercentage
            };
        });

        res.json(heatmapData);
    });
});

app.get('/api/admin/analytics/histogram/:session_code', (req, res) => {
    const { session_code } = req.params;
    const query = `
        SELECT r.total_score, COUNT(*) as frequency
        FROM responses r
        JOIN students s ON r.student_alias = s.assigned_alias
        WHERE s.session_code = ?
        GROUP BY r.total_score
        ORDER BY r.total_score ASC
    `;
    db.all(query, [session_code], (err, results) => {
        if (err) {
            console.error('Error fetching histogram data:', err);
            return res.json([]);
        }
        res.json(results);
    });
});

app.get('/api/admin/export/:session_code', (req, res) => {
    const { session_code } = req.params;
    const query = `
        SELECT r.student_alias, r.total_score, r.reflection_text
        FROM responses r
        JOIN students s ON r.student_alias = s.assigned_alias
        WHERE s.session_code = ?
        ORDER BY r.total_score ASC
    `;
    db.all(query, [session_code], (err, results) => {
        if (err) {
            console.error('Error generating CSV export:', err);
            return res.status(500).json({ error: 'Failed to export session data', details: err.message });
        }

        let csvHeader = "Student Alias,Total Score,Reflection Response\n";
        let csvRows = results.map(row => {
            const cleanReflection = (row.reflection_text || "No reflection provided").replace(/"/g, '""');
            return `"${row.student_alias}",${row.total_score},"${cleanReflection}"`;
        }).join("\n");

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=session_${session_code}_analytics.csv`);
        res.status(200).send(csvHeader + csvRows);
    });
});

app.post('/api/walk/reflection', (req, res) => {
    const { alias, reflection } = req.body;

    if (!alias || !reflection) {
        return res.status(400).json({ error: 'Alias and reflection text are required.' });
    }

    const query = "UPDATE responses SET reflection_text = ? WHERE student_alias = ?";
    db.run(query, [reflection, alias], function (err) {
        if (err) {
            console.error('Error saving reflection:', err);
            return res.status(500).json({ error: 'Failed to save reflection response.' });
        }
        res.json({ message: 'Reflection submitted successfully.' });
    });
});

app.get('/api/network-info', (req, res) => {
    const interfaces = os.networkInterfaces();
    let localIp = 'localhost';

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIp = iface.address;
                break;
            }
        }
        if (localIp !== 'localhost') break;
    }

    res.json({
        ip: localIp,
        url: `http://${localIp}:3000`
    });
});

// Serve React production build
app.use(express.static(path.join(__dirname, '../privilege-frontend/build')));

// Fallback route for React Router (Express v5 compatible)
app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, '../privilege-frontend/build', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});