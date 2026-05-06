import React, { useState } from 'react';

function PrivilegeWalk() {
    const [feedback, setFeedback] = useState(null); // 'ahead' or 'back'

    const handleAnswer = async (answer, type) => {
        const response = await fetch('/api/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answer, promptType: type, alias: "Student_402" })
        });
        const data = await response.json();

        // Trigger visual movement cues
        setFeedback(data.movement === 1 ? 'ahead' : 'back');
    };

    return (
        <div style={{ textAlign: 'center', padding: '50px' }}>
            <h1>Are you right-handed?</h1>
            <button onClick={() => handleAnswer('yes', 'advantage')}>Yes</button>
            <button onClick={() => handleAnswer('no', 'advantage')}>No</button>

            {feedback === 'ahead' && (
                <div style={{ backgroundColor: 'green', color: 'white', padding: '20px', marginTop: '20px' }}>
                    Take a step ahead!
                </div>
            )}
            {feedback === 'back' && (
                <div style={{ backgroundColor: 'red', color: 'white', padding: '20px', marginTop: '20px' }}>
                    Take a step back.
                </div>
            )}
        </div>
    );
}

export default PrivilegeWalk;