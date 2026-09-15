import React, { useState, useEffect } from 'react';

function App() {
    const [studentAlias, setStudentAlias] = useState('');
    const [prompts, setPrompts] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [feedback, setFeedback] = useState(null); // 'ahead' or 'back'
    const [isCompleted, setIsCompleted] = useState(false);

    // Generate random student ID and fetch 10 prompts on mount
    useEffect(() => {
        setStudentAlias("User_" + Math.floor(Math.random() * 10000));

        fetch('http://localhost:3000/api/prompts')
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data) && data.length > 0) {
                    setPrompts(data.slice(0, 10)); // Ensure max 10 questions
                }
            })
            .catch((err) => console.error("Error fetching prompts:", err));
    }, []);

    const handleAnswer = async (answer) => {
        if (!prompts.length || currentIndex >= prompts.length) return;

        const currentPrompt = prompts[currentIndex];

        try {
            const response = await fetch('http://localhost:3000/api/walk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    answer: answer,
                    type: currentPrompt.prompt_type || currentPrompt.type,
                    alias: studentAlias,
                    current_score: score
                })
            });

            const data = await response.json();
            setScore(data.total_score);

            // Trigger visual movement feedback
            if (data.movement === 1) {
                setFeedback('ahead');
            } else if (data.movement === -1) {
                setFeedback('back');
            } else {
                setFeedback(null);
            }

            // Display feedback briefly, then move to next prompt or complete
            setTimeout(() => {
                setFeedback(null);
                if (currentIndex + 1 < prompts.length) {
                    setCurrentIndex((prev) => prev + 1);
                } else {
                    setIsCompleted(true);
                }
            }, 1200);

        } catch (err) {
            console.error("Error communicating with server:", err);
        }
    };

    // 1. Completion Screen
    if (isCompleted) {
        return (
            <div style={{ textAlign: 'center', marginTop: '60px' }}>
                <h2>Participant: {studentAlias}</h2>
                <h1 style={{ fontSize: '32px' }}>Privilege Walk Complete</h1>
                <p style={{ fontSize: '22px' }}>Your final position score: <strong>{score}</strong></p>
            </div>
        );
    }

    // 2. Loading State
    if (!prompts.length) {
        return (
            <div style={{ textAlign: 'center', marginTop: '60px' }}>
                <h2>Participant: {studentAlias}</h2>
                <p style={{ fontSize: '20px' }}>Loading prompts from database...</p>
            </div>
        );
    }

    // 3. Active 10-Question Walk View
    return (
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
            <h2>Participant: {studentAlias}</h2>
            <p style={{ fontSize: '18px', color: '#666' }}>
                Question {currentIndex + 1} of {prompts.length}
            </p>

            <h1 style={{ maxWidth: '800px', margin: '30px auto', fontSize: '26px', lineHeight: '1.4' }}>
                {prompts[currentIndex].prompt_text || prompts[currentIndex].question}
            </h1>

            <div style={{ marginBottom: '30px' }}>
                <button 
                    onClick={() => handleAnswer('yes')}
                    style={{ padding: '8px 24px', fontSize: '18px', cursor: 'pointer' }}
                >
                    Yes
                </button>
                <button 
                    onClick={() => handleAnswer('no')}
                    style={{ padding: '8px 24px', fontSize: '18px', marginLeft: '12px', cursor: 'pointer' }}
                >
                    No
                </button>
            </div>

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

export default App;