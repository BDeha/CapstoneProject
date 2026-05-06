const express = require('express'); // 1. Import Express 
const cors = require('cors');        // 2. Import CORS

const app = express();               // 3. NOW build the "brain" 

app.use(cors());                     // 4. Unlock the doors
app.use(express.json());             // 5. Add the translator 

app.get('/', (req, res) => {
    res.send('The Privilege Walk Server is Live!');
});

// The Scoring Engine for the Privilege Walk
app.post('/api/walk', (req, res) => {
    const { answer, type } = req.body; 
    let stepValue = 0; 

    // CASE 1: The prompt is an ADVANTAGE (e.g., "Parents own a home")
    if (type === 'advantage') {
        if (answer === 'yes') {
            stepValue = 1;  // Step Forward
        } else {
            stepValue = 0;  // Stay in place 
        }
    } 
    // CASE 2: The prompt is a DISADVANTAGE (e.g., "Parents didn't finish high school")
    else if (type === 'disadvantage') {
        if (answer === 'yes') {
            stepValue = -1; // Step Backward
        } else {
            stepValue = 0;  // Stay in place 
        }
    }

    res.json({ message: "Position updated", movement: stepValue });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});