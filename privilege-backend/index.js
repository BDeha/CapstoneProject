const express = require('express'); // Import Express 
const cors = require('cors');        // Import CORS

const app = express();               // NOW build the "brain" 

app.use(cors());                     // Unlock the doors
app.use(express.json());             // Add the translator 

app.get('/', (req, res) => {
    res.send('The Privilege Walk Server is Live!');
});

// The Scoring Engine for the Privilege Walk
app.post('/api/walk', (req, res) => {
    const { answer, type } = req.body; 
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

    res.json({ message: "Position updated", movement: stepValue });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});