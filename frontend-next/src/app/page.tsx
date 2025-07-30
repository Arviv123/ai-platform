'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useState, useEffect } from 'react';

export default function HomePage() {
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const [healthStatus, setHealthStatus] = useState<'checking' | 'healthy' | 'error'>('checking');

  const checkHealth = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://ai-platform-backend.onrender.com'}/health`);
      if (response.ok) {
        setHealthStatus('healthy');
      } else {
        setHealthStatus('error');
      }
    } catch (error) {
      setHealthStatus('error');
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
      {/* Header Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/10 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-green-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">🏗️</span>
              </div>
              <span className="text-white font-bold text-xl">נדל&quot;ן AI</span>
            </div>
            <div className="flex items-center space-x-4">
              {!isAuthenticated ? (
                <>
                  <a href="/auth/login" className="text-white hover:text-blue-300 transition-colors">
                    התחברות
                  </a>
                  <a href="/auth/register" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                    הרשמה חינם
                  </a>
                </>
              ) : (
                <a href="/chat" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors">
                  לוח הבקרה
                </a>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-16">
        {/* Hero Section */}
        <section className="relative py-20 px-4">
          <div className="max-w-6xl mx-auto text-center">
            {/* Status Indicator */}
            <div className="flex justify-center mb-8">
              <div 
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  healthStatus === 'healthy' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 
                  healthStatus === 'error' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 
                  'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                }`}
              >
                {healthStatus === 'healthy' ? '🟢 מצב דמו פעיל' : 
                 healthStatus === 'error' ? '🟡 מצב דמו - מוכן לשימוש' : 
                 '🟡 מתחבר למערכת...'}
              </div>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-white mb-8 leading-tight">
              <span className="bg-gradient-to-r from-blue-400 via-green-400 to-blue-400 bg-clip-text text-transparent">
                עוזרך החכם
              </span>
              <br />
              <span className="text-white">לתכנון ובנייה</span>
            </h1>

            <p className="text-xl md:text-2xl text-blue-100 mb-8 leading-relaxed max-w-4xl mx-auto">
              מערכת AI מתקדמת המחוברת לכל מאגרי המידע הישראליים: 
              <span className="text-green-300 font-semibold"> תכנון ובנייה, ועדות תכנון, היתרי בנייה, תקנות ותקנים</span>
            </p>

            {/* Demo Notice */}
            <div className="max-w-3xl mx-auto mb-12 p-4 bg-blue-500/20 border border-blue-400/30 rounded-xl">
              <div className="flex items-center justify-center space-x-3 mb-2">
                <span className="text-2xl">🚀</span>
                <h3 className="text-lg font-bold text-blue-200">מבדק טכנולוגי פעיל</h3>
              </div>
              <p className="text-blue-100 text-center">
                כרגע המערכת פועלת במצב הדגמה עם תשובות לדוגמה.
                <br />
                <span className="text-blue-300 font-medium">נסה את הממשק ותראה איך זה יעבוד במציאות!</span>
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
              {isAuthenticated ? (
                <a 
                  href="/chat" 
                  className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white text-xl font-bold rounded-xl shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center space-x-3"
                >
                  <span>🚀 כניסה למערכת</span>
                  <span className="group-hover:translate-x-1 transition-transform">←</span>
                </a>
              ) : (
                <>
                  <a 
                    href="/auth/register" 
                    className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white text-xl font-bold rounded-xl shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center space-x-3"
                  >
                    <span>🏗️ התחל חינם</span>
                    <span className="group-hover:translate-x-1 transition-transform">←</span>
                  </a>
                  <a 
                    href="/auth/login" 
                    className="px-8 py-4 border-2 border-white/30 hover:border-white/50 text-white hover:bg-white/10 rounded-xl transition-all duration-300"
                  >
                    יש לי חשבון
                  </a>
                </>
              )}
            </div>

            {/* User Status */}
            {isAuthenticated && user && (
              <div className="max-w-md mx-auto bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 mb-16">
                <div className="text-center">
                  <p className="text-white text-lg mb-2">👋 ברוך הבא, {user.firstName || user.email}</p>
                  <p className="text-blue-200 mb-4">תוכנית: מקצועי | זמינות: 24/7</p>
                  <a 
                    href="/chat" 
                    className="inline-block w-full py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    💬 התחל שיחה חדשה
                  </a>
                </div>
              </div>
            )}

            {/* Features Grid */}
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 hover:bg-white/15 transition-all duration-300">
                <div className="text-4xl mb-4">📋</div>
                <h3 className="text-xl font-bold text-white mb-3">היתרי בנייה</h3>
                <p className="text-blue-100">בדיקת דרישות היתרים, עדכונים בזמן אמת מכל הרשויות המקומיות</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 hover:bg-white/15 transition-all duration-300">
                <div className="text-4xl mb-4">🏛️</div>
                <h3 className="text-xl font-bold text-white mb-3">ועדות תכנון</h3>
                <p className="text-blue-100">מעקב אחר החלטות ועדות, תכניות חדשות ושינויי זכויות בנייה</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 hover:bg-white/15 transition-all duration-300">
                <div className="text-4xl mb-4">📊</div>
                <h3 className="text-xl font-bold text-white mb-3">תקנים ותקנות</h3>
                <p className="text-blue-100">מאגר מעודכן של כל התקנים, תקנות הבנייה ודרישות הבטיחות</p>
              </div>
            </div>
          </div>
        </section>

        {/* What Makes Us Different */}
        <section className="py-20 bg-white/5 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <h2 className="text-4xl font-bold text-white mb-12">למה דווקא נדל&quot;ן AI?</h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🔄</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">מידע בזמן אמת</h3>
                <p className="text-blue-100">עדכונים רציפים מכל המערכות הממשלתיות</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🎯</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">מדויק ומקצועי</h3>
                <p className="text-blue-100">תשובות מבוססות על מקורות רשמיים בלבד</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚡</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">מהיר וחכם</h3>
                <p className="text-blue-100">תשובות מיידיות במקום שעות של חיפוש</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🛡️</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">מאובטח ואמין</h3>
                <p className="text-blue-100">הגנת פרטיות מתקדמת ואבטחת מידע מלאה</p>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-white mb-8">מוכן להתחיל?</h2>
            <p className="text-xl text-blue-100 mb-12">
              הצטרף אלפי מקצועי תכנון ובנייה הכבר משתמשים במערכת
            </p>
            
            {!isAuthenticated && (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a 
                  href="/auth/register" 
                  className="px-8 py-4 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white text-lg font-bold rounded-xl shadow-xl transform hover:scale-105 transition-all duration-300"
                >
                  🏗️ הרשמה חינם - 7 ימי ניסיון
                </a>
                <a 
                  href="/pricing" 
                  className="px-8 py-4 border-2 border-white/30 hover:border-white/50 text-white hover:bg-white/10 rounded-xl transition-all duration-300"
                >
                  📊 צפה במחירים
                </a>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}