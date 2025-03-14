import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
const [messages, setMessages] = useState([]);
const [input, setInput] = useState('');
const [loading, setLoading] = useState(false);
const [sessionId, setSessionId] = useState(null);
const messagesEndRef = useRef(null);
const [darkMode, setDarkMode] = useState(false);
const textareaRef = useRef(null);

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
	
	// Check system color scheme preference
	const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
	setDarkMode(prefersDark);
	
	// Add listener for changes in color scheme preference
	const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
	const handleChange = (e) => setDarkMode(e.matches);
	mediaQuery.addEventListener('change', handleChange);
	
	return () => mediaQuery.removeEventListener('change', handleChange);
}, []);

// Add this useEffect to adjust scroll sensitivity
useEffect(() => {
	const messagesContainer = document.querySelector('.messages');
	
	const handleWheel = (e) => {
	// Reduce scroll speed by dividing delta
	if (messagesContainer) {
		messagesContainer.scrollTop += e.deltaY / 2;
		e.preventDefault();
	}
	};
	
	messagesContainer?.addEventListener('wheel', handleWheel, { passive: false });
	
	return () => {
	messagesContainer?.removeEventListener('wheel', handleWheel);
	};
}, []);

// Auto-resize textarea initially
useEffect(() => {
	if (textareaRef.current) {
	textareaRef.current.style.height = 'auto';
	textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
	}
}, [input]);

