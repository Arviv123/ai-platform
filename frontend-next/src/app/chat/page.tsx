'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  model?: string;
  tokens?: number;
  tools?: string[];
  attachments?: Attachment[];
}

interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  model: string;
  totalTokens: number;
}

interface AIModel {
  id: string;
  name: string;
  provider: 'anthropic' | 'openai' | 'google' | 'local';
  description: string;
  contextLength: number;
  available: boolean;
}

export default function ChatPage() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  
  // Chat state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedModel, setSelectedModel] = useState('claude-3-sonnet');
  
  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Available models
  const [availableModels, setAvailableModels] = useState<AIModel[]>([
    {
      id: 'claude-3-sonnet',
      name: 'Claude 3 Sonnet',
      provider: 'anthropic',
      description: 'Balanced performance and speed',
      contextLength: 200000,
      available: true
    },
    {
      id: 'claude-3-opus',
      name: 'Claude 3 Opus',
      provider: 'anthropic',
      description: 'Most capable model',
      contextLength: 200000,
      available: true
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      description: 'Latest GPT-4 model',
      contextLength: 128000,
      available: true
    },
    {
      id: 'gemini-pro',
      name: 'Gemini Pro',
      provider: 'google',
      description: 'Google\'s advanced model',
      contextLength: 32000,
      available: true
    }
  ]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (isAuthenticated) {
      loadChatSessions();
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatSessions = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch('http://localhost:3005/api/chat/sessions', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSessions(data.data || []);
        
        // Load the most recent session
        if (data.data && data.data.length > 0) {
          loadSession(data.data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
      showToast('Failed to load chat history', 'error');
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`http://localhost:3005/api/chat/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentSession(data.data);
        setMessages(data.data.messages || []);
        setSelectedModel(data.data.model || 'claude-3-sonnet');
      }
    } catch (error) {
      console.error('Failed to load session:', error);
      showToast('Failed to load conversation', 'error');
    }
  };

  const createNewSession = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch('http://localhost:3005/api/chat/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: 'New Conversation',
          model: selectedModel
        })
      });

      if (response.ok) {
        const data = await response.json();
        const newSession = data.data;
        setSessions([newSession, ...sessions]);
        setCurrentSession(newSession);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to create session:', error);
      showToast('Failed to create new conversation', 'error');
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch('http://localhost:3005/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId: currentSession?.id,
          message: userMessage.content,
          model: selectedModel
        })
      });

      if (response.ok) {
        const reader = response.body?.getReader();
        if (!reader) return;

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
          model: selectedModel
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Stream the response
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  assistantMessage.content += data.content;
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessage.id ? { ...assistantMessage } : msg
                  ));
                }
                if (data.done) {
                  assistantMessage.tokens = data.tokens;
                  assistantMessage.tools = data.tools;
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
          }
        }
      } else {
        showToast('Failed to send message', 'error');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      showToast('Network error sending message', 'error');
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getModelColor = (provider: string) => {
    switch (provider) {
      case 'anthropic': return 'bg-orange-600';
      case 'openai': return 'bg-green-600';
      case 'google': return 'bg-blue-600';
      case 'local': return 'bg-purple-600';
      default: return 'bg-gray-600';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden border-r border-white/10`}>
        <div className="h-full glass backdrop-blur-xl">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Conversations</h2>
              <button
                onClick={createNewSession}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="New conversation"
              >
                <span className="text-white">➕</span>
              </button>
            </div>
            
            {/* Model Selector */}
            <div className="relative">
              <button
                onClick={() => setShowModelSelector(!showModelSelector)}
                className="w-full p-3 bg-white/10 rounded-lg text-left flex items-center justify-between hover:bg-white/20 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${getModelColor(availableModels.find(m => m.id === selectedModel)?.provider || 'anthropic')}`}></div>
                  <span className="text-white text-sm">
                    {availableModels.find(m => m.id === selectedModel)?.name}
                  </span>
                </div>
                <span className="text-white">⌄</span>
              </button>
              
              {showModelSelector && (
                <div className="absolute top-full left-0 right-0 mt-1 glass rounded-lg border border-white/20 z-10">
                  {availableModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model.id);
                        setShowModelSelector(false);
                      }}
                      className="w-full p-3 text-left hover:bg-white/10 transition-colors first:rounded-t-lg last:rounded-b-lg"
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${getModelColor(model.provider)}`}></div>
                        <span className="text-white text-sm font-medium">{model.name}</span>
                        {!model.available && (
                          <span className="text-red-400 text-xs">Offline</span>
                        )}
                      </div>
                      <p className="text-blue-200 text-xs">{model.description}</p>
                      <p className="text-gray-400 text-xs">{model.contextLength.toLocaleString()} tokens</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => loadSession(session.id)}
                className={`w-full p-3 rounded-lg text-left transition-colors ${
                  currentSession?.id === session.id 
                    ? 'bg-white/20' 
                    : 'hover:bg-white/10'
                }`}
              >
                <h3 className="text-white text-sm font-medium truncate">{session.title}</h3>
                <p className="text-blue-200 text-xs">
                  {new Date(session.updatedAt).toLocaleDateString()}
                </p>
                <p className="text-gray-400 text-xs">
                  {session.totalTokens.toLocaleString()} tokens
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10 glass backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <span className="text-white">☰</span>
              </button>
              <div>
                <h1 className="text-white font-semibold">
                  {currentSession?.title || 'New Conversation'}
                </h1>
                <p className="text-blue-200 text-sm">
                  {availableModels.find(m => m.id === selectedModel)?.name}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => router.push('/dashboard')}
                className="px-3 py-1 glass hover:bg-white/10 text-white text-sm rounded transition-colors"
              >
                Dashboard
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <span className="text-white">⚙️</span>
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🤖</div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Welcome to AI Chat
                </h2>
                <p className="text-blue-200 mb-4">
                  Start a conversation with {availableModels.find(m => m.id === selectedModel)?.name}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                  {[
                    'Explain quantum computing',
                    'Write a Python function',
                    'Analyze this data',
                    'Help me brainstorm ideas'
                  ].map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => setInputMessage(suggestion)}
                      className="p-4 glass hover:bg-white/10 rounded-lg text-left transition-colors"
                    >
                      <p className="text-white text-sm">{suggestion}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-4xl ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                  <div className={`flex items-start space-x-3 ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                      message.role === 'user' ? 'bg-blue-600' : 'bg-purple-600'
                    }`}>
                      {message.role === 'user' ? '👤' : '🤖'}
                    </div>
                    
                    {/* Message Content */}
                    <div className="flex-1">
                      <div className={`p-4 rounded-xl ${
                        message.role === 'user' 
                          ? 'bg-blue-600 text-white' 
                          : 'glass text-white'
                      }`}>
                        <div className="prose prose-invert max-w-none">
                          {message.content.split('\n').map((line, index) => (
                            <p key={index} className="mb-2 last:mb-0">
                              {line}
                            </p>
                          ))}
                        </div>
                        
                        {/* Message metadata */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/20">
                          <div className="flex items-center space-x-4 text-xs opacity-70">
                            <span>{formatTime(message.timestamp)}</span>
                            {message.model && (
                              <span>{message.model}</span>
                            )}
                            {message.tokens && (
                              <span>{message.tokens} tokens</span>
                            )}
                          </div>
                          
                          {message.tools && message.tools.length > 0 && (
                            <div className="flex items-center space-x-1">
                              <span className="text-xs opacity-70">Tools:</span>
                              {message.tools.map((tool, index) => (
                                <span key={index} className="px-2 py-1 bg-white/20 rounded text-xs">
                                  {tool}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="max-w-4xl">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm">
                    🤖
                  </div>
                  <div className="glass p-4 rounded-xl">
                    <div className="flex items-center space-x-2">
                      <div className="spinner"></div>
                      <span className="text-white text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-white/10 glass backdrop-blur-xl">
          <div className="flex items-end space-x-4">
            <div className="flex-1">
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                rows={1}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                style={{ minHeight: '52px', maxHeight: '200px' }}
                disabled={isTyping}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                className="p-3 hover:bg-white/10 rounded-lg transition-colors"
                title="Attach file"
              >
                <span className="text-white">📎</span>
              </button>
              
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isTyping}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center space-x-2"
              >
                <span>Send</span>
                <span>⮕</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}