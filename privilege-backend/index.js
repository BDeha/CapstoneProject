const express = require('express'); // Import Express
const cors = require('cors');        // Import CORS
const mysql = require('mysql2');     // Import MySQL2 driver

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

// Route to fetch all prompts dynamically from the database
app.get('/api/prompts', (req, res) => {
    const query = 'SELECT * FROM prompts';
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
    // FIX 1: Destructure alias and current_score along with answer and type
    const { answer, type, alias, current_score } = req.body; 
    let stepValue = 0;

    // The prompt is an ADVANTAGE (e.g., "Parents own a home")
    if (type === 'advantage') {
        if (answer === 'yes') {
            stepValue = 1;  // Step Forward
        } else {
            stepValue = 0;  // Stay in place
        }
    } 
    // The prompt is a DISADVANTAGE (e.g., "Parents didn't finish high school")
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
        // Send total_score back with the movement instruction
        res.json({ message: "Position updated", movement: stepValue, total_score: newScore });
    });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});