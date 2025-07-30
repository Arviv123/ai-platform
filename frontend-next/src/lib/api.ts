'use client';

// הגדרת Base URL עבור ה-API
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ai-platform-backend.railway.app';

// Check if we're in static/demo mode
const isStaticMode = false; // Disable static mode to use real backend

// Debug info
if (typeof window !== 'undefined') {
  console.log('API Base URL:', API_BASE_URL);
  console.log('Static Mode:', isStaticMode);
}

// Types עבור API responses
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

interface ApiError {
  response?: {
    status: number;
    data: any;
  };
  request?: any;
  message: string;
}

// הגדרות עבור requests
interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  auth?: boolean;
}

// פונקציה להחזרת headers בסיסיים
function getDefaultHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  // הוספת token אם קיים
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
}

// פונקציה ליצירת timeout promise
function createTimeoutPromise(timeout: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Request timeout'));
    }, timeout);
  });
}

// פונקציה לביצוע request עם retry logic ו-interceptors
async function makeRequest<T>(
  url: string,
  config: RequestConfig = {}
): Promise<T> {
  const {
    method = 'GET',
    headers = {},
    body,
    timeout = 10000,
    retries = 3,
    auth = true
  } = config;

  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  
  const requestHeaders = {
    ...getDefaultHeaders(),
    ...headers
  };

  // אם auth=false, הסר authorization header
  if (!auth && requestHeaders['Authorization']) {
    delete requestHeaders['Authorization'];
  }

  const requestConfig: RequestInit = {
    method,
    headers: requestHeaders
  };

  if (body && method !== 'GET') {
    requestConfig.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  let lastError: any;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Check if we're in static mode and return mock response
      if (isStaticMode) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
        const mockData = getMockResponse(url, method, body);
        console.log(`[DEMO MODE] Returning mock response:`, mockData);
        return mockData;
      }

      // Request interceptor
      console.log(`[API Request] ${method} ${fullUrl}`, { headers: requestHeaders, body });

      const fetchPromise = fetch(fullUrl, requestConfig);
      const timeoutPromise = createTimeoutPromise(timeout);

      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      // בדיקת status code
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error: ApiError = {
          response: {
            status: response.status,
            data: errorData
          },
          message: errorData.message || `HTTP ${response.status}: ${response.statusText}`
        };
        throw error;
      }

      // Response interceptor
      const data = await response.json();
      console.log(`[API Response] ${method} ${fullUrl}`, { status: response.status, data });
      return data;

    } catch (error: any) {
      lastError = error;
      
      // אם זה הניסיון האחרון או שגיאה שלא כדאי לנסות שוב
      if (attempt === retries || shouldNotRetry(error)) {
        break;
      }

      // המתנה לפני ניסיון חוזר (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// פונקציה לבדיקה אם כדאי לנסות שוב
function shouldNotRetry(error: any): boolean {
  if (error?.response?.status) {
    const status = error.response.status;
    // לא לנסות שוב עבור 4xx errors (מלבד 408, 429)
    return status >= 400 && status < 500 && status !== 408 && status !== 429;
  }
  return false;
}

// Mock responses for static/demo mode
function getMockResponse(url: string, method: string, body?: any): any {
  console.log(`[DEMO MODE] Mock response for ${method} ${url}`);
  
  // Health check
  if (url.includes('/health')) {
    return { status: 'healthy', mode: 'demo' };
  }
  
  // Auth endpoints
  if (url.includes('/auth/login')) {
    return {
      success: true,
      data: {
        token: 'demo-token-12345',
        user: {
          id: '1',
          email: body?.email || 'demo@example.com',
          firstName: 'Demo',
          lastName: 'User',
          role: 'USER'
        }
      }
    };
  }
  
  if (url.includes('/auth/me')) {
    return {
      success: true,
      data: {
        id: '1',
        email: 'demo@example.com',
        firstName: 'Demo',
        lastName: 'User',
        role: 'USER'
      }
    };
  }
  
  // Chat endpoints
  if (url.includes('/chat/sessions') && method === 'GET') {
    return {
      success: true,
      data: [
        {
          id: 'demo-session-1',
          title: 'שאלה לדוגמה על תכנון ובנייה',
          model: 'gemini-1.5-flash',
          messageCount: 4,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    };
  }
  
  if (url.includes('/chat/message')) {
    return {
      success: true,
      data: {
        session: {
          id: 'demo-session-1',
          title: 'שיחה חדשה'
        },
        userMessage: {
          id: 'msg-' + Date.now(),
          role: 'user',
          content: body?.message || 'שאלה לדוגמה',
          createdAt: new Date().toISOString()
        },
        assistantMessage: {
          id: 'msg-' + (Date.now() + 1),
          role: 'assistant',
          content: `🎯 **מצב Demo פעיל**

זהו מצב הדגמה של פלטפורמת ה-AI. במצב זה:

✅ **מה שעובד:**
- ממשק המשתמש מלא
- ניווט בין דפים
- עיצוב ותכונות UI

⚠️ **מה שלא עובד (זמנית):**
- חיבור לשרת AI אמיתי
- שמירת נתונים
- כלי MCP ותכנון ישראלי

📋 **להפעלה מלאה:**
צריך להעלות גם את השרת (Backend) לשירות כמו Railway או Heroku.

💡 **שאלתך:** "${body?.message || 'שאלה לדוגמה'}"

במצב מלא, הייתי עונה עם:
- חיבור לכלי תכנון ישראלי
- מידע מעודכן על בנייה ותכנון
- שילוב עם מודלי AI מתקדמים

האתר עובד! רק צריך לחבר את השרת לפונקציונליות מלאה. 🚀`,
          createdAt: new Date().toISOString()
        }
      }
    };
  }
  
  if (url.includes('/chat/models')) {
    return {
      success: true,
      data: {
        models: [
          { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', isDefault: true },
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', isDefault: false }
        ],
        default: 'gemini-1.5-flash'
      }
    };
  }
  
  // MCP endpoints
  if (url.includes('/mcp') && method === 'GET') {
    return {
      success: true,
      data: [
        {
          id: 'demo-mcp-1',
          name: 'מינהל התכנון הישראלי',
          description: 'כלים לחיפוש מידע על תכנון ובנייה בישראל',
          enabled: true,
          status: 'demo',
          healthStatus: 'DEMO_MODE'
        }
      ]
    };
  }
  
  // Default response
  return {
    success: true,
    data: { message: 'Demo response', mode: 'static' }
  };
}

// API Functions
export const api = {
  // GET request
  get: async <T = any>(url: string, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<T> => {
    return makeRequest<T>(url, { ...config, method: 'GET' });
  },

  // POST request
  post: async <T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method'>): Promise<T> => {
    return makeRequest<T>(url, { ...config, method: 'POST', body: data });
  },

  // PUT request
  put: async <T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method'>): Promise<T> => {
    return makeRequest<T>(url, { ...config, method: 'PUT', body: data });
  },

  // PATCH request
  patch: async <T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method'>): Promise<T> => {
    return makeRequest<T>(url, { ...config, method: 'PATCH', body: data });
  },

  // DELETE request
  delete: async <T = any>(url: string, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<T> => {
    return makeRequest<T>(url, { ...config, method: 'DELETE' });
  }
};

// פונקציות עזר ספציפיות לאפליקציה
export const apiHelpers = {
  // בדיקת חיבור לשרת
  healthCheck: async (): Promise<boolean> => {
    try {
      await api.get('/health', { auth: false, timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  },

  // התחברות
  login: async (email: string, password: string): Promise<any> => {
    return api.post('/api/auth/login', { email, password }, { auth: false });
  },

  // רישום
  register: async (userData: any): Promise<any> => {
    const registerData = {
      ...userData,
      agreeTerms: true
    };
    return api.post('/api/auth/register', registerData, { auth: false });
  },

  // קבלת פרטי משתמש
  getCurrentUser: async (): Promise<any> => {
    return api.get('/api/auth/me');
  },

  // רענון token
  refreshToken: async (): Promise<any> => {
    return api.post('/api/auth/refresh', {}, { auth: false });
  },

  // התנתקות
  logout: async (): Promise<void> => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      // ניקוי local storage גם אם הבקשה נכשלה
      if (typeof window !== 'undefined') {
        localStorage.removeItem('authToken');
        localStorage.removeItem('auth_token');
      }
    }
  },

  // Chat API functions
  chat: {
    getSessions: () => api.get('/api/chat/sessions'),
    getSession: (sessionId: string) => api.get(`/api/chat/sessions/${sessionId}`),
    createSession: (data: { title?: string; model?: string }) => 
      api.post('/api/chat/sessions', data),
    updateSession: (sessionId: string, data: { title: string }) => 
      api.patch(`/api/chat/sessions/${sessionId}`, data),
    deleteSession: (sessionId: string) => 
      api.delete(`/api/chat/sessions/${sessionId}`),
    sendMessage: (data: { sessionId?: string; message: string; model?: string; stream?: boolean }) => 
      api.post('/api/chat/message', data),
    // Streaming chat with Server-Sent Events
    streamMessage: async (
      data: { sessionId?: string; message: string; model?: string }, 
      onChunk?: (chunk: any) => void,
      onComplete?: (response: any) => void,
      onError?: (error: any) => void
    ) => {
      const fullUrl = `${API_BASE_URL}/api/chat/stream`;
      const headers = getDefaultHeaders();
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Streaming not supported');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'chunk') {
                  onChunk?.(data);
                } else if (data.type === 'complete') {
                  onComplete?.(data);
                } else if (data.type === 'error') {
                  onError?.(new Error(data.error));
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE data:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
    getModels: () => api.get('/api/chat/models'),
    getUsage: (period = 'month') => api.get(`/api/chat/usage?period=${period}`),
    getAvailableTools: () => api.get('/api/chat/tools')
  },

  // MCP API functions
  mcp: {
    getServers: () => api.get('/api/mcp'),
    getServer: (serverId: string) => api.get(`/api/mcp/${serverId}`),
    createServer: (data: any) => api.post('/api/mcp', data),
    updateServer: (serverId: string, data: any) => api.put(`/api/mcp/${serverId}`, data),
    deleteServer: (serverId: string) => api.delete(`/api/mcp/${serverId}`),
    startServer: (serverId: string) => api.post(`/api/mcp/${serverId}/start`),
    stopServer: (serverId: string) => api.post(`/api/mcp/${serverId}/stop`),
    executeTool: (serverId: string, data: { toolName: string; parameters?: any }) => 
      api.post(`/api/mcp/${serverId}/execute`, data),
    getLogs: (serverId: string, limit = 100) => 
      api.get(`/api/mcp/${serverId}/logs?limit=${limit}`),
    healthCheck: () => api.get('/api/mcp/health/check')
  }
};

// פונקציה לטיפול בשגיאות API עם הודעות ידידותיות למשתמש
export function getErrorMessage(error: any): string {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }

  if (error?.response?.status) {
    const status = error.response.status;
    switch (status) {
      case 400:
        return 'בקשה לא תקינה - אנא בדוק את הנתונים';
      case 401:
        return 'נדרשת התחברות מחדש';
      case 403:
        return 'אין לך הרשאה לבצע פעולה זו';
      case 404:
        return 'המשאב המבוקש לא נמצא';
      case 422:
        return 'נתונים לא תקינים';
      case 429:
        return 'יותר מדי בקשות - אנא המתן ונסה שוב';
      case 500:
        return 'שגיאת שרת פנימית';
      case 502:
        return 'השרת לא זמין כרגע';
      case 503:
        return 'השירות אינו זמין כרגע';
      default:
        return `שגיאת שרת (${status})`;
    }
  }

  if (error?.message) {
    if (error.message.includes('timeout')) {
      return 'הבקשה נכשלה בגלל timeout - אנא נסה שוב';
    }
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'בעיית חיבור - אנא בדוק את החיבור לאינטרנט';
    }
    return error.message;
  }

  return 'אירעה שגיאה לא צפויה';
}

export default api;