const handleSubmit = async (e) => {
	e.preventDefault();
	if (input.trim() === '') return;

	// Add user message to chat
	const userMessage = { text: input, isUser: true, timestamp: new Date() };
	setMessages(prev => [...prev, userMessage]);
	setLoading(true);
	setInput('');

	// Reset textarea height
	if (textareaRef.current) {
	textareaRef.current.style.height = 'auto';
	}

	try {
	const response = await fetch('http://localhost:8000/query', {
		method: 'POST',
		headers: {
		'Content-Type': 'application/json',
		},
		body: JSON.stringify({
		session_id: sessionId,
		query: userMessage.text.trim()
		}),
	});

	const data = await response.json();
	
	// Save session ID if it's the first message
	if (!sessionId && data.session_id) {
		setSessionId(data.session_id);
		localStorage.setItem('chatSessionId', data.session_id);
	}

	// Add bot response to chat
	setMessages(prev => [...prev, { 
		text: data.response, 
		isUser: false, 
		timestamp: new Date() 
	}]);
	} catch (error) {
	console.error('Error fetching response:', error);
	setMessages(prev => [...prev, { 
		text: "Sorry, a technical error occurred. Please try again later.", 
		isUser: false,
		timestamp: new Date()
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

const toggleDarkMode = () => {
	setDarkMode(prev => !prev);
};

// Function to render message text with updated link handling
const renderMessageText = (text) => {
	// Regular expressions for LinkedIn and GitHub URLs
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
		<p key={lineIndex} className="message-line">
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
				<svg className="link-icon" viewBox="0 0 24 24" width="16" height="16">
					<path d="M15 3h6v6" />
					<path d="M10 14L21 3" />
					<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
				</svg>
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
				<svg className="link-icon" viewBox="0 0 24 24" width="16" height="16">
					<path d="M15 3h6v6" />
					<path d="M10 14L21 3" />
					<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
				</svg>
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
				{url.length > 30 ? url.substring(0, 30) + '...' : url}
				<svg className="link-icon" viewBox="0 0 24 24" width="16" height="16">
					<path d="M15 3h6v6" />
					<path d="M10 14L21 3" />
					<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
				</svg>
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

// Format timestamp
const formatTime = (date) => {
	return new Intl.DateTimeFormat('en-US', {
	hour: 'numeric',
	minute: 'numeric',
	hour12: true
	}).format(date);
};

return (
	<div className={`app-container ${darkMode ? 'dark-mode' : 'light-mode'}`}>
	<header className="header">
		<div className="header-left">
		<h1>Rui's Assistant</h1>
		</div>
		<div className="header-right">
		<button onClick={toggleDarkMode} className="icon-button theme-toggle" aria-label="Toggle dark mode">
			{darkMode ? (
			<svg viewBox="0 0 24 24" width="20" height="20">
				<circle cx="12" cy="12" r="5" />
				<path d="M12 1v2" />
				<path d="M12 21v2" />
				<path d="M4.22 4.22l1.42 1.42" />
				<path d="M18.36 18.36l1.42 1.42" />
				<path d="M1 12h2" />
				<path d="M21 12h2" />
				<path d="M4.22 19.78l1.42-1.42" />
				<path d="M18.36 5.64l1.42-1.42" />
			</svg>
			) : (
			<svg viewBox="0 0 24 24" width="20" height="20">
				<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
			</svg>
			)}
		</button>
		<button onClick={clearChat} className="clear-button">New Chat</button>
		</div>
	</header>

	<div className="chat-container">
		<div className="messages">
		{messages.length === 0 && (
			<div className="welcome-section">
			<div className="welcome-content">
				<h2>Welcome to Rui's Assistant</h2>
				<p>I can help you learn about Rui's skills, experience, and background. What would you like to know?</p>
				
				<div className="suggested-questions">
				<button 
					onClick={() => {
					setInput("Tell me about Rui's professional experience");
					setTimeout(() => handleSubmit({ preventDefault: () => {} }), 100);
					}}
					className="question-button"
				>
					Professional experience
				</button>
				<button 
					onClick={() => {
					setInput("What are Rui's technical skills?");
					setTimeout(() => handleSubmit({ preventDefault: () => {} }), 100);
					}}
					className="question-button"
				>
					Technical skills
				</button>
				<button 
					onClick={() => {
					setInput("Where can I find Rui's portfolio?");
					setTimeout(() => handleSubmit({ preventDefault: () => {} }), 100);
					}}
					className="question-button"
				>
					Portfolio
				</button>
				</div>
			</div>
			</div>
		)}
		
		{messages.map((message, messageIndex) => (
			<div 
			key={messageIndex} 
			className={`message ${message.isUser ? 'user-message' : 'assistant-message'}`}
			>
			<div className="message-wrapper">
				<div className="message-content">
				<div className="message-header">
					<span className="message-author">{message.isUser ? 'You' : 'Rui\'s Assistant'}</span>
					{message.timestamp && (
					<span className="message-time">{formatTime(message.timestamp)}</span>
					)}
				</div>
				<div className="message-body">
					{renderMessageText(message.text)}
				</div>
				</div>
			</div>
			</div>
		))}
		
		{loading && (
			<div className="message assistant-message">
			<div className="message-wrapper">
				<div className="message-content">
				<div className="message-header">
					<span className="message-author">Rui's Assistant</span>
				</div>
				<div className="message-body">
					<div className="typing-indicator">
					<span></span>
					<span></span>
					<span></span>
					</div>
				</div>
				</div>
			</div>
			</div>
		)}
		
		<div ref={messagesEndRef} />
		</div>

		<div className="input-container">
		<form onSubmit={handleSubmit} className="input-form">
			<textarea
			ref={textareaRef}
			value={input}
			onChange={(e) => {
				setInput(e.target.value);
				// Auto-resize
				e.target.style.height = 'auto';
				e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
			}}
			onKeyDown={(e) => {
				// Allow Shift+Enter for newlines, but submit on Enter without shift
				if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				handleSubmit(e);
				}
			}}
			placeholder="Ask about Rui..."
			disabled={loading}
			className="message-input"
			rows="1"
			/>
			<button 
			type="submit" 
			disabled={loading || input.trim() === ''}
			className="send-button"
			aria-label="Send message"
			>
			<svg viewBox="0 0 24 24" width="20" height="20">
				<path d="M5 12h14" />
				<path d="M12 5l7 7-7 7" />
			</svg>
			</button>
		</form>
		</div>
	</div>
	
	<footer className="footer">
		<p>© {new Date().getFullYear()} Rui Afonso Martins</p>
	</footer>
	</div>
);
}

export default App;