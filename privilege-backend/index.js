const express = require('express'); // Import Express
const cors = require('cors');        // Import CORS
const mysql = require('mysql2');     // Import MySQL2 driver
const bcrypt = require('bcryptjs');  // Import bcrypt for secure password hashing

const app = express();               // NOW build the "brain"

app.use(cors());                     // Unlock the doors
app.use(express.json());             // Add the translator

// MySQL Database Connection Pool
const db = mysql.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'privilege_walk',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

app.get('/', (req, res) => {
    res.send('The Privilege Walk Server is Live!');
});

// -------------------------------------------------------------------
// STUDENT AUTHENTICATION ENDPOINTS
// -------------------------------------------------------------------

// Student Registration Endpoint
app.post('/api/students/register', async (req, res) => {
    const { real_name, email, password, session_code } = req.body;

    if (!real_name || !email || !password || !session_code) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        // Verify active and non-expired session code
        const sessionCheckQuery = `
            SELECT * FROM sessions 
            WHERE session_code = ? 
              AND status = "active" 
              AND (expires_at IS NULL OR expires_at > NOW())
        `;

        db.query(sessionCheckQuery, [session_code], async (err, sessionResults) => {
            if (err) {
                console.error('Session check error:', err);
                return res.status(500).json({ error: 'Database error checking session.' });
            }
            if (sessionResults.length === 0) {
                return res.status(400).json({ error: 'Invalid, inactive, or expired session code.' });
            }

            // Generate unique student alias (e.g., User_4821)
            const assignedAlias = `User_${Math.floor(1000 + Math.random() * 9000)}`;

            // Hash password securely
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);

            // Step A: Insert into student_identities (Hidden Student Names Lookup for Facilitator)
            const insertIdentityQuery = `
                INSERT INTO student_identities (real_name, email, assigned_alias, session_code)
                VALUES (?, ?, ?, ?)
            `;

            db.query(insertIdentityQuery, [real_name, email, assignedAlias, session_code], (idErr) => {
                if (idErr) {
                    if (idErr.code === 'ER_DUP_ENTRY') {
                        return res.status(400).json({ error: 'An account with this email already exists.' });
                    }
                    console.error('Student identity insert error:', idErr);
                    return res.status(500).json({ error: 'Failed to record student identity.' });
                }

                // Step B: Insert into students (Auth Credentials)
                const insertStudentQuery = `
                    INSERT INTO students (assigned_alias, password_hash, session_code)
                    VALUES (?, ?, ?)
                `;

                db.query(insertStudentQuery, [assignedAlias, passwordHash, session_code], (studentErr) => {
                    if (studentErr) {
                        console.error('Student auth insert error:', studentErr);
                        return res.status(500).json({ error: 'Failed to create student credentials.' });
                    }

                    res.status(201).json({
                        message: 'Registration successful',
                        assigned_alias: assignedAlias,
                        session_code: session_code
                    });
                });
            });
        });
    } catch (error) {
        console.error('Server error during registration:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Student Login Endpoint
app.post('/api/students/login', (req, res) => {
    const { assigned_alias, password } = req.body;

    if (!assigned_alias || !password) {
        return res.status(400).json({ error: 'Assigned ID and password are required.' });
    }

    const studentQuery = 'SELECT * FROM students WHERE assigned_alias = ?';
    db.query(studentQuery, [assigned_alias], async (err, results) => {
        if (err) {
            console.error('Login query error:', err);
            return res.status(500).json({ error: 'Database error during login.' });
        }
        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid Assigned ID or password.' });
        }

        const student = results[0];
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
// PROMPTS, SCORING & LEADERBOARD ENDPOINTS
// -------------------------------------------------------------------

// Route to fetch all prompts dynamically from the database in fixed order
app.get('/api/prompts', (req, res) => {
    const query = 'SELECT * FROM prompts ORDER BY id ASC';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ error: 'Failed to fetch prompts' });
        }
        res.json(results);
    });
});

// The Scoring Engine for the Privilege Walk
app.post('/api/walk', (req, res) => {
    const { answer, type, alias, current_score } = req.body; 
    let stepValue = 0;

    // The prompt is an ADVANTAGE
    if (type === 'advantage') {
        if (answer === 'yes') {
            stepValue = 1;  // Step Forward
        } else {
            stepValue = 0;  // Stay in place
        }
    } 
    // The prompt is a DISADVANTAGE
    else if (type === 'disadvantage') {
        if (answer === 'yes') {
            stepValue = -1; // Step Backward
        } else {
            stepValue = 0;  // Stay in place
        }
    }

    const newScore = (current_score || 0) + stepValue;

    // Persist or update the student's score in the MySQL responses table
    const upsertQuery = `
        INSERT INTO responses (student_alias, total_score) 
        VALUES (?, ?) 
        ON DUPLICATE KEY UPDATE total_score = ?
    `;

    db.query(upsertQuery, [alias, newScore, newScore], (err) => {
        if (err) {
            console.error('Database error when saving response:', err);
            return res.status(500).json({ error: 'Failed to record response' });
        }
        res.json({ message: "Position updated", movement: stepValue, total_score: newScore });
    });
});

// Route to fetch horizontal leaderboard data at the end of the walk
app.get('/api/leaderboard', (req, res) => {
    const query = 'SELECT student_alias, total_score FROM responses ORDER BY total_score ASC';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Leaderboard fetch error:', err);
            return res.status(500).json({ error: 'Failed to fetch leaderboard data' });
        }
        res.json(results);
    });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});