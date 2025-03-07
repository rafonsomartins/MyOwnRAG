// App.js
import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
const [messages, setMessages] = useState([]);
const [input, setInput] = useState('');
const [loading, setLoading] = useState(false);
const [sessionId, setSessionId] = useState(null);
const messagesEndRef = useRef(null);

useEffect(() => {
	// Scroll to bottom whenever messages change
	messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]);

// Initialize session or load from localStorage
useEffect(() => {
	const savedSessionId = localStorage.getItem('chatSessionId');
	if (savedSessionId) {
	setSessionId(savedSessionId);
	}
}, []);

const handleSubmit = async (e) => {
	e.preventDefault();
	if (input.trim() === '') return;

	// Add user message to chat
	const userMessage = { text: input, isUser: true };
	setMessages(prev => [...prev, userMessage]);
	setLoading(true);
	setInput('');

	try {
	const response = await fetch('http://localhost:8000/query', {
		method: 'POST',
		headers: {
		'Content-Type': 'application/json',
		},
		body: JSON.stringify({
		session_id: sessionId,
		query: input.trim()
		}),
	});

	const data = await response.json();
	
	// Save session ID if it's the first message
	if (!sessionId && data.session_id) {
		setSessionId(data.session_id);
		localStorage.setItem('chatSessionId', data.session_id);
	}

	// Add bot response to chat
	setMessages(prev => [...prev, { text: data.response, isUser: false }]);
	} catch (error) {
	console.error('Error fetching response:', error);
	setMessages(prev => [...prev, { 
		text: "Sorry, there was an error connecting to the server. Please try again.", 
		isUser: false 
	}]);
	} finally {
	setLoading(false);
	}
};

const clearChat = () => {
	setMessages([]);
	// Optionally reset session ID if you want a completely fresh start
	// setSessionId(null);
	// localStorage.removeItem('chatSessionId');
};

return (
	<div className="app-container">
	<header className="header">
		<h1>Rui's Assistant</h1>
		<button onClick={clearChat} className="clear-button">Clear Chat</button>
	</header>

	<div className="chat-container">
		<div className="messages">
		{messages.length === 0 && (
			<div className="welcome-message">
			<h2>Welcome to Rui's Assistant</h2>
			<p>Ask me anything about Rui's background, skills, or experience!</p>
			</div>
		)}
		
		{messages.map((message, index) => (
			<div 
			key={index} 
			className={`message ${message.isUser ? 'user-message' : 'bot-message'}`}
			>
			<div className="message-content">
				{message.text.split('\n').map((text, i) => (
				<p key={i}>{text}</p>
				))}
			</div>
			</div>
		))}
		
		{loading && (
			<div className="message bot-message">
			<div className="message-content">
				<div className="typing-indicator">
				<span></span>
				<span></span>
				<span></span>
				</div>
			</div>
			</div>
		)}
		
		<div ref={messagesEndRef} />
		</div>

		<form onSubmit={handleSubmit} className="input-form">
		<input
			type="text"
			value={input}
			onChange={(e) => setInput(e.target.value)}
			placeholder="Ask about Rui..."
			disabled={loading}
		/>
		<button type="submit" disabled={loading || input.trim() === ''}>
			Send
		</button>
		</form>
	</div>
	
	<footer className="footer">
		<p>Powered by Gemini • Developed by {sessionId ? `Session: ${sessionId.slice(0, 8)}...` : 'New Session'}</p>
	</footer>
	</div>
);
}

export default App;