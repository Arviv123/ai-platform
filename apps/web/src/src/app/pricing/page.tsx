'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface PricingPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  maxTokens: number;
  maxUsers: number;
  priority: 'low' | 'medium' | 'high';
  popular?: boolean;
}

const plans: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'להתחלה וחקר האפשרויות',
    price: 0,
    currency: 'USD',
    interval: 'month',
    maxTokens: 10000,
    maxUsers: 1,
    priority: 'low',
    features: [
      '✓ 10,000 Tokens חודשיים',
      '✓ גישה לכל המודלים',
      '✓ צ\'אט בסיסי',
      '✓ תמיכה בקהילה',
      '✓ MCP שרתים בסיסיים'
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'למקצועיים ועסקים קטנים',
    price: 29,
    currency: 'USD',
    interval: 'month',
    maxTokens: 500000,
    maxUsers: 5,
    priority: 'medium',
    popular: true,
    features: [
      '✓ 500,000 Tokens חודשיים',
      '✓ עד 5 משתמשים',
      '✓ מודלים מתקדמים',
      '✓ היסטוריית צ\'אט מלאה',
      '✓ תמיכה בעדיפות',
      '✓ MCP שרתים מתקדמים',
      '✓ API Access',
      '✓ ייצוא נתונים'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'לארגונים גדולים',
    price: 99,
    currency: 'USD',
    interval: 'month',
    maxTokens: 2000000,
    maxUsers: 50,
    priority: 'high',
    features: [
      '✓ 2,000,000 Tokens חודשיים',
      '✓ עד 50 משתמשים',
      '✓ כל המודלים',
      '✓ תמיכה 24/7',
      '✓ SLA מובטח',
      '✓ MCP שרתים ללא הגבלה',
      '✓ API ללא הגבלה',
      '✓ ניתוח מתקדם',
      '✓ SSO Integration',
      '✓ גיבוי אוטומטי'
    ]
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'פתרון מותאם אישית',
    price: 0,
    currency: 'USD',
    interval: 'month',
    maxTokens: -1,
    maxUsers: -1,
    priority: 'high',
    features: [
      '✓ Tokens ללא הגבלה',
      '✓ משתמשים ללא הגבלה',
      '✓ מודלים מותאמים',
      '✓ אינטגרציה מותאמת',
      '✓ תמיכה ייעודית',
      '✓ הכשרה והטמעה',
      '✓ פיתוח מותאם',
      '✓ SLA מותאם'
    ]
  }
];

export default function PricingPage() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePlanSelect = async (planId: string) => {
    if (!isAuthenticated) {
      showToast('יש להתחבר כדי לבחור תוכנית', 'error');
      router.push('/auth/login');
      return;
    }

    if (planId === 'free') {
      showToast('התוכנית החינמית כבר פעילה', 'info');
      return;
    }

    if (planId === 'custom') {
      showToast('צרו קשר לתוכנית מותאמת', 'info');
      return;
    }

    setIsProcessing(true);
    setSelectedPlan(planId);

    try {
      // Here we would integrate with Stripe
      showToast('מעביר לתשלום מאובטח...', 'info');
      
      // Mock payment flow
      setTimeout(() => {
        showToast('תשלום בוצע בהצלחה! התוכנית שודרגה', 'success');
        setIsProcessing(false);
        router.push('/dashboard');
      }, 3000);

    } catch (error) {
      console.error('Payment error:', error);
      showToast('שגיאה בתשלום, נסו שוב', 'error');
      setIsProcessing(false);
    }
  };

  const formatPrice = (plan: PricingPlan) => {
    if (plan.price === 0 && plan.id !== 'custom') return 'חינם';
    if (plan.id === 'custom') return 'צרו קשר';
    
    const yearlyPrice = plan.price * 12 * 0.8; // 20% discount for yearly
    const displayPrice = billingInterval === 'year' ? yearlyPrice : plan.price;
    
    return `$${displayPrice}${billingInterval === 'year' ? '/שנה' : '/חודש'}`;
  };

  const getPlanColor = (plan: PricingPlan) => {
    if (plan.popular) return 'border-blue-500 ring-2 ring-blue-500';
    return 'border-white/20';
  };

  const getButtonColor = (plan: PricingPlan) => {
    if (plan.popular) return 'bg-blue-600 hover:bg-blue-700';
    if (plan.id === 'enterprise') return 'bg-purple-600 hover:bg-purple-700';
    if (plan.id === 'custom') return 'bg-gray-600 hover:bg-gray-700';
    return 'bg-green-600 hover:bg-green-700';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">💰 תמחור ותוכניות</h1>
              <p className="text-blue-200">בחרו את התוכנית המתאימה לכם</p>
            </div>
            <div className="flex items-center space-x-4">
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

      <div className="max-w-7xl mx-auto p-6">
        {/* Billing Toggle */}
        <div className="flex justify-center mb-12">
          <div className="glass p-2 rounded-xl">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setBillingInterval('month')}
                className={`px-6 py-2 rounded-lg transition-colors ${
                  billingInterval === 'month'
                    ? 'bg-blue-600 text-white'
                    : 'text-blue-200 hover:bg-white/10'
                }`}
              >
                חודשי
              </button>
              <button
                onClick={() => setBillingInterval('year')}
                className={`px-6 py-2 rounded-lg transition-colors relative ${
                  billingInterval === 'year'
                    ? 'bg-blue-600 text-white'
                    : 'text-blue-200 hover:bg-white/10'
                }`}
              >
                שנתי
                <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                  20% הנחה
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`glass p-8 rounded-xl relative ${getPlanColor(plan)} transition-all hover:scale-105`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium">
                    הכי פופולרי
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-blue-200 text-sm mb-4">{plan.description}</p>
                <div className="text-4xl font-bold text-white mb-2">
                  {formatPrice(plan)}
                </div>
                {plan.price > 0 && billingInterval === 'year' && (
                  <p className="text-green-400 text-sm">
                    חסכו ${(plan.price * 12 * 0.2).toFixed(0)} בשנה
                  </p>
                )}
              </div>

              <div className="space-y-3 mb-8">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-start">
                    <span className="text-blue-200 text-sm leading-relaxed">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handlePlanSelect(plan.id)}
                disabled={isProcessing && selectedPlan === plan.id}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${getButtonColor(plan)} ${
                  isProcessing && selectedPlan === plan.id 
                    ? 'opacity-50 cursor-not-allowed' 
                    : ''
                }`}
              >
                {isProcessing && selectedPlan === plan.id ? (
                  <div className="flex items-center justify-center">
                    <div className="spinner mr-2"></div>
                    מעבד...
                  </div>
                ) : plan.id === 'free' ? (
                  'התחל חינם'
                ) : plan.id === 'custom' ? (
                  'צרו קשר'
                ) : (
                  'שדרג עכשיו'
                )}
              </button>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="glass p-8 rounded-xl">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">❓ שאלות נפוצות</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">מה זה Tokens?</h3>
              <p className="text-blue-200 text-sm">
                Tokens הם יחידות מדידה לכמות הטקסט שנשלח ומתקבל מהמודלים. כל הודעה צורכת Tokens בהתאם לאורכה ומורכבותה.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-3">איך מתבצע התשלום?</h3>
              <p className="text-blue-200 text-sm">
                התשלום מתבצע באמצעות Stripe בצורה מאובטחת. אנו מקבלים כל כרטיסי האשראי הגדולים ו-PayPal.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-3">אפשר לבטל בכל עת?</h3>
              <p className="text-blue-200 text-sm">
                כן, אפשר לבטל את המנוי בכל עת ללא עלויות נוספות. המנוי יישאר פעיל עד סוף התקופה ששולמה.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-3">מה זה MCP שרתים?</h3>
              <p className="text-blue-200 text-sm">
                Model Context Protocol שרתים מאפשרים לחבר כלים חיצוניים למודלים, כמו API-ים, בסיסי נתונים ועוד.
              </p>
            </div>
          </div>
        </div>

        {/* Contact Section */}
        <div className="mt-12 text-center">
          <div className="glass p-8 rounded-xl">
            <h2 className="text-2xl font-bold text-white mb-4">צריכים עזרה?</h2>
            <p className="text-blue-200 mb-6">
              צרו קשר לייעוץ בחירת התוכנית המתאימה או לכל שאלה
            </p>
            <div className="flex justify-center space-x-4">
              <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                📧 שלחו אימייל
              </button>
              <button className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                💬 צ'אט תמיכה
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}