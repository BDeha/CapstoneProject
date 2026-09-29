import React, { useState, useEffect } from 'react';

function App() {
    // Navigation & Auth States
    const [view, setView] = useState('register'); // 'register' | 'id_confirm' | 'login' | 'walk' | 'leaderboard'
    const [sessionCode, setSessionCode] = useState('WALK2026');
    const [studentAlias, setStudentAlias] = useState('');
    const [password, setPassword] = useState('');
    const [realName, setRealName] = useState('');
    const [email, setEmail] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Privilege Walk States
    const [prompts, setPrompts] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [feedback, setFeedback] = useState(null); // 'ahead' or 'back'
    const [leaderboardData, setLeaderboardData] = useState([]);

    // Fetch all prompts when walk view becomes active
    useEffect(() => {
        if (view === 'walk') {
            fetch('http://localhost:3000/api/prompts')
                .then((res) => res.json())
                .then((data) => {
                    if (Array.isArray(data) && data.length > 0) {
                        setPrompts(data); // Fetches all prompts in fixed sequence
                    }
                })
                .catch((err) => console.error("Error fetching prompts:", err));
        }
    }, [view]);

    // Fetch leaderboard data when reaching the end view
    useEffect(() => {
        if (view === 'leaderboard') {
            fetch('http://localhost:3000/api/leaderboard')
                .then((res) => res.json())
                .then((data) => setLeaderboardData(data))
                .catch((err) => console.error("Error fetching leaderboard:", err));
        }
    }, [view]);

    // Handle Student Registration
    const handleRegister = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        try {
            const response = await fetch('http://localhost:3000/api/students/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    real_name: realName,
                    email: email,
                    password: password,
                    session_code: sessionCode
                })
            });

            const data = await response.json();
            if (!response.ok) {
                setErrorMessage(data.error || 'Registration failed.');
                return;
            }

            setStudentAlias(data.assigned_alias);
            setView('id_confirm');
        } catch (err) {
            setErrorMessage('Unable to connect to server.');
        }
    };

    // Handle Student Login
    const handleLogin = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        try {
            const response = await fetch('http://localhost:3000/api/students/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assigned_alias: studentAlias,
                    password: password
                })
            });

            const data = await response.json();
            if (!response.ok) {
                setErrorMessage(data.error || 'Login failed.');
                return;
            }

            setView('walk');
        } catch (err) {
            setErrorMessage('Unable to connect to server.');
        }
    };

    // Handle Prompt Answers
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

            // Display feedback briefly, then move to next prompt or transition to leaderboard
            setTimeout(() => {
                setFeedback(null);
                if (currentIndex + 1 < prompts.length) {
                    setCurrentIndex((prev) => prev + 1);
                } else {
                    setView('leaderboard');
                }
            }, 1200);

        } catch (err) {
            console.error("Error communicating with server:", err);
        }
    };

    // 1. Student Registration View
    if (view === 'register') {
        return (
            <div style={{ textAlign: 'center', marginTop: '50px' }}>
                <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'left' }}>
                    <h2>Student Registration</h2>
                    {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
                    <form onSubmit={handleRegister}>
                        <label>Full Name:</label>
                        <input
                            type="text"
                            required
                            value={realName}
                            onChange={(e) => setRealName(e.target.value)}
                            style={{ width: '100%', marginBottom: '10px', padding: '8px' }}
                        />

                        <label>Email Address:</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{ width: '100%', marginBottom: '10px', padding: '8px' }}
                        />

                        <label>Password:</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ width: '100%', marginBottom: '10px', padding: '8px' }}
                        />

                        <label>Session Code:</label>
                        <input
                            type="text"
                            required
                            value={sessionCode}
                            onChange={(e) => setSessionCode(e.target.value)}
                            style={{ width: '100%', marginBottom: '15px', padding: '8px' }}
                        />

                        <button type="submit" style={{ width: '100%', padding: '10px', fontSize: '16px', cursor: 'pointer' }}>
                            Register
                        </button>
                    </form>
                    <p style={{ marginTop: '15px' }}>
                        Already registered?{' '}
                        <button onClick={() => { setErrorMessage(''); setView('login'); }} style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}>
                            Log In
                        </button>
                    </p>
                </div>
            </div>
        );
    }

    // 2. Auto-Assigned ID Confirmation Screen
    if (view === 'id_confirm') {
        return (
            <div style={{ textAlign: 'center', marginTop: '60px' }}>
                <div style={{ maxWidth: '400px', margin: '0 auto', border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
                    <h2>Registration Complete!</h2>
                    <p>Your auto-assigned anonymous ID is:</p>
                    <h1 style={{ fontSize: '32px', color: 'green' }}>{studentAlias}</h1>
                    <p style={{ fontSize: '14px', color: '#666' }}>
                        Please remember or write down this ID along with your password to log in.
                    </p>
                    <button onClick={() => setView('login')} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>
                        Proceed to Login
                    </button>
                </div>
            </div>
        );
    }

    // 3. Student Login View
    if (view === 'login') {
        return (
            <div style={{ textAlign: 'center', marginTop: '50px' }}>
                <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'left' }}>
                    <h2>Student Login</h2>
                    {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
                    <form onSubmit={handleLogin}>
                        <label>Assigned ID (e.g., User_4821):</label>
                        <input
                            type="text"
                            required
                            value={studentAlias}
                            onChange={(e) => setStudentAlias(e.target.value)}
                            style={{ width: '100%', marginBottom: '10px', padding: '8px' }}
                        />

                        <label>Password:</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ width: '100%', marginBottom: '15px', padding: '8px' }}
                        />

                        <button type="submit" style={{ width: '100%', padding: '10px', fontSize: '16px', cursor: 'pointer' }}>
                            Enter Walk Session
                        </button>
                    </form>
                    <p style={{ marginTop: '15px' }}>
                        Need an account?{' '}
                        <button onClick={() => { setErrorMessage(''); setView('register'); }} style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}>
                            Register Here
                        </button>
                    </p>
                </div>
            </div>
        );
    }

    // 4. Completion View (Horizontal Leaderboard Spectrum)
    if (view === 'leaderboard') {
        return (
            <div style={{ textAlign: 'center', marginTop: '50px' }}>
                <h2>Participant: {studentAlias}</h2>
                <h1 style={{ fontSize: '32px' }}>Privilege Walk Complete</h1>
                <p style={{ fontSize: '22px' }}>Your final position score: <strong>{score}</strong></p>

                <div style={{ maxWidth: '800px', margin: '40px auto 0 auto' }}>
                    <h3>Class Position Spectrum</h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '10px' }}>
                        <span>&larr; Further Behind</span>
                        <span>Furthest Ahead &rarr;</span>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-around',
                        backgroundColor: '#f0f0f0',
                        border: '2px solid #ccc',
                        borderRadius: '10px',
                        padding: '20px 10px',
                        minHeight: '80px',
                        overflowX: 'auto'
                    }}>
                        {leaderboardData.map((student, idx) => (
                            <div
                                key={idx}
                                style={{
                                    padding: '10px 15px',
                                    borderRadius: '20px',
                                    backgroundColor: student.student_alias === studentAlias ? '#007bff' : '#6c757d',
                                    color: 'white',
                                    fontWeight: student.student_alias === studentAlias ? 'bold' : 'normal',
                                    boxShadow: student.student_alias === studentAlias ? '0px 0px 10px #0056b3' : 'none'
                                }}
                            >
                                {student.student_alias} ({student.total_score})
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // 5. Loading State (Only triggers when actively in walk mode and waiting for prompts)
    if (view === 'walk' && !prompts.length) {
        return (
            <div style={{ textAlign: 'center', marginTop: '60px' }}>
                <h2>Participant: {studentAlias}</h2>
                <p style={{ fontSize: '20px' }}>Loading prompts from database...</p>
            </div>
        );
    }

    // 6. Active Privilege Walk View
    return (
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
            <h2>Participant: {studentAlias}</h2>
            <p style={{ fontSize: '18px', color: '#666' }}>
                Question {currentIndex + 1} of {prompts.length}
            </p>

            <h1 style={{ maxWidth: '800px', margin: '30px auto', fontSize: '26px', lineHeight: '1.4' }}>
                {prompts[currentIndex].prompt_text || prompts[currentIndex].question || prompts[currentIndex].text}
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