// App.js - Modern ChatBot UI
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
		text: "Sorry, a technical error occurred. Please try again later.\n\nFeel free to visit my https://linkedin.com/in/rui-afonso-martins or https://github.com/rafonsomartins for more information.", 
		isUser: false 
	}]);
	} finally {
	setLoading(false);
	}
};

const clearChat = () => {
	setMessages([]);
	setSessionId(null);
	localStorage.removeItem('chatSessionId');
};

// Function to render message text with custom link handling
const renderMessageText = (text) => {
	// Regular expressions for LinkedIn and GitHub URLs - Fixed to properly match https:// prefix
	const linkedInRegex = /(https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s]+)/g;
	const githubRegex = /(https?:\/\/(?:www\.)?github\.com\/[^\s]+)/g;
	const otherUrlRegex = /(https?:\/\/(?!(?:www\.)?linkedin\.com|(?:www\.)?github\.com)[^\s]+)/g;
	
	// Split the text by newlines to preserve formatting
	const lines = text.split('\n');
	
	return lines.map((line, lineIndex) => {
	// Replace LinkedIn URLs with custom markers
	let processedLine = line;
	const linkedInUrls = line.match(linkedInRegex) || [];
	
	linkedInUrls.forEach(url => {
		processedLine = processedLine.replace(url, `|LinkedIn_URL:${url}|`);
	});
	
	// Replace GitHub URLs with custom markers
	const githubUrls = line.match(githubRegex) || [];
	githubUrls.forEach(url => {
		processedLine = processedLine.replace(url, `|Github_URL:${url}|`);
	});
	
	// Handle other URLs normally
	const otherUrls = processedLine.match(otherUrlRegex) || [];
	otherUrls.forEach(url => {
		processedLine = processedLine.replace(url, `|URL:${url}|`);
	});
	
	// Now process the placeholders to create clickable links
	const parts = processedLine.split(/(\|LinkedIn_URL:[^|]+\||\|Github_URL:[^|]+\||\|URL:[^|]+\|)/);

	return (
		<p key={lineIndex}>
		{parts.map((part, partIndex) => {
			// Check for LinkedIn URL
			if (part.startsWith('|LinkedIn_URL:')) {
			const url = part.substring(14, part.length - 1);
			return (
				<a 
				key={partIndex} 
				href={url} 
				target="_blank" 
				rel="noopener noreferrer"
				className="message-link"
				>
				LinkedIn
				</a>
			);
			} 
			// Check for GitHub URL
			else if (part.startsWith('|Github_URL:')) {
			const url = part.substring(12, part.length - 1);
			return (
				<a 
				key={partIndex} 
				href={url} 
				target="_blank" 
				rel="noopener noreferrer"
				className="message-link"
				>
				GitHub
				</a>
			);
			} 
			// Check for any other URL
			else if (part.startsWith('|URL:')) {
			const url = part.substring(5, part.length - 1);
			return (
				<a 
				key={partIndex} 
				href={url} 
				target="_blank" 
				rel="noopener noreferrer"
				className="message-link"
				>
				{url}
				</a>
			);
			}
			
			// Regular text (non-URL part)
			return part;
		})}
		</p>
	);
	});
};

// Group messages by sender
const groupedMessages = [];
let currentGroup = null;

messages.forEach((message) => {
	if (!currentGroup || currentGroup.isUser !== message.isUser) {
	currentGroup = {
		isUser: message.isUser,
		messages: [message]
	};
	groupedMessages.push(currentGroup);
	} else {
	currentGroup.messages.push(message);
	}
});

return (
	<div className="app-container">
	<header className="header">
		<h1>Rui's Assistant</h1>
		<button onClick={clearChat} className="clear-button">Clear Chat</button>
	</header>

	<div className="chat-container">
		<div className="messages">
		{groupedMessages.length === 0 && (
			<div className="welcome-message">
			<h2>Welcome to Rui's Assistant</h2>
			<p>Ask me anything about Rui's background, skills, or experience!</p>
			</div>
		)}
		
		{groupedMessages.map((group, groupIndex) => (
			<div 
			key={groupIndex} 
			className={`message-group ${group.isUser ? 'user-group' : 'bot-group'}`}
			>
			{group.messages.map((message, messageIndex) => (
				<div 
				key={messageIndex} 
				className={`message ${message.isUser ? 'user-message' : 'bot-message'}`}
				>
				{messageIndex === 0 && (
					<div className="message-avatar">
					{message.isUser ? 'U' : 'R'}
					</div>
				)}
				<div className="message-content">
					{renderMessageText(message.text)}
				</div>
				</div>
			))}
			</div>
		))}
		
		{loading && (
			<div className="message-group bot-group">
			<div className="message bot-message">
				<div className="message-avatar">R</div>
				<div className="message-content">
				<div className="typing-indicator">
					<span></span>
					<span></span>
					<span></span>
				</div>
				</div>
			</div>
			</div>
		)}
		
		<div ref={messagesEndRef} />
		</div>

		<div className="input-container">
		<form onSubmit={handleSubmit} className="input-form">
			<input
			type="text"
			value={input}
			onChange={(e) => setInput(e.target.value)}
			placeholder="Ask about Rui..."
			disabled={loading}
			/>
			<button type="submit" disabled={loading || input.trim() === ''}>
			<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				<path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
			</svg>
			</button>
		</form>
		</div>
	</div>
	
	<footer className="footer">
		<p>Powered by Gemini API • Developed by Rui Afonso Martins</p>
	</footer>
	</div>
);
}

export default App;