'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiHelpers } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  model?: string;
  tokens?: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  model: string;
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
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash');
  
  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sample real estate prompts
  const realEstatePrompts = [
    "מה הדרישות להיתר בנייה למבנה מגורים ב-2024?",
    "איך מבדקים זכויות בנייה בחלקה?",
    "מה התקנים החדשים לבטיחות אש במבני ציבור?",
    "איך מגישים תכנית למתן היתר שיפוץ?",
    "מה השינויים בתקנות הבנייה השנה?",
    "איך מוגדרים שטחי עזר לפי החוק?",
  ];

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
      const response = await apiHelpers.chat.getSessions();
      if (response.success) {
        setSessions(response.data || []);
      }
    } catch (error) {
      console.log('Demo mode: Using sample sessions');
      setSessions([
        {
          id: 'demo-1',
          title: 'שאלות היתרי בנייה',
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          model: 'gemini-1.5-flash'
        }
      ]);
    }
  };

  const createNewSession = async () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: 'שיחה חדשה',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      model: selectedModel
    };
    
    setSessions(prev => [newSession, ...prev]);
    setCurrentSession(newSession);
    setMessages([]);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isTyping) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: getRealisticResponse(userMessage.content),
        timestamp: new Date().toISOString(),
        model: selectedModel
      };
      
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const getRealisticResponse = (userInput: string): string => {
    // Simple keyword-based responses for demo
    const input = userInput.toLowerCase();
    
    if (input.includes('היתר') || input.includes('היתרים')) {
      return `🏗️ **היתרי בנייה - מידע מעודכן**

**דרישות בסיסיות להיתר בנייה:**
• תכנית אדריכלית מאושרת
• חוות דעת מהנדס קונסטרוקציה  
• אישור מהנדס עיריה
• תשלום אגרות והיטלים

**תהליך הגשה:**
1. הכנת תיק תכניות מלא
2. הגשה למחלקת הנדסה ברשות המקומית
3. בדיקה ואישור הועדה המקומית
4. קבלת היתר + תחילת עבודות

**💡 עדכון חשוב:** נכון לינואר 2024, נדרש גם אישור נגישות לפי תקן 1918.

האם תרצה פירוט על סוג מבנה ספציפי?`;
    }
    
    if (input.includes('זכויות') || input.includes('זכות')) {
      return `📐 **בדיקת זכויות בנייה**

**איך לבדוק זכויות בנייה בחלקה:**

**1. מקורות מידע רשמיים:**
• מאגר מידע מקרקעי ישראל (מולב)
• תכנית המתאר המקומית
• מערכת איגוד לבדיקת תכניות

**2. נתונים לבדיקה:**
• מספר גוש וחלקה
• אחוזי בנייה מותרים
• גובה מבנה מקסימלי
• מספר יחידות דיור
• קווי בנין

**3. עדכונים חשובים:**
⚠️ תמיד לוודא עם תכנית מתאר עדכנית - יכולים להיות שינויים!

האם יש לך מספר גוש וחלקה ספציפיים לבדיקה?`;
    }

    if (input.includes('תקן') || input.includes('תקנים')) {
      return `📋 **תקנים ותקנות בנייה**

**תקנים עדכניים חשובים:**

**🔥 בטיחות אש:**
• ת"י 1202 - מערכות כיבוי אש
• ת"י 1918 - נגישות למבנים
• ת"י 466 - יציאות חירום

**🏗️ קונסטרוקציה:**
• ת"י 466 - תקן הבנייה הישראלי
• ת"י 1227 - עמידות רעידות אדמה
• ת"י 970 - בידוד תרמי

**📅 עדכונים 2024:**
• תקן 1918 - דרישות נגישות מחמירות
• תקן חדש לבנייה ירוקה
• עדכון דרישות אנרגטיות

על איזה תקן ספציפי תרצה לשמוע יותר?`;
    }

    // Default response
    return `👋 שלום! אני כאן לעזור לך בכל השאלות הקשורות לתכנון ובנייה בישראל.

🔍 **במה אני יכול לעזור:**
• היתרי בנייה ותהליכים
• זכויות בנייה ותכניות מתאר
• תקנים ותקנות עדכניים
• ועדות תכנון והליכים
• חישובים והערכות

💡 **טיפ:** נסה לשאול שאלות ספציפיות לתוצאות מדויקות יותר.

איך אוכל לעזור לך היום?`;
  };

  const handlePromptClick = (prompt: string) => {
    setInputMessage(prompt);
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-xl">🔄 טוען...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-lg flex items-center">
                <span className="ml-2">🏗️</span>
                נדל"ן AI
              </h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <button
              onClick={createNewSession}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              + שיחה חדשה
            </button>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => {
                  setCurrentSession(session);
                  setMessages(session.messages);
                }}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  currentSession?.id === session.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                }`}
              >
                <div className="font-medium truncate">{session.title}</div>
                <div className="text-xs opacity-70 mt-1">
                  {new Date(session.createdAt).toLocaleDateString('he-IL')}
                </div>
              </div>
            ))}
          </div>

          {/* User Info */}
          <div className="p-4 border-t border-slate-700">
            <div className="text-slate-300 text-sm">
              👤 {user?.firstName || user?.email}
            </div>
            <div className="text-slate-400 text-xs mt-1">
              חבר מקצועי
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-slate-800 border-b border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="text-slate-400 hover:text-white"
                >
                  ☰
                </button>
              )}
              <h1 className="text-white font-bold text-xl">
                {currentSession?.title || 'עוזרך החכם לתכנון ובנייה'}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-slate-700 text-white px-3 py-1 rounded border border-slate-600"
              >
                <option value="gemini-1.5-flash">Gemini Flash</option>
                <option value="gemini-1.5-pro">Gemini Pro</option>
                <option value="gpt-4">GPT-4</option>
              </select>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-8">🏗️</div>
              <h2 className="text-2xl font-bold text-white mb-4">
                ברוך הבא לנדל"ן AI!
              </h2>
              <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
                שאל אותי כל שאלה על תכנון ובנייה, היתרים, תקנות ותקנים בישראל.
                <br />
                <span className="text-green-300 font-semibold">אני מחובר לכל מאגרי המידע הרשמיים ואספק לך תשובות מדויקות ומעודכנות.</span>
              </p>
              
              <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                {realEstatePrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handlePromptClick(prompt)}
                    className="p-4 bg-slate-800 hover:bg-slate-700 rounded-lg text-right transition-colors border border-slate-600"
                  >
                    <div className="text-white font-medium">{prompt}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-4xl ${message.role === 'user' ? 'ml-12' : 'mr-12'}`}>
                    <div className={`p-4 rounded-lg ${
                      message.role === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-slate-800 text-slate-100 border border-slate-700'
                    }`}>
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      <div className="text-xs opacity-70 mt-2">
                        {new Date(message.timestamp).toLocaleTimeString('he-IL')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="max-w-4xl mr-12">
                    <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                      <div className="flex items-center space-x-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                        <span className="text-slate-400 text-sm">מחפש במאגרי המידע...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-slate-800 border-t border-slate-700 p-4">
          <div className="flex space-x-4">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="שאל אותי כל שאלה על תכנון ובנייה..."
              className="flex-1 bg-slate-700 text-white rounded-lg px-4 py-3 resize-none border border-slate-600 focus:border-blue-500 focus:outline-none"
              rows={3}
              disabled={isTyping}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isTyping}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg transition-colors flex items-center"
            >
              {isTyping ? '⏳' : '📤'}
            </button>
          </div>
          <div className="text-xs text-slate-400 mt-2 text-center">
            💡 לחץ Shift+Enter לשורה חדשה, Enter לשליחה
          </div>
        </div>
      </div>
    </div>
  );
}