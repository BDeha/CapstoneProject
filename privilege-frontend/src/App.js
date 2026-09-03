import React, { useState, useEffect } from 'react';

function App() {
  // State Management
  const [studentAlias, setStudentAlias] = useState('');
  const [feedback, setFeedback] = useState(null); // 'ahead' or 'back'
  const [prompts, setPrompts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  // Anonymized Identity Factory & Fetch Prompts on Mount
  useEffect(() => {
    const randomId = "User_" + Math.floor(Math.random() * 10000);
    setStudentAlias(randomId);

    // Fetch dynamic prompts from Express API connected to MySQL
    fetch('http://localhost:3000/api/prompts')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setPrompts(data);
        }
      })
      .catch((error) => console.error("Error fetching prompts:", error));
  }, []);

  // Communication with Express Backend
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
      
      // Update persistent score from server response
      setScore(data.total_score);
      
      // Visual Feedback Logic
      if (data.movement === 1) {
        setFeedback('ahead');
      } else if (data.movement === -1) {
        setFeedback('back');
      } else {
        setFeedback(null);
      }

      // Allow student to see visual cue, then transition to next prompt
      setTimeout(() => {
        setFeedback(null);
        if (currentIndex + 1 < prompts.length) {
          setCurrentIndex((prev) => prev + 1);
        } else {
          setIsCompleted(true);
        }
      }, 1500);

    } catch (error) {
      console.error("Error connecting to server:", error);
    }
  };

  // Completion View
  if (isCompleted) {
    return (
      <div className="App" style={{ textAlign: 'center', marginTop: '50px' }}>
        <h2>Participant: {studentAlias}</h2>
        <h1>Privilege Walk Complete</h1>
        <p style={{ fontSize: '22px' }}>Your final position score: <strong>{score}</strong></p>
      </div>
    );
  }

  // Loading View while fetching MySQL prompts
  if (!prompts.length) {
    return (
      <div className="App" style={{ textAlign: 'center', marginTop: '50px' }}>
        <h2>Participant: {studentAlias}</h2>
        <p style={{ fontSize: '20px' }}>Loading prompts from database...</p>
      </div>
    );
  }

  // Active Walk View
  return (
    <div className="App" style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>Participant: {studentAlias}</h2>
      <p style={{ fontSize: '24px' }}>
        {prompts[currentIndex].prompt_text || prompts[currentIndex].question}
      </p>
      
      {/* These buttons trigger the scoring logic in Express */}
      <button onClick={() => handleAnswer('yes')}>Yes</button>
      <button onClick={() => handleAnswer('no')} style={{ marginLeft: '10px' }}>No</button>

      {/* Visual Cues Dr. Sechrest wanted */}
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