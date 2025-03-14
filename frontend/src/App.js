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
const [sidebarOpen, setSidebarOpen] = useState(true);

useEffect(() => {
	const savedSessionId = localStorage.getItem('chatSessionId');
	const savedDarkMode = localStorage.getItem('darkMode');
	const savedSidebarState = localStorage.getItem('sidebarOpen');
	
	if (savedSessionId) {
	setSessionId(savedSessionId);
	}
	
	if (savedDarkMode !== null) {
	setDarkMode(JSON.parse(savedDarkMode));
	} else {
	const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
	setDarkMode(prefersDark);
	}
	
	if (savedSidebarState !== null) {
	setSidebarOpen(JSON.parse(savedSidebarState));
	}
	
	window.addEventListener('beforeunload', cleanupSession);
	return () => window.removeEventListener('beforeunload', cleanupSession);
}, []);

useEffect(() => {
	const messagesContainer = document.querySelector('.messages');
	
	const handleWheel = (e) => {
	if (messagesContainer) {
		messagesContainer.scrollTop += e.deltaY;
		e.preventDefault();
	}
	};
	
	messagesContainer?.addEventListener('wheel', handleWheel, { passive: false });
	return () => messagesContainer?.removeEventListener('wheel', handleWheel);
}, []);

useEffect(() => {
	localStorage.setItem('darkMode', JSON.stringify(darkMode));
}, [darkMode]);

useEffect(() => {
	localStorage.setItem('sidebarOpen', JSON.stringify(sidebarOpen));
}, [sidebarOpen]);

useEffect(() => {
	messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]);

useEffect(() => {
	const savedSessionId = localStorage.getItem('chatSessionId');
	if (savedSessionId) {
	setSessionId(savedSessionId);
	}
	
	const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
	setDarkMode(prefersDark);
	
	const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
	const handleChange = (e) => setDarkMode(e.matches);
	mediaQuery.addEventListener('change', handleChange);
	
	return () => mediaQuery.removeEventListener('change', handleChange);
}, []);

useEffect(() => {
	const messagesContainer = document.querySelector('.messages');
	
	const handleWheel = (e) => {
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

useEffect(() => {
	if (textareaRef.current) {
	textareaRef.current.style.height = 'auto';
	textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
	}
}, [input]);

const handleSubmit = async (e) => {
	e.preventDefault();
	if (input.trim() === '') return;

	const userMessage = { text: input, isUser: true, timestamp: new Date() };
	setMessages(prev => [...prev, userMessage]);
	setLoading(true);
	setInput('');

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
	
	if (!sessionId && data.session_id) {
		setSessionId(data.session_id);
		localStorage.setItem('chatSessionId', data.session_id);
	}

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

const cleanupSession = async () => {
	if (sessionId) {
	try {
		await fetch('http://localhost:8000/cleanup-session', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ session_id: sessionId }),
		});
	} catch (error) {
		console.error('Error cleaning up session:', error);
	}
	}
};

const clearChat = async () => {
	await cleanupSession();
	setMessages([]);
	setSessionId(null);
	localStorage.removeItem('chatSessionId');
};

const toggleDarkMode = () => {
	setDarkMode(prev => !prev);
};

const renderMessageText = (text) => {
	const linkedInRegex = /(https?:\/\/(?:www\.)?linkedin\.com\/[^\s]+)/g;
	const githubRegex = /(https?:\/\/(?:www\.)?github\.com\/[^\s]+)/g;
	const otherUrlRegex = /(https?:\/\/(?!(?:www\.)?linkedin\.com|(?:www\.)?github\.com)[^\s]+)/g;
	
	const lines = text.split('\n');
	
	return lines.map((line, lineIndex) => {
	let processedLine = line;
	const linkedInUrls = line.match(linkedInRegex) || [];
	
	linkedInUrls.forEach(url => {
		processedLine = processedLine.replace(url, `|LinkedIn_URL:${url}|`);
	});
	
	const githubUrls = line.match(githubRegex) || [];
	githubUrls.forEach(url => {
		processedLine = processedLine.replace(url, `|Github_URL:${url}|`);
	});
	
	const otherUrls = processedLine.match(otherUrlRegex) || [];
	otherUrls.forEach(url => {
		processedLine = processedLine.replace(url, `|URL:${url}|`);
	});
	
	const parts = processedLine.split(/(\|LinkedIn_URL:[^|]+\||\|Github_URL:[^|]+\||\|URL:[^|]+\|)/);

	return (
		<p key={lineIndex} className="message-line">
		{parts.map((part, partIndex) => {
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
				</a>
			);
			}
			
			return part;
		})}
		</p>
	);
	});
};

return (
	<div className={`app-container ${darkMode ? 'dark-mode' : 'light-mode'}`}>
	<header className={`header ${sidebarOpen ? 'sidebar-open' : ''}`}>
		<div className="header-title-bg"></div>
		<div className="header-content">
		<div className="header-left">
			<button onClick={() => setSidebarOpen(!sidebarOpen)} className="sidebar-toggle">
				{sidebarOpen ? '←' : '→'}
			</button>
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
				<path d="M21 12.79A9 9 0 1 1 11.21 3 A7 7 0 0 0 21 12.79z" />
				</svg>
			)}
			</button>
			<button onClick={clearChat} className="clear-button">New Chat</button>
		</div>
		</div>
	</header>

	<div className="main-content">
		<div className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
		<div className="suggested-questions">
			<div className="suggestions-label">Suggested questions</div>
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
				e.target.style.height = 'auto';
				e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
				}}
				onKeyDown={(e) => {
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
	</div>
	
	<footer className="footer">
		<p>© {new Date().getFullYear()} Rui Afonso Martins</p>
	</footer>
	</div>
);
}

export default App;