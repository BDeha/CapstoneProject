import React, { useState, useEffect } from 'react';

function App() {
    // Navigation & Auth States
    const [view, setView] = useState('register'); // 'register' | 'id_confirm' | 'login' | 'walk' | 'leaderboard' | 'admin_login' | 'admin_dashboard'
    const [sessionCode, setSessionCode] = useState('');
    const [studentAlias, setStudentAlias] = useState('');
    const [password, setPassword] = useState('');
    const [realName, setRealName] = useState('');
    const [email, setEmail] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Facilitator Admin Auth States
    const [adminUsername, setAdminUsername] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

    // Admin / Facilitator Session Creator States
    const [newSessionName, setNewSessionName] = useState('');
    const [newSessionCode, setNewSessionCode] = useState('');
    const [adminSuccessMsg, setAdminSuccessMsg] = useState('');
    const [activeSessions, setActiveSessions] = useState([]);
    const [allSessions, setAllSessions] = useState([]);
    const [sessionTab, setSessionTab] = useState('active'); // 'active' | 'history'

    // Privilege Walk & Reflection States
    const [prompts, setPrompts] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [feedback, setFeedback] = useState(null); 
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [reflectionText, setReflectionText] = useState('');
    const [reflectionSubmitted, setReflectionSubmitted] = useState(false);

    // Fetch active sessions from backend
    const fetchActiveSessions = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/sessions/active');
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setActiveSessions(data);
            }
        } catch (err) {
            console.error("Error fetching active sessions:", err);
        }
    };

    // Fetch all sessions history from backend
    const fetchAllSessions = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/sessions/all');
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setAllSessions(data);
            }
        } catch (err) {
            console.error("Error fetching all sessions history:", err);
        }
    };

    // Auto-fetch active & history lists whenever facilitator dashboard is active
    useEffect(() => {
        if (view === 'admin_dashboard' && isAdminAuthenticated) {
            fetchActiveSessions();
            fetchAllSessions();
        }
    }, [view, isAdminAuthenticated, sessionTab]);

    // Fetch all prompts when walk view becomes active
    useEffect(() => {
        if (view === 'walk') {
            fetch('http://localhost:3000/api/prompts')
                .then((res) => res.json())
                .then((data) => {
                    if (Array.isArray(data) && data.length > 0) {
                        setPrompts(data);
                    }
                })
                .catch((err) => console.error("Error fetching prompts:", err));
        }
    }, [view]);

    // Fetch leaderboard data when walk is completed
    useEffect(() => {
        if (view === 'leaderboard') {
            fetch('http://localhost:3000/api/leaderboard')
                .then((res) => res.json())
                .then((data) => setLeaderboardData(data))
                .catch((err) => console.error("Error fetching leaderboard:", err));
        }
    }, [view]);

    // Handle Hardcoded Facilitator Login
    const handleAdminLogin = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        try {
            const response = await fetch('http://localhost:3000/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: adminUsername,
                    password: adminPassword
                })
            });

            const data = await response.json();
            if (!response.ok) {
                setErrorMessage(data.error || 'Login failed.');
                return;
            }

            setIsAdminAuthenticated(true);
            setView('admin_dashboard');

            await fetchActiveSessions();
            await fetchAllSessions();
        } catch (err) {
            setErrorMessage('Unable to connect to server.');
        }
    };

    // Handle Admin Session Creation / Reactivation
    const handleCreateSession = async (e) => {
        e.preventDefault();
        setErrorMessage('');
        setAdminSuccessMsg('');

        try {
            const response = await fetch('http://localhost:3000/api/sessions/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_name: newSessionName,
                    session_code: newSessionCode,
                    duration_hours: 2
                })
            });

            const data = await response.json();
            if (!response.ok) {
                setErrorMessage(data.error || 'Failed to create session.');
                return;
            }

            setAdminSuccessMsg(`Session "${data.session_name}" activated with code: ${data.session_code}`);
            setSessionCode(data.session_code); 
            setNewSessionName('');
            setNewSessionCode('');

            const newSessionObj = {
                id: Date.now(),
                session_name: data.session_name,
                session_code: data.session_code,
                created_at: new Date().toISOString()
            };

            setActiveSessions((prevSessions) => {
                const filtered = prevSessions.filter(s => s.session_code !== data.session_code);
                return [newSessionObj, ...filtered];
            });

            setTimeout(() => {
                fetchActiveSessions();
                fetchAllSessions();
            }, 300);

        } catch (err) {
            setErrorMessage('Unable to connect to server.');
        }
    };

    // Handle Ending an Active Session
    const handleEndSession = async (codeToEnd) => {
        setErrorMessage('');
        setAdminSuccessMsg('');

        try {
            const response = await fetch('http://localhost:3000/api/sessions/end', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_code: codeToEnd })
            });

            const data = await response.json();
            if (!response.ok) {
                setErrorMessage(data.error || 'Failed to end session.');
                return;
            }

            setAdminSuccessMsg(`Session "${codeToEnd}" has been officially closed.`);
            setActiveSessions((prev) => prev.filter((s) => s.session_code !== codeToEnd));
            fetchAllSessions();
        } catch (err) {
            console.error("End session fetch error:", err);
            setErrorMessage('Unable to connect to server.');
        }
    };

    // Handle Permanently Deleting a Session from History
    const handleDeleteSession = async (codeToDelete) => {
        if (!window.confirm(`Are you sure you want to permanently delete session "${codeToDelete}"?`)) {
            return;
        }

        setErrorMessage('');
        setAdminSuccessMsg('');

        try {
            const response = await fetch('http://localhost:3000/api/sessions/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_code: codeToDelete })
            });

            const data = await response.json();
            if (!response.ok) {
                setErrorMessage(data.error || 'Failed to delete session.');
                return;
            }

            setAdminSuccessMsg(`Session "${codeToDelete}" permanently deleted.`);
            setAllSessions((prev) => prev.filter((s) => s.session_code !== codeToDelete));
            setActiveSessions((prev) => prev.filter((s) => s.session_code !== codeToDelete));
        } catch (err) {
            console.error("Delete session fetch error:", err);
            setErrorMessage('Unable to connect to server.');
        }
    };

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

            if (data.movement === 1) {
                setFeedback('ahead');
            } else if (data.movement === -1) {
                setFeedback('back');
            } else {
                setFeedback(null);
            }

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

    // Handle Submitting Reflection Text
    const handleSubmitReflection = async (e) => {
        e.preventDefault();
        if (!reflectionText.trim()) return;

        try {
            const response = await fetch('http://localhost:3000/api/reflection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    alias: studentAlias,
                    reflection: reflectionText
                })
            });

            if (response.ok) {
                setReflectionSubmitted(true);
            }
        } catch (err) {
            console.error("Error submitting reflection:", err);
        }
    };

    // Handle Student Exit & Logout
    const handleLogout = () => {
        setSessionCode('');
        setStudentAlias('');
        setPassword('');
        setRealName('');
        setEmail('');
        setScore(0);
        setCurrentIndex(0);
        setReflectionText('');
        setReflectionSubmitted(false);
        setErrorMessage('');
        setView('register');
    };

    // 1. FACILITATOR LOGIN GATE VIEW
    if (view === 'admin_login') {
        return (
            <div style={{ textAlign: 'center', marginTop: '50px' }}>
                <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'left' }}>
                    <h2>Facilitator Portal Login</h2>
                    {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
                    <form onSubmit={handleAdminLogin}>
                        <label>Username:</label>
                        <input
                            type="text"
                            required
                            value={adminUsername}
                            onChange={(e) => setAdminUsername(e.target.value)}
                            style={{ width: '100%', marginBottom: '10px', padding: '8px' }}
                        />

                        <label>Password:</label>
                        <input
                            type="password"
                            required
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            style={{ width: '100%', marginBottom: '15px', padding: '8px' }}
                        />

                        <button type="submit" style={{ width: '100%', padding: '10px', fontSize: '16px', backgroundColor: '#343a40', color: 'white', border: 'none', cursor: 'pointer' }}>
                            Log In as Facilitator
                        </button>
                    </form>
                    <p style={{ marginTop: '15px', textAlign: 'center' }}>
                        <button onClick={() => { setErrorMessage(''); setView('register'); }} style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}>
                            &larr; Back to Student Portal
                        </button>
                    </p>
                </div>
            </div>
        );
    }

    // 2. FACILITATOR SESSION CREATOR & MANAGEMENT DASHBOARD
    if (view === 'admin_dashboard') {
        if (!isAdminAuthenticated) {
            return (
                <div style={{ textAlign: 'center', marginTop: '60px' }}>
                    <p style={{ color: 'red' }}>Access Denied. Please log in as facilitator.</p>
                    <button onClick={() => setView('admin_login')}>Go to Login</button>
                </div>
            );
        }

        return (
            <div style={{ textAlign: 'center', marginTop: '40px' }}>
                <div style={{ maxWidth: '550px', margin: '0 auto', textAlign: 'left' }}>
                    <h2>Facilitator Portal</h2>
                    {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
                    {adminSuccessMsg && <p style={{ color: 'green', fontWeight: 'bold' }}>{adminSuccessMsg}</p>}

                    {/* CREATE SESSION SECTION */}
                    <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px', marginBottom: '25px', backgroundColor: '#fafafa' }}>
                        <h3>Start / Re-activate Session</h3>
                        <form onSubmit={handleCreateSession}>
                            <label>Session Name:</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g., CMSCI 474 Section A"
                                value={newSessionName}
                                onChange={(e) => setNewSessionName(e.target.value)}
                                style={{ width: '100%', marginBottom: '10px', padding: '8px' }}
                            />

                            <label>Session Join Code:</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g., WALK2026"
                                value={newSessionCode}
                                onChange={(e) => setNewSessionCode(e.target.value)}
                                style={{ width: '100%', marginBottom: '15px', padding: '8px' }}
                            />

                            <button type="submit" style={{ width: '100%', padding: '10px', fontSize: '16px', backgroundColor: '#28a745', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
                                Start Active Session
                            </button>
                        </form>
                    </div>

                    {/* SESSION MANAGEMENT TABS */}
                    <div style={{ display: 'flex', borderBottom: '2px solid #ccc', marginBottom: '15px' }}>
                        <button 
                            onClick={() => setSessionTab('active')}
                            style={{
                                padding: '10px 20px',
                                cursor: 'pointer',
                                border: 'none',
                                background: sessionTab === 'active' ? '#007bff' : '#e9ecef',
                                color: sessionTab === 'active' ? 'white' : 'black',
                                fontWeight: 'bold',
                                borderRadius: '4px 4px 0 0',
                                marginRight: '5px'
                            }}
                        >
                            Active Sessions ({activeSessions.length})
                        </button>
                        <button 
                            onClick={() => setSessionTab('history')}
                            style={{
                                padding: '10px 20px',
                                cursor: 'pointer',
                                border: 'none',
                                background: sessionTab === 'history' ? '#007bff' : '#e9ecef',
                                color: sessionTab === 'history' ? 'white' : 'black',
                                fontWeight: 'bold',
                                borderRadius: '4px 4px 0 0'
                            }}
                        >
                            All Sessions History ({allSessions.length})
                        </button>
                    </div>

                    {/* TAB CONTENT: ACTIVE SESSIONS */}
                    {sessionTab === 'active' && (
                        <div style={{ border: '1px solid #007bff', padding: '20px', borderRadius: '8px' }}>
                            {activeSessions.length === 0 ? (
                                <p style={{ color: '#666', fontStyle: 'italic', margin: 0 }}>No active sessions currently running.</p>
                            ) : (
                                activeSessions.map((session) => (
                                    <div key={session.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #eee' }}>
                                        <div>
                                            <strong>{session.session_name}</strong>
                                            <div style={{ fontSize: '13px', color: '#555' }}>Code: <code>{session.session_code}</code></div>
                                        </div>
                                        <button 
                                            onClick={() => handleEndSession(session.session_code)}
                                            style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '6px 12px', cursor: 'pointer', borderRadius: '4px' }}
                                        >
                                            End Session
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* TAB CONTENT: ALL SESSIONS HISTORY */}
                    {sessionTab === 'history' && (
                        <div style={{ border: '1px solid #6c757d', padding: '20px', borderRadius: '8px' }}>
                            {allSessions.length === 0 ? (
                                <p style={{ color: '#666', fontStyle: 'italic', margin: 0 }}>No session history found.</p>
                            ) : (
                                allSessions.map((session) => (
                                    <div key={session.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #eee' }}>
                                        <div>
                                            <strong>{session.session_name}</strong>
                                            <div style={{ fontSize: '13px', color: '#555' }}>Code: <code>{session.session_code}</code></div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ 
                                                padding: '4px 8px', 
                                                borderRadius: '12px', 
                                                fontSize: '12px', 
                                                fontWeight: 'bold',
                                                backgroundColor: session.status === 'active' ? '#28a745' : '#6c757d',
                                                color: 'white'
                                            }}>
                                                {session.status.toUpperCase()}
                                            </span>

                                            <button 
                                                onClick={() => handleDeleteSession(session.session_code)}
                                                style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer', borderRadius: '4px', fontSize: '12px' }}
                                                title="Delete Session"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    <p style={{ marginTop: '25px', textAlign: 'center' }}>
                        <button onClick={() => setView('register')} style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}>
                            &larr; Switch to Student Portal
                        </button>
                    </p>
                </div>
            </div>
        );
    }

    // 3. STUDENT REGISTRATION VIEW
    if (view === 'register') {
        return (
            <div style={{ textAlign: 'center', marginTop: '50px' }}>
                <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2>Student Registration</h2>
                        <button onClick={() => { setErrorMessage(''); setView('admin_login'); }} style={{ background: 'none', border: 'none', color: '#6c757d', cursor: 'pointer', fontSize: '12px' }}>
                            [Facilitator Portal]
                        </button>
                    </div>

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

    // 4. AUTO-ASSIGNED ID CONFIRMATION SCREEN
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

    // 5. STUDENT LOGIN VIEW
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

    // 6. COMPLETION & POST-WALK REFLECTION VIEW
    if (view === 'leaderboard') {
        return (
            <div style={{ textAlign: 'center', marginTop: '40px', paddingBottom: '60px' }}>
                <h2>Participant: {studentAlias}</h2>
                <h1 style={{ fontSize: '32px' }}>Privilege Walk Complete</h1>
                <p style={{ fontSize: '22px' }}>Your final position score: <strong>{score}</strong></p>

                {/* HORIZONTAL CLASS POSITION SPECTRUM */}
                <div style={{ maxWidth: '800px', margin: '30px auto 40px auto' }}>
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

                {/* POST-WALK REFLECTION MODULE */}
                <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'left', border: '1px solid #ccc', padding: '25px', borderRadius: '8px', backgroundColor: '#fafafa' }}>
                    <h3>Post-Walk Reflection</h3>
                    <p style={{ fontSize: '14px', color: '#555', lineHeight: '1.5' }}>
                        Taking a moment to reflect is an essential part of this exercise. How did you feel observing your relative placement along the spectrum compared to your peers?
                    </p>

                    {reflectionSubmitted ? (
                        <p style={{ color: 'green', fontWeight: 'bold', marginTop: '15px' }}>
                            ✓ Your reflection response has been recorded. Thank you for participating!
                        </p>
                    ) : (
                        <form onSubmit={handleSubmitReflection}>
                            <textarea
                                required
                                rows={5}
                                placeholder="Write your reflection response here..."
                                value={reflectionText}
                                onChange={(e) => setReflectionText(e.target.value)}
                                style={{ width: '100%', padding: '10px', fontSize: '14px', marginBottom: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
                            />
                            <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px', fontSize: '15px' }}>
                                Submit Reflection
                            </button>
                        </form>
                    )}
                </div>

                {/* EXIT / LOGOUT CONTROL */}
                <div style={{ marginTop: '35px' }}>
                    <button 
                        onClick={handleLogout}
                        style={{ padding: '10px 24px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}
                    >
                        Exit Exercise & Logout
                    </button>
                </div>
            </div>
        );
    }

    // 7. LOADING STATE
    if (view === 'walk' && !prompts.length) {
        return (
            <div style={{ textAlign: 'center', marginTop: '60px' }}>
                <h2>Participant: {studentAlias}</h2>
                <p style={{ fontSize: '20px' }}>Loading prompts from database...</p>
            </div>
        );
    }

    // 8. ACTIVE PRIVILEGE WALK VIEW
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