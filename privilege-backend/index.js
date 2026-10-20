const express = require('express'); 
const cors = require('cors');        
const mysql = require('mysql2');     
const bcrypt = require('bcryptjs');  

const app = express();               

app.use(cors());                     
app.use(express.json());             

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
// FACILITATOR / ADMIN ENDPOINTS
// -------------------------------------------------------------------

// Hardcoded Facilitator Login Endpoint
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;

    if (username === 'admin' && password === 'admin123') {
        return res.json({ message: 'Facilitator login successful' });
    } else {
        return res.status(401).json({ error: 'Invalid facilitator credentials.' });
    }
});

// Facilitator Endpoint: Create or Re-activate a Named Walk Session
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
        ON DUPLICATE KEY UPDATE 
            session_name = VALUES(session_name), 
            status = 'active', 
            expires_at = VALUES(expires_at)
    `;

    db.query(upsertSessionQuery, [session_name, session_code, expiresAt], (err, result) => {
        if (err) {
            console.error('Error creating/reactivating session:', err);
            return res.status(500).json({ error: `Database error: ${err.sqlMessage || 'Failed to create session'}` });
        }

        res.status(201).json({
            message: 'Session created successfully',
            session_name,
            session_code,
            expires_at: expiresAt
        });
    });
});

// Facilitator Endpoint: Get All Active Sessions
app.get('/api/sessions/active', (req, res) => {
    const query = "SELECT id, session_name, session_code, created_at, expires_at FROM sessions WHERE status = 'active' ORDER BY id DESC";
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching active sessions:', err);
            return res.status(500).json({ error: 'Failed to fetch active sessions' });
        }
        res.json(results);
    });
});

// Facilitator Endpoint: Get All Sessions History (Active & Ended)
app.get('/api/sessions/all', (req, res) => {
    const query = "SELECT id, session_name, session_code, status, created_at, expires_at FROM sessions ORDER BY id DESC";
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching all sessions:', err);
            return res.status(500).json({ error: 'Failed to fetch sessions history' });
        }
        res.json(results);
    });
});

// Facilitator Endpoint: End an Active Session
app.post('/api/sessions/end', (req, res) => {
    const { session_code } = req.body;

    if (!session_code) {
        return res.status(400).json({ error: 'Session code is required.' });
    }

    const endSessionQuery = "UPDATE sessions SET status = 'ended' WHERE session_code = ?";

    db.query(endSessionQuery, [session_code], (err, result) => {
        if (err) {
            console.error('Error ending session in MySQL:', err);
            return res.status(500).json({ error: 'Failed to end session.' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Session code not found.' });
        }

        res.json({ message: `Session ${session_code} has been successfully ended.` });
    });
});

// Facilitator Endpoint: Delete a Session from History
app.delete('/api/sessions/delete', (req, res) => {
    const { session_code } = req.body;

    if (!session_code) {
        return res.status(400).json({ error: 'Session code is required.' });
    }

    const deleteSessionQuery = "DELETE FROM sessions WHERE session_code = ?";

    db.query(deleteSessionQuery, [session_code], (err, result) => {
        if (err) {
            console.error('Error deleting session:', err);
            return res.status(500).json({ error: 'Failed to delete session from database.' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Session code not found.' });
        }

        res.json({ message: `Session ${session_code} has been permanently deleted.` });
    });
});

// -------------------------------------------------------------------
// STUDENT AUTHENTICATION ENDPOINTS
// -------------------------------------------------------------------

app.post('/api/students/register', async (req, res) => {
    const { real_name, email, password, session_code } = req.body;

    if (!real_name || !email || !password || !session_code) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        const sessionCheckQuery = "SELECT * FROM sessions WHERE session_code = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())";

        db.query(sessionCheckQuery, [session_code], async (err, sessionResults) => {
            if (err) {
                console.error('Session check error:', err);
                return res.status(500).json({ error: 'Database error checking session.' });
            }
            if (sessionResults.length === 0) {
                return res.status(400).json({ error: 'Invalid, inactive, or expired session code.' });
            }

            const assignedAlias = `User_${Math.floor(1000 + Math.random() * 9000)}`;

            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);

            const insertIdentityQuery = "INSERT INTO student_identities (real_name, email, assigned_alias, session_code) VALUES (?, ?, ?, ?)";

            db.query(insertIdentityQuery, [real_name, email, assignedAlias, session_code], (idErr) => {
                if (idErr) {
                    console.error('--- STUDENT IDENTITY INSERT ERROR ---', idErr);
                    if (idErr.code === 'ER_DUP_ENTRY') {
                        return res.status(400).json({ error: 'An account with this email address already exists.' });
                    }
                    return res.status(500).json({ error: `Failed to record student identity: ${idErr.sqlMessage || 'Database error'}` });
                }

                const insertStudentQuery = "INSERT INTO students (assigned_alias, password_hash, session_code) VALUES (?, ?, ?)";

                db.query(insertStudentQuery, [assignedAlias, passwordHash, session_code], (studentErr) => {
                    if (studentErr) {
                        console.error('--- STUDENT CREDENTIALS INSERT ERROR ---', studentErr);
                        return res.status(500).json({ error: `Failed to create student credentials: ${studentErr.sqlMessage}` });
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
// PROMPTS, SCORING, REFLECTION & LEADERBOARD ENDPOINTS
// -------------------------------------------------------------------

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

app.post('/api/walk', (req, res) => {
    const { answer, type, alias, current_score } = req.body; 
    let stepValue = 0;

    if (type === 'advantage') {
        if (answer === 'yes') {
            stepValue = 1;  
        } else {
            stepValue = 0;  
        }
    } else if (type === 'disadvantage') {
        if (answer === 'yes') {
            stepValue = -1; 
        } else {
            stepValue = 0;  
        }
    }

    const newScore = (current_score || 0) + stepValue;

    const upsertQuery = "INSERT INTO responses (student_alias, total_score) VALUES (?, ?) ON DUPLICATE KEY UPDATE total_score = ?";

    db.query(upsertQuery, [alias, newScore, newScore], (err) => {
        if (err) {
            console.error('Database error when saving response:', err);
            return res.status(500).json({ error: 'Failed to record response' });
        }
        res.json({ message: "Position updated", movement: stepValue, total_score: newScore });
    });
});

// Student Endpoint: Save Written Reflection
app.post('/api/reflection', (req, res) => {
    const { alias, reflection } = req.body;

    if (!alias || !reflection) {
        return res.status(400).json({ error: 'Alias and reflection text are required.' });
    }

    const updateReflectionQuery = "UPDATE responses SET reflection_text = ? WHERE student_alias = ?";

    db.query(updateReflectionQuery, [reflection, alias], (err, result) => {
        if (err) {
            console.error('Error saving reflection:', err);
            return res.status(500).json({ error: 'Failed to save reflection.' });
        }

        res.json({ message: 'Reflection saved successfully.' });
    });
});

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

// -------------------------------------------------------------------
// MILESTONE 3 / PORTION 3: ANALYTICS & EXPORT ENDPOINTS
// -------------------------------------------------------------------

// 1. Facilitator Analytics: Full Georgetown Prompt Response Heatmap (Instant Load)
app.get('/api/admin/analytics/heatmaps/:session_code', (req, res) => {
    const fullPromptsBank = [
        { id: 1, prompt_text: "If you were raised in a single-parent household...", prompt_type: "disadvantage" },
        { id: 2, prompt_text: "If your parents attended a four-year university...", prompt_type: "advantage" },
        { id: 3, prompt_text: "If you ever had to skip a meal due to financial constraints...", prompt_type: "disadvantage" },
        { id: 4, prompt_text: "If you inherited financial assets or family property...", prompt_type: "advantage" },
        { id: 5, prompt_text: "If you felt safe walking alone at night in your neighborhood...", prompt_type: "advantage" },
        { id: 6, prompt_text: "If you were ever bullied or marginalized due to your background...", prompt_type: "disadvantage" },
        { id: 7, prompt_text: "If you had access to private tutoring or test prep programs...", prompt_type: "advantage" },
        { id: 8, prompt_text: "If your family relied on public assistance programs...", prompt_type: "disadvantage" },
        { id: 9, prompt_text: "If you traveled abroad on family vacations growing up...", prompt_type: "advantage" },
        { id: 10, prompt_text: "If you had to work during high school to help pay household bills...", prompt_type: "disadvantage" },
        { id: 11, prompt_text: "If you grew up in a home with more than 50 books...", prompt_type: "advantage" },
        { id: 12, prompt_text: "If you ever felt unsafe or targeted by law enforcement...", prompt_type: "disadvantage" },
        { id: 13, prompt_text: "If your primary language was spoken at school and in official settings...", prompt_type: "advantage" },
        { id: 14, prompt_text: "If you or your family ever experienced housing instability or eviction...", prompt_type: "disadvantage" },
        { id: 15, prompt_text: "If you had private health insurance throughout your childhood...", prompt_type: "advantage" },
        { id: 16, prompt_text: "If you ever had to act as a translator for your parents...", prompt_type: "disadvantage" },
        { id: 17, prompt_text: "If you were able to complete unpaid internships during college...", prompt_type: "advantage" },
        { id: 18, prompt_text: "If you or your family carried significant medical debt...", prompt_type: "disadvantage" },
        { id: 19, prompt_text: "If you were encouraged to attend college by mentors...", prompt_type: "advantage" },
        { id: 20, prompt_text: "If physical disability or chronic illness impacted your daily access...", prompt_type: "disadvantage" },
        { id: 21, prompt_text: "If you had access to high-speed internet and personal computers...", prompt_type: "advantage" },
        { id: 22, prompt_text: "If you ever felt invisible or unrepresented in educational curricula...", prompt_type: "disadvantage" },
        { id: 23, prompt_text: "If your family owned their primary residence growing up...", prompt_type: "advantage" },
        { id: 24, prompt_text: "If you relied exclusively on public transportation...", prompt_type: "disadvantage" },
        { id: 25, prompt_text: "If you can assume people in authority share your background...", prompt_type: "advantage" },
        { id: 26, prompt_text: "If you can take a vacation without financial strain...", prompt_type: "advantage" },
        { id: 27, prompt_text: "If you were ever discouraged from pursuing higher education...", prompt_type: "disadvantage" },
        { id: 28, prompt_text: "If you never had to worry about basic healthcare costs...", prompt_type: "advantage" },
        { id: 29, prompt_text: "If your family legacy provided access to academic/professional networks...", prompt_type: "advantage" }
    ];

    db.query(`SELECT id, prompt_text, prompt_type FROM prompts ORDER BY id ASC`, (err, results) => {
        if (err || !Array.isArray(results) || results.length === 0) {
            return res.json(fullPromptsBank);
        }
        res.json(results);
    });
});

// 2. Facilitator Analytics: Score Distribution Histogram Data
app.get('/api/admin/analytics/histogram/:session_code', (req, res) => {
    const query = `
        SELECT total_score, COUNT(*) as frequency 
        FROM responses 
        GROUP BY total_score 
        ORDER BY total_score ASC
    `;
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching histogram data:', err);
            return res.json([]); // Return empty array safely on zero responses
        }
        res.json(results);
    });
});

// 3. Facilitator CSV Data Export Endpoint (Fixed SQL & Safe Fallbacks)
app.get('/api/admin/export/:session_code', (req, res) => {
    const { session_code } = req.params;
    const query = `
        SELECT r.student_alias, r.total_score, r.reflection_text
        FROM responses r
        ORDER BY r.total_score ASC
    `;
    db.query(query, (err, results) => {
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

// 4. Student Endpoint: Submit Qualitative Reflection
app.post('/api/walk/reflection', (req, res) => {
    const { alias, reflection } = req.body;

    if (!alias || !reflection) {
        return res.status(400).json({ error: 'Alias and reflection text are required.' });
    }

    const query = "UPDATE responses SET reflection_text = ? WHERE student_alias = ?";
    db.query(query, [reflection, alias], (err, result) => {
        if (err) {
            console.error('Error saving reflection:', err);
            return res.status(500).json({ error: 'Failed to save reflection response.' });
        }
        res.json({ message: 'Reflection submitted successfully.' });
    });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});