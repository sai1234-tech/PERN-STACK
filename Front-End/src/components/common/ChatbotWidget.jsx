import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useChatbot } from "../../hooks/useChatbot";
import { useEnterpriseOps } from "../../hooks/useEnterpriseOps";
import { normalizeRole } from "../../utils/auth";
import "./Chatbot.css";

export default function ChatbotWidget() {
  const { user } = useAuth();
  const role = normalizeRole(user);
  const navigate = useNavigate();
  const { processQuery, pendingAction, setPendingAction } = useChatbot();
  
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: "bot", text: `Hi ${user?.name || "there"}! I'm your AI HR Assistant from Quadratic Software Inc. How can I help you today?` }
  ]);
  const [input, setInput] = useState("");
  
  const messagesEndRef = useRef(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = (textOverride) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;

    // Add user message
    const newMessages = [...messages, { sender: "user", text: textToSend }];
    setMessages(newMessages);
    setInput("");

    // Process intent
    setTimeout(() => {
      const response = processQuery(textToSend);
      setMessages(prev => [...prev, { sender: "bot", text: response.text, link: response.link, actions: response.actions }]);
    }, 600); // Simulate network latency
  };

  const { addTicket } = useEnterpriseOps();

  const handleAction = async (action) => {
    if (action === "Cancel") {
      handleSend("Cancel");
    } else if (action === "Confirm" || action === "Proceed") {
      handleSend("Confirm");
    } else if (action === "Create Ticket" || action === "Raise HR Ticket") {
      const lastUserMsg = [...messages].reverse().find(m => m.sender === "user")?.text || "General Support Inquiry";
      const empCode = user?.employeeCode || user?.employeeId || "EM0175";
      const empName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.name || user?.email || "Employee";
      const empDisplay = `${empName} (${empCode})`;
      const ticketId = await addTicket(empDisplay, lastUserMsg);
      setMessages(prev => [...prev, { sender: "bot", text: `HR Support Ticket created successfully. Reference ID: ${ticketId}. HR Operations team has been notified and will review this shortly.` }]);
    }
  };

  const handleSuggestion = (suggestion) => {
    handleSend(suggestion);
  };

  const employeeSuggestions = ["Check Leave Balance", "Apply for Leave", "View Timesheets", "Show My Payslip", "HR Policies"];
  const hrSuggestions = ["Search Candidates", "Candidates in Interview", "Onboard John Doe", "View Bench Matrix"];

  const suggestions = role === "hr" || role === "admin" ? hrSuggestions : employeeSuggestions;

  return (
    <div className={`chatbot-container ${isOpen ? 'open' : ''}`}>
      {!isOpen && (
        <button className="chatbot-fab" onClick={() => setIsOpen(true)}>
          <span className="fab-icon" style={{ fontStyle: "italic", fontWeight: "900", fontFamily: "serif" }}>Q</span>
        </button>
      )}

      {isOpen && (
        <div className="chatbot-window">
          <header className="chatbot-header">
            <div className="cb-head-info">
              <span className="cb-bot-icon" style={{ fontStyle: "italic", fontWeight: "900", fontFamily: "serif", background: "white", color: "#1e40af", padding: "0.2rem 0.6rem" }}>Q</span>
              <div>
                <h4>Quadratic Software Inc.</h4>
                <span className="cb-status">🟢 Online</span>
              </div>
            </div>
            <button className="cb-close-btn" onClick={() => setIsOpen(false)}>✕</button>
          </header>

          <div className="chatbot-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-bubble-wrapper ${msg.sender}`}>
                {msg.sender === "bot" && <span className="chat-avatar" style={{ fontStyle: "italic", fontWeight: "900", fontFamily: "serif", color: "#2563eb" }}>Q</span>}
                <div className={`chat-bubble ${msg.sender}`}>
                  <p>{msg.text}</p>
                  
                  {msg.link && (
                    <button className="chat-link-btn" onClick={() => navigate(msg.link)}>
                      Go to Page ➔
                    </button>
                  )}

                  {msg.actions && (
                    <div className="chat-actions">
                      {msg.actions.map(action => (
                        <button key={action} className={`action-btn ${action.toLowerCase()}`} onClick={() => handleAction(action)}>
                          {action}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="chatbot-suggestions-wrapper">
            <div className="chatbot-suggestions">
              {suggestions.map(s => (
                <button key={s} className="suggestion-chip" onClick={() => handleSuggestion(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="chatbot-input-area">
            <input 
              type="text" 
              placeholder="Ask me anything..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <button className="cb-send-btn" onClick={() => handleSend()}>➤</button>
          </div>
        </div>
      )}
    </div>
  );
}
