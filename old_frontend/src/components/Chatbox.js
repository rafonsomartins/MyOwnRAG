import React, { useState } from 'react';
import './Chatbox.css';

const Chatbox = () => {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [messages, setMessages] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const userMessage = { sender: 'user', text: question };
    setMessages([...messages, userMessage]);

    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: question }),
    });

    const data = await res.json();
    const botMessage = { sender: 'bot', text: data.response };
    setMessages([...messages, userMessage, botMessage]);
    setQuestion('');
  };

  return (
    <div className="chatbox-container">
      <div className="chatbox-header">
        <h3>Chat with Me!</h3>
      </div>
      <div className="chatbox-body">
        <div className="chat-messages">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.sender}`}>
              <p>{message.text}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="chatbox-footer">
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask something..."
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
};

export default Chatbox;
