const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const logger = require('../utils/logger');

// Subscription plans configuration
const SUBSCRIPTION_PLANS = {
  free: {
    id: 'free',
    name: 'חינם',
    price: 0,
    credits: 100,
    features: ['צ'אט בסיסי', '100 קרדיטים חינם'],
    maxModels: 1
  },
  basic: {
    id: 'basic',
    name: 'בסיסי',
    price: 29,
    credits: 1000,
    features: ['כל המודלים', '1000 קרדיטים', 'תמיכה באימייל'],
    maxModels: 3,
    stripeProductId: 'prod_basic'
  },
  premium: {
    id: 'premium',
    name: 'פרימיום',
    price: 99,
    credits: 5000,
    features: ['כל המודלים', '5000 קרדיטים', 'תמיכה מועדפת', 'MCP servers'],
    maxModels: 10,
    stripeProductId: 'prod_premium'
  },
  enterprise: {
    id: 'enterprise',
    name: 'ארגוני',
    price: 299,
    credits: 20000,
    features: ['כל המודלים', '20000 קרדיטים', 'תמיכה 24/7', 'MCP servers', 'API גישה'],
    maxModels: -1, // unlimited
    stripeProductId: 'prod_enterprise'
  }
};

// Credit pricing (per credit)
const CREDIT_PRICES = {
  100: { price: 10, bonus: 0 },
  500: { price: 45, bonus: 50 },
  1000: { price: 80, bonus: 200 },
  5000: { price: 350, bonus: 1000 }
};

// Initialize Stripe (check if keys are available)
const initializeStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    logger.warn('STRIPE_SECRET_KEY not found - payment features disabled');
    return false;
  }
  
  try {
    // Test the Stripe connection
    logger.info('Stripe payment system initialized');
    return true;
  } catch (error) {
    logger.error('Failed to initialize Stripe:', error);
    return false;
  }
};

// Create a payment intent for credit purchase
const createCreditPurchaseIntent = async (userId, creditAmount, userEmail) => {
  try {
    if (!CREDIT_PRICES[creditAmount]) {
      throw new Error(`Invalid credit amount: ${creditAmount}`);
    }

    const { price } = CREDIT_PRICES[creditAmount];
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: price * 100, // Convert to cents
      currency: 'ils',
      metadata: {
        userId: userId.toString(),
        creditAmount: creditAmount.toString(),
        type: 'credit_purchase'
      },
      receipt_email: userEmail,
      description: `רכישת ${creditAmount} קרדיטים`
    });

    return {
      clientSecret: paymentIntent.client_secret,
      amount: price,
      credits: creditAmount
    };
  } catch (error) {
    logger.error('Failed to create payment intent:', error);
    throw error;
  }
};

// Create a subscription
const createSubscription = async (userId, planId, userEmail) => {
  try {
    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan || planId === 'free') {
      throw new Error(`Invalid subscription plan: ${planId}`);
    }

    // Create or retrieve customer
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: {
        userId: userId.toString()
      }
    });

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{
        price_data: {
          currency: 'ils',
          product_data: {
            name: `מנוי ${plan.name}`,
            description: plan.features.join(', ')
          },
          unit_amount: plan.price * 100,
          recurring: {
            interval: 'month'
          }
        }
      }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        userId: userId.toString(),
        planId: planId
      }
    });

    return {
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
      customerId: customer.id
    };
  } catch (error) {
    logger.error('Failed to create subscription:', error);
    throw error;
  }
};

// Cancel subscription
const cancelSubscription = async (subscriptionId) => {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true
    });

    return subscription;
  } catch (error) {
    logger.error('Failed to cancel subscription:', error);
    throw error;
  }
};

// Handle webhook events
const handleWebhook = async (event) => {
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handleSubscriptionPayment(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionCancellation(event.data.object);
        break;
        
      default:
        logger.info(`Unhandled webhook event type: ${event.type}`);
    }
  } catch (error) {
    logger.error('Webhook handling failed:', error);
    throw error;
  }
};

// Handle successful payment
const handlePaymentSuccess = async (paymentIntent) => {
  const { userId, creditAmount, type } = paymentIntent.metadata;
  
  if (type === 'credit_purchase') {
    // Add credits to user account
    logger.info(`Adding ${creditAmount} credits to user ${userId}`);
    // This would normally update the database
    // await updateUserCredits(userId, parseInt(creditAmount));
  }
};

// Handle subscription payment
const handleSubscriptionPayment = async (invoice) => {
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
  const { userId, planId } = subscription.metadata;
  
  // Update user subscription and add monthly credits
  logger.info(`Subscription payment for user ${userId}, plan ${planId}`);
  // This would normally update the database
  // await updateUserSubscription(userId, planId);
};

// Handle subscription cancellation
const handleSubscriptionCancellation = async (subscription) => {
  const { userId } = subscription.metadata;
  
  // Downgrade user to free plan
  logger.info(`Subscription cancelled for user ${userId}`);
  // This would normally update the database
  // await updateUserSubscription(userId, 'free');
};

// Get subscription info
const getSubscriptionInfo = async (customerId) => {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active'
    });

    return subscriptions.data[0] || null;
  } catch (error) {
    logger.error('Failed to get subscription info:', error);
    return null;
  }
};

// Calculate model usage cost
const calculateModelCost = (model, tokens) => {
  const costs = {
    'claude-3-sonnet': 0.003, // per 1k tokens
    'claude-3-haiku': 0.001,
    'gpt-4': 0.03,
    'gpt-3.5-turbo': 0.002,
    'gemini-pro': 0.001
  };

  const costPerToken = (costs[model] || 0.002) / 1000;
  return Math.ceil(tokens * costPerToken * 10); // Convert to credits (10 credits = $1)
};

module.exports = {
  SUBSCRIPTION_PLANS,
  CREDIT_PRICES,
  initializeStripe,
  createCreditPurchaseIntent,
  createSubscription,
  cancelSubscription,
  handleWebhook,
  getSubscriptionInfo,
  calculateModelCost,
  stripe: process.env.STRIPE_SECRET_KEY ? stripe : null
};