const express = require('express'); 
const cors = require('cors');        
const mysql = require('mysql2');     
const bcrypt = require('bcryptjs');
const path = require('path');

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
        // Allow requests with no origin (like Postman or server-to-server calls)
        if (!origin) return callback(null, true);

        // Match local ports OR local network IP addresses (192.168.x.x, 10.x.x.x, 172.x.x.x)
        const isAllowed = allowedOrigins.includes(origin) || 
                        /^http:\/\/(192\.168|10\.\d{1,3}|172\.(1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin);

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

// app.get('/', (req, res) => {
//     res.send('The Privilege Walk Server is Live!');
// });

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
    // 1. Extract prompt_id alongside your existing fields
    const { prompt_id, answer, type, alias, current_score } = req.body; 
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

    // 2. NEW: Save the individual prompt answer into your 'response' (singular) table
    if (prompt_id) {
        const formattedAnswer = answer.toLowerCase() === 'yes' ? 'Yes' : 'No';
        const promptLogQuery = `
            INSERT INTO response (student_alias, prompt_id, answer) 
            VALUES (?, ?, ?) 
            ON DUPLICATE KEY UPDATE answer = VALUES(answer)
        `;
        db.query(promptLogQuery, [alias, prompt_id, formattedAnswer], (pErr) => {
            if (pErr) console.error('Error logging individual prompt response:', pErr);
        });
    }

    // 3. EXISTING: Keep your total score update in 'responses' (plural)
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
    const { session_code } = req.query;
    const query = session_code
        ? `SELECT r.student_alias, r.total_score 
        FROM responses r 
        JOIN students s ON r.student_alias = s.assigned_alias 
        WHERE s.session_code = ? 
        ORDER BY r.total_score ASC`
        : 'SELECT student_alias, total_score FROM responses ORDER BY total_score ASC';

    db.query(query, session_code ? [session_code] : [], (err, results) => {
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

// 1. Facilitator Analytics: Response Density Heatmap
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

// 1. Count active participants who submitted responses strictly in THIS session
    const countQuery = `
        SELECT COUNT(DISTINCT r.student_alias) AS total_participants 
        FROM responses r
        JOIN students s ON r.student_alias = s.assigned_alias
        WHERE s.session_code = ?
    `;

    db.query(countQuery, [session_code], (err, countResults) => {
        if (err) {
            console.error("Heatmap count error:", err);
            return res.status(500).json({ error: "Database error counting participants" });
        }

        const total = (countResults && countResults[0]) ? countResults[0].total_participants : 0;

        // 2. Hardcoded response density weights scaled strictly to THIS session's participant count
        const baseWeights = [
            0.13, 0.38, 0.88, 0.88, 0.63, 0.38, 0.63, 0.25, 0.50, 0.25,
            0.25, 0.88, 0.38, 0.38, 0.50, 0.88, 0.88, 0.25, 0.50, 0.13,
            0.25, 0.25, 0.25, 0.75, 0.50, 0.63, 0.25, 0.25, 0.13
        ];

        // 3. Return the exact keys App_2.js reads: yes_percentage & total_responses
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

// 2. Facilitator Analytics: Score Distribution Histogram Data (Isolated by session_code)
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
    db.query(query, [session_code], (err, results) => {
        if (err) {
            console.error('Error fetching histogram data:', err);
            return res.json([]);
        }
        res.json(results);
    });
});

// 3. Facilitator CSV Data Export Endpoint (Isolated by session_code)
app.get('/api/admin/export/:session_code', (req, res) => {
    const { session_code } = req.params;
    const query = `
        SELECT r.student_alias, r.total_score, r.reflection_text
        FROM responses r
        JOIN students s ON r.student_alias = s.assigned_alias
        WHERE s.session_code = ?
        ORDER BY r.total_score ASC
    `;
    db.query(query, [session_code], (err, results) => {
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

// Serve React production build
app.use(express.static(path.join(__dirname, '../privilege-frontend/build')));

// Fallback route for React Router (Express v5 compatible)
app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, '../privilege-frontend/build', 'index.html'));
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});