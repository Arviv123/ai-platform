'use client';

// הגדרת Base URL עבור ה-API
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004';

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
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
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

// פונקציה לביצוע request עם retry logic
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

      // החזרת התוצאה
      const data = await response.json();
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
    return api.post('/api/auth/register', userData, { auth: false });
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
        sessionStorage.removeItem('authToken');
      }
    }
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