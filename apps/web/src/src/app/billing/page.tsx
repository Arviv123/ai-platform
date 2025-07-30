'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Subscription {
  id: string;
  planName: string;
  status: 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'TRIALING';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
}

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: 'PAID' | 'PENDING' | 'FAILED';
  date: string;
  downloadUrl?: string;
}

interface UsageData {
  tokensUsed: number;
  tokensLimit: number;
  messagesCount: number;
  sessionsCount: number;
  periodStart: string;
  periodEnd: string;
}

export default function BillingPage() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (isAuthenticated) {
      loadBillingData();
    }
  }, [isAuthenticated, isLoading, router]);

  const loadBillingData = async () => {
    try {
      setIsLoadingData(true);
      
      // Mock data - replace with real API calls
      setSubscription({
        id: 'sub_123',
        planName: 'Pro',
        status: 'ACTIVE',
        currentPeriodStart: '2025-07-01T00:00:00Z',
        currentPeriodEnd: '2025-08-01T00:00:00Z',
        price: 29,
        currency: 'USD',
        interval: 'month'
      });

      setInvoices([
        {
          id: 'inv_123',
          amount: 29,
          currency: 'USD',
          status: 'PAID',
          date: '2025-07-01T00:00:00Z',
          downloadUrl: '#'
        },
        {
          id: 'inv_122',
          amount: 29,
          currency: 'USD',
          status: 'PAID',
          date: '2025-06-01T00:00:00Z',
          downloadUrl: '#'
        },
        {
          id: 'inv_121',
          amount: 29,
          currency: 'USD',
          status: 'PAID',
          date: '2025-05-01T00:00:00Z',
          downloadUrl: '#'
        }
      ]);

      setUsage({
        tokensUsed: 245000,
        tokensLimit: 500000,
        messagesCount: 1250,
        sessionsCount: 89,
        periodStart: '2025-07-01T00:00:00Z',
        periodEnd: '2025-08-01T00:00:00Z'
      });

    } catch (error) {
      console.error('Failed to load billing data:', error);
      showToast('Failed to load billing data', 'error');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      // Mock API call
      showToast('המנוי בוטל בהצלחה. יישאר פעיל עד סוף התקופה', 'success');
      setSubscription(prev => prev ? { ...prev, status: 'CANCELED' } : null);
      setShowCancelModal(false);
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      showToast('שגיאה בביטול המנוי', 'error');
    }
  };

  const handleUpdatePaymentMethod = () => {
    showToast('מעביר לעדכון אמצעי תשלום...', 'info');
    // Here we would redirect to Stripe customer portal
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-600 text-white';
      case 'TRIALING': return 'bg-blue-600 text-white';
      case 'CANCELED': return 'bg-red-600 text-white';
      case 'PAST_DUE': return 'bg-yellow-600 text-white';
      case 'PAID': return 'bg-green-600 text-white';
      case 'PENDING': return 'bg-yellow-600 text-white';
      case 'FAILED': return 'bg-red-600 text-white';
      default: return 'bg-gray-600 text-white';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'פעיל';
      case 'TRIALING': return 'תקופת ניסיון';
      case 'CANCELED': return 'מבוטל';
      case 'PAST_DUE': return 'איחור בתשלום';
      case 'PAID': return 'שולם';
      case 'PENDING': return 'ממתין';
      case 'FAILED': return 'נכשל';
      default: return status;
    }
  };

  const getUsagePercentage = () => {
    if (!usage) return 0;
    return Math.min((usage.tokensUsed / usage.tokensLimit) * 100, 100);
  };

  const getUsageColor = () => {
    const percentage = getUsagePercentage();
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (isLoading || isLoadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="spinner"></div>
          <span className="text-white">Loading billing information...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">💳 חשבונית ומנוי</h1>
              <p className="text-blue-200">ניהול המנוי והתשלומים שלכם</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/pricing')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                שדרג תוכנית
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                ← חזור לדשבורד
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Current Subscription */}
        <div className="glass p-6 rounded-xl mb-8">
          <h2 className="text-xl font-bold text-white mb-6">📋 המנוי הנוכחי</h2>
          
          {subscription ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">תוכנית {subscription.planName}</h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(subscription.status)}`}>
                    {getStatusText(subscription.status)}
                  </span>
                </div>
                <div className="space-y-2 text-blue-200">
                  <p>💰 {formatCurrency(subscription.price, subscription.currency)}/{subscription.interval === 'month' ? 'חודש' : 'שנה'}</p>
                  <p>📅 תקופה נוכחית: {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}</p>
                  <p>🔄 חידוש הבא: {formatDate(subscription.currentPeriodEnd)}</p>
                </div>
              </div>
              
              <div className="flex flex-col space-y-3">
                <button
                  onClick={handleUpdatePaymentMethod}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  🔄 עדכן אמצעי תשלום
                </button>
                <button
                  onClick={() => router.push('/pricing')}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  ⬆️ שדרג תוכנית
                </button>
                {subscription.status === 'ACTIVE' && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    ❌ בטל מנוי
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-xl font-semibold text-white mb-2">אין מנוי פעיל</h3>
              <p className="text-blue-200 mb-4">בחרו תוכנית שמתאימה לכם</p>
              <button
                onClick={() => router.push('/pricing')}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                צפו בתוכניות
              </button>
            </div>
          )}
        </div>

        {/* Usage Statistics */}
        {usage && (
          <div className="glass p-6 rounded-xl mb-8">
            <h2 className="text-xl font-bold text-white mb-6">📊 שימוש חודשי</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="bg-white/5 p-4 rounded-lg">
                <div className="text-2xl font-bold text-white">{usage.tokensUsed.toLocaleString()}</div>
                <div className="text-blue-200 text-sm">Tokens בשימוש</div>
              </div>
              <div className="bg-white/5 p-4 rounded-lg">
                <div className="text-2xl font-bold text-white">{usage.tokensLimit.toLocaleString()}</div>
                <div className="text-blue-200 text-sm">מגבלת Tokens</div>
              </div>
              <div className="bg-white/5 p-4 rounded-lg">
                <div className="text-2xl font-bold text-white">{usage.messagesCount}</div>
                <div className="text-blue-200 text-sm">הודעות</div>
              </div>
              <div className="bg-white/5 p-4 rounded-lg">
                <div className="text-2xl font-bold text-white">{usage.sessionsCount}</div>
                <div className="text-blue-200 text-sm">שיחות</div>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium">ניצול Tokens</span>
                <span className="text-blue-200 text-sm">{getUsagePercentage().toFixed(1)}%</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all duration-300 ${getUsageColor()}`}
                  style={{ width: `${getUsagePercentage()}%` }}
                ></div>
              </div>
            </div>

            <p className="text-blue-200 text-sm">
              תקופה: {formatDate(usage.periodStart)} - {formatDate(usage.periodEnd)}
            </p>
          </div>
        )}

        {/* Invoices */}
        <div className="glass p-6 rounded-xl">
          <h2 className="text-xl font-bold text-white mb-6">🧾 היסטוריית חשבוניות</h2>
          
          {invoices.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🧾</div>
              <h3 className="text-xl font-semibold text-white mb-2">אין חשבוניות</h3>
              <p className="text-blue-200">החשבוניות שלכם יופיעו כאן</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-blue-200 py-3">תאריך</th>
                    <th className="text-left text-blue-200 py-3">סכום</th>
                    <th className="text-left text-blue-200 py-3">סטטוס</th>
                    <th className="text-left text-blue-200 py-3">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-4 text-white">
                        {formatDate(invoice.date)}
                      </td>
                      <td className="py-4 text-white font-medium">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(invoice.status)}`}>
                          {getStatusText(invoice.status)}
                        </span>
                      </td>
                      <td className="py-4">
                        {invoice.downloadUrl && (
                          <button
                            onClick={() => showToast('הורדת חשבונית...', 'info')}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                          >
                            📥 הורד
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass p-6 rounded-xl w-full max-w-md mx-4">
            <h3 className="text-xl font-bold text-white mb-4">❌ ביטול מנוי</h3>
            <p className="text-blue-200 mb-6">
              האם אתם בטוחים שברצונכם לבטל את המנוי? המנוי יישאר פעיל עד סוף התקופה ששולמה ({formatDate(subscription?.currentPeriodEnd || '')}).
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={handleCancelSubscription}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                בטל מנוי
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}