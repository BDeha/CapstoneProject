const express = require('express');
const mysql = require('mysql2');
const app = express();
app.use(express.json());

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'privilege_walk'
});

// Scoring Engine Logic
app.post('/api/score', (req, res) => {
    const { answer, promptType, alias } = req.body;
    let change = 0;

    if (answer === 'yes') {
        change = (promptType === 'advantage') ? 1 : -1;
    }

    // Update the student's score in the database anonymously
    const query = "UPDATE responses SET total_score = total_score + ? WHERE student_alias = ?";
    db.query(query, [change, alias], (err) => {
        if (err) return res.status(500).send(err);
        res.json({ movement: change });
    });
});

app.listen(3000, () => console.log('Server running on port 3000'));