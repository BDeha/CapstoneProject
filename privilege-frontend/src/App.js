import React, { useState, useEffect } from 'react';

function App() {
  // 1. State Management
  const [studentAlias, setStudentAlias] = useState('');
  const [feedback, setFeedback] = useState(null); // 'ahead' or 'back'
  
// DISADVANTAGE TEST //
  const [currentPrompt, setCurrentPrompt] = useState({ 
    id: 1, 
    question: "Are you right-handed?", 
    type: "advantage" 
  });

// ADVANTAGE TEST //
/*   const [currentPrompt, setCurrentPrompt] = useState({ 
      id: 1, 
      question: "Did you move frequently as a child?", 
      type: "disadvantage" 
    }); */

  // 2. Anonymized Identity Factory
  useEffect(() => {
    const randomId = "User_" + Math.floor(Math.random() * 10000);
    setStudentAlias(randomId);
  }, []);

  // 3. Communication with Express Backend
  const handleAnswer = async (answer) => {
    try {
      const response = await fetch('http://localhost:3000/api/walk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          answer: answer, 
          type: currentPrompt.type,
          alias: studentAlias 
        })
      });

      const data = await response.json();
      
      // 4. Visual Feedback Logic
      if (data.movement === 1) {
        setFeedback('ahead');
      } else if (data.movement === -1) {
        setFeedback('back');
      }
    } catch (error) {
      console.error("Error connecting to server:", error);
    }
  };

  // Only ONE return statement inside the function 
  return (
    <div className="App" style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>Participant: {studentAlias}</h2>
      <p style={{ fontSize: '24px' }}>{currentPrompt.question}</p>
      
      {/* These buttons trigger the scoring logic in Express */}
      <button onClick={() => handleAnswer('yes')}>Yes</button>
      <button onClick={() => handleAnswer('no')}>No</button>

      {/* Visual Cues requested by Dr. Sechrest */}
      {feedback === 'ahead' && (
        <div style={{ backgroundColor: 'green', color: 'white', padding: '20px', marginTop: '20px' }}>
          <h1>Take a step ahead!</h1>
        </div>
      )}
      {feedback === 'back' && (
        <div style={{ backgroundColor: 'red', color: 'white', padding: '20px', marginTop: '20px' }}>
          <h1>Take a step back.</h1>
        </div>
      )}
    </div>
  );
}

export default App;