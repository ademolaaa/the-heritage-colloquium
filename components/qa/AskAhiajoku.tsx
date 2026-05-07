import React, { useEffect, useState, useRef } from 'react';
import { Section } from '../Section';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/qa';
const CHATBOT_API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/chatbot';

interface Answer {
  id: string;
  content: string;
  responder_name?: string;
  createdAt: string;
}

interface Question {
  id: string;
  title?: string; // Optional if coming from old structure, but new structure has it removed from UI but kept in DB? No, DB has content.
  content: string;
  user_name: string;
  is_answered: boolean;
  answers_count: number;
  createdAt: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const AskAhiajoku: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'chatbot' | 'community'>('community');
  
  // Community Q&A State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ content: '', category: 'General' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [newAnswer, setNewAnswer] = useState('');

  // Chatbot State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Nno! I am Ahiajoku, the spirit of the harvest and guardian of our heritage. How may I assist you today?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, activeTab]);

  const fetchQuestions = async () => {
    try {
      const res = await fetch(`${API_BASE}/questions?limit=20`);
      const json = await res.json();
      if (json.ok) {
        setQuestions(json.items);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'community') {
      fetchQuestions();
    }
  }, [activeTab]);

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.content.trim()) return;
    
    try {
      const res = await fetch(`${API_BASE}/questions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(newQuestion)
      });
      const json = await res.json();
      if (json.ok) {
        // Optimistically add
        const created: Question = {
            id: json.item.id,
            content: newQuestion.content,
            user_name: user?.username || 'You',
            is_answered: false,
            answers_count: 0,
            createdAt: json.item.createdAt
        };
        setQuestions([created, ...questions]);
        setNewQuestion({ content: '', category: 'General' });
        setShowForm(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    
    setExpandedId(id);
    setLoadingAnswers(true);
    setNewAnswer('');
    try {
      const res = await fetch(`${API_BASE}/questions/${id}/answers`);
      const json = await res.json();
      if (json.ok) {
        setAnswers(json.items);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAnswers(false);
    }
  };

  const handleSubmitAnswer = async (e: React.FormEvent, questionId: string) => {
    e.preventDefault();
    if (!newAnswer.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/questions/${questionId}/answers`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ content: newAnswer })
      });
      const json = await res.json();
      if (json.ok) {
        const created: Answer = {
            id: json.item.id,
            content: newAnswer,
            responder_name: user?.username || 'You',
            createdAt: json.item.createdAt
        };
        setAnswers([...answers, created]);
        setNewAnswer('');
        
        // Update question answer count locally
        setQuestions(questions.map(q => 
            q.id === questionId ? { ...q, answers_count: (Number(q.answers_count) || 0) + 1, is_answered: true } : q
        ));
      }
    } catch (e) {
        console.error(e);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const message = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: message }]);
    setChatLoading(true);

    try {
      const res = await fetch(`${CHATBOT_API_BASE}/ask`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ message })
      });
      const json = await res.json();
      
      if (json.ok) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: json.reply }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: "The spirits are silent (Error: " + (json.error || 'Unknown') + ")" }]);
      }
    } catch (e) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: "I cannot hear you clearly right now. Please try again later." }]);
    } finally {
        setChatLoading(false);
    }
  };

  return (
    <Section background="pattern" className="pt-32 pb-20">
      <div className="container mx-auto max-w-4xl px-6">
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl text-white mb-4">Ask Ahiajoku</h1>
          <p className="text-gray-400 font-light max-w-2xl mx-auto">
            Seek wisdom from the deity or consult the community.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-10 border-b border-white/10">
            <button
                onClick={() => setActiveTab('community')}
                className={`px-8 py-4 text-sm uppercase tracking-widest transition-colors border-b-2 ${
                    activeTab === 'community' 
                    ? 'border-gold-500 text-gold-500' 
                    : 'border-transparent text-gray-500 hover:text-white'
                }`}
            >
                Community Q&A
            </button>
            <button
                onClick={() => setActiveTab('chatbot')}
                className={`px-8 py-4 text-sm uppercase tracking-widest transition-colors border-b-2 ${
                    activeTab === 'chatbot' 
                    ? 'border-gold-500 text-gold-500' 
                    : 'border-transparent text-gray-500 hover:text-white'
                }`}
            >
                Consult the Deity
            </button>
        </div>

        {/* Community Tab */}
        {activeTab === 'community' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {!user && (
                    <div className="bg-charcoal/50 border border-gold-500/20 p-6 mb-8 text-center rounded-sm">
                        <p className="text-gray-300 mb-4">Join the community to ask questions and share your knowledge.</p>
                        <div className="flex justify-center gap-4">
                            <Link to="/login"><Button variant="outline">Sign In</Button></Link>
                            <Link to="/register"><Button>Join Now</Button></Link>
                        </div>
                    </div>
                )}

                {user && (
                    <div className="flex justify-center mb-10">
                        <Button onClick={() => setShowForm(!showForm)}>
                            {showForm ? 'Cancel Question' : 'Ask the Community'}
                        </Button>
                    </div>
                )}

                {showForm && user && (
                <div className="mb-12 border border-white/10 bg-charcoal/50 p-8 rounded-sm animate-in fade-in slide-in-from-top-4">
                    <h3 className="text-white text-xl font-display mb-6">Submit your Question</h3>
                    <form onSubmit={handleAskQuestion} className="space-y-6">
                    <div>
                        <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Your Question</label>
                        <textarea
                        className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white focus:border-gold-500 focus:outline-none"
                        rows={4}
                        value={newQuestion.content}
                        onChange={e => setNewQuestion({...newQuestion, content: e.target.value})}
                        placeholder="What would you like to know?"
                        required
                        />
                    </div>
                    <Button type="submit" className="w-full">Submit Question</Button>
                    </form>
                </div>
                )}

                <div className="space-y-4">
                {loading ? (
                    <div className="text-center text-gray-500">Loading questions...</div>
                ) : questions.length === 0 ? (
                    <div className="text-center text-gray-500 py-10">No questions yet. Be the first to ask!</div>
                ) : (
                    questions.map(q => (
                    <div key={q.id} className="border border-white/5 bg-charcoal/30 hover:bg-charcoal/50 transition-colors">
                        <div 
                        className="p-6 cursor-pointer flex justify-between items-start"
                        onClick={() => handleExpand(q.id)}
                        >
                        <div className="flex-1">
                            <div className="text-white text-lg font-medium mb-3 leading-relaxed">{q.content}</div>
                            <div className="flex gap-4 text-xs text-gray-500 items-center">
                            <span className="text-gold-500/80">{q.user_name}</span>
                            <span>•</span>
                            <span>{new Date(q.createdAt).toLocaleDateString()}</span>
                            <span>•</span>
                            <span className={`${q.is_answered ? 'text-green-400' : 'text-gray-400'}`}>
                                {q.is_answered ? 'Answered' : 'Pending'}
                            </span>
                            <span>•</span>
                            <span>{q.answers_count} answers</span>
                            </div>
                        </div>
                        <div className={`ml-4 transform transition-transform ${expandedId === q.id ? 'rotate-180' : ''} text-gray-500`}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                        </div>
                        </div>

                        {expandedId === q.id && (
                        <div className="px-6 pb-6 pt-0 border-t border-white/5">
                            <div className="mt-6 mb-8">
                                <h4 className="text-xs uppercase tracking-widest text-gray-500 mb-4">Answers</h4>
                                
                                {loadingAnswers ? (
                                <div className="text-xs text-gray-500">Loading answers...</div>
                                ) : answers.length > 0 ? (
                                <div className="space-y-4">
                                    {answers.map(a => (
                                    <div key={a.id} className="bg-black/30 p-4 border-l-2 border-gold-500">
                                        <div className="text-gray-300 mb-2 whitespace-pre-wrap">{a.content}</div>
                                        <div className="text-xs text-gray-500">— {a.responder_name || 'Anonymous'}</div>
                                    </div>
                                    ))}
                                </div>
                                ) : (
                                <div className="text-sm text-gray-500 italic">No answers yet.</div>
                                )}
                            </div>
                            
                            {user ? (
                                <form onSubmit={(e) => handleSubmitAnswer(e, q.id)} className="mt-6 pt-6 border-t border-white/5">
                                    <h5 className="text-xs uppercase tracking-widest text-gray-500 mb-2">Add your answer</h5>
                                    <textarea
                                        className="w-full bg-black/50 border border-white/10 px-4 py-2 text-white focus:border-gold-500 focus:outline-none text-sm mb-3"
                                        rows={2}
                                        value={newAnswer}
                                        onChange={e => setNewAnswer(e.target.value)}
                                        placeholder="Share your knowledge..."
                                        required
                                    />
                                    <div className="flex justify-end">
                                        <Button type="submit" variant="outline" className="!py-2 !px-4 !text-xs">Post Answer</Button>
                                    </div>
                                </form>
                            ) : (
                                <div className="text-center pt-4 border-t border-white/5">
                                    <p className="text-xs text-gray-500"><Link to="/login" className="text-gold-500 hover:underline">Sign in</Link> to answer.</p>
                                </div>
                            )}
                        </div>
                        )}
                    </div>
                    ))
                )}
                </div>
            </div>
        )}

        {/* Chatbot Tab */}
        {activeTab === 'chatbot' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {!user ? (
                    <div className="bg-charcoal/50 border border-gold-500/20 p-8 text-center rounded-sm max-w-2xl mx-auto">
                        <div className="w-16 h-16 bg-gold-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-gold-500">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-display text-white mb-2">Consult the Oracle</h3>
                        <p className="text-gray-400 mb-6">Sign in to converse with the digital spirit of Ahiajoku.</p>
                        <div className="flex justify-center gap-4">
                            <Link to="/login"><Button variant="outline">Sign In</Button></Link>
                            <Link to="/register"><Button>Join Now</Button></Link>
                        </div>
                    </div>
                ) : (
                    <div className="bg-charcoal/50 border border-white/10 rounded-sm flex flex-col h-[600px] max-w-3xl mx-auto">
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {chatMessages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-lg p-4 ${
                                        msg.role === 'user' 
                                        ? 'bg-gold-500 text-black' 
                                        : 'bg-black/40 text-gray-200 border border-white/5'
                                    }`}>
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                    </div>
                                </div>
                            ))}
                            {chatLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-black/40 text-gray-400 border border-white/5 rounded-lg p-4 flex gap-2 items-center">
                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef}></div>
                        </div>
                        
                        <div className="p-4 border-t border-white/10 bg-black/20">
                            <form onSubmit={handleChatSubmit} className="flex gap-4">
                                <input
                                    className="flex-1 bg-black/50 border border-white/10 px-4 py-3 text-white focus:border-gold-500 focus:outline-none rounded-sm"
                                    placeholder="Ask something..."
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    disabled={chatLoading}
                                />
                                <Button type="submit" disabled={chatLoading || !chatInput.trim()}>
                                    Send
                                </Button>
                            </form>
                        </div>
                    </div>
                )}
             </div>
        )}

      </div>
    </Section>
  );
};
