const logger = require('../utils/logger');
const cacheService = require('./cacheService');

class AnalyticsService {
  constructor() {
    this.events = [];
    this.aggregatedData = new Map();
    this.realTimeMetrics = new Map();
    
    // Analytics configuration
    this.config = {
      retentionDays: 90,
      aggregationIntervals: ['1h', '1d', '7d', '30d'],
      maxEventsInMemory: 10000,
      realTimeWindow: 300000 // 5 minutes
    };

    this.startAggregationTasks();
  }

  // Track user events
  trackEvent(eventType, userId, data = {}, timestamp = null) {
    try {
      const event = {
        id: this.generateEventId(),
        type: eventType,
        userId: userId,
        data: data,
        timestamp: timestamp || new Date(),
        sessionId: data.sessionId || null,
        ip: data.ip || null,
        userAgent: data.userAgent || null
      };

      // Store in memory for real-time processing
      this.events.push(event);

      // Maintain memory limit
      if (this.events.length > this.config.maxEventsInMemory) {
        this.events = this.events.slice(-this.config.maxEventsInMemory);
      }

      // Update real-time metrics
      this.updateRealTimeMetrics(event);

      // Cache for persistence
      this.cacheEvent(event);

      logger.debug(`Event tracked: ${eventType} for user ${userId}`);

    } catch (error) {
      logger.error('Error tracking event:', error);
    }
  }

  // Track page view
  trackPageView(userId, page, data = {}) {
    this.trackEvent('page_view', userId, {
      page: page,
      referrer: data.referrer,
      duration: data.duration,
      ...data
    });
  }

  // Track AI chat interaction
  trackChatInteraction(userId, data = {}) {
    this.trackEvent('chat_interaction', userId, {
      model: data.model,
      tokensUsed: data.tokensUsed,
      creditsUsed: data.creditsUsed,
      responseTime: data.responseTime,
      satisfaction: data.satisfaction,
      messageLength: data.messageLength,
      ...data
    });
  }

  // Track subscription event
  trackSubscription(userId, action, data = {}) {
    this.trackEvent('subscription', userId, {
      action: action, // 'subscribe', 'upgrade', 'downgrade', 'cancel'
      plan: data.plan,
      amount: data.amount,
      previousPlan: data.previousPlan,
      ...data
    });
  }

  // Track credit transaction
  trackCreditTransaction(userId, data = {}) {
    this.trackEvent('credit_transaction', userId, {
      type: data.type, // 'purchase', 'usage', 'bonus'
      amount: data.amount,
      balance: data.balance,
      reason: data.reason,
      ...data
    });
  }

  // Track error events
  trackError(userId, error, context = {}) {
    this.trackEvent('error', userId, {
      errorType: error.name,
      errorMessage: error.message,
      stack: error.stack,
      context: context,
      severity: context.severity || 'error'
    });
  }

  // Track performance metrics
  trackPerformance(userId, metric, value, context = {}) {
    this.trackEvent('performance', userId, {
      metric: metric,
      value: value,
      context: context
    });
  }

  // Update real-time metrics
  updateRealTimeMetrics(event) {
    try {
      const now = Date.now();
      const windowStart = now - this.config.realTimeWindow;

      // Clean old real-time data
      for (const [key, data] of this.realTimeMetrics.entries()) {
        data.events = data.events.filter(e => e.timestamp >= windowStart);
        if (data.events.length === 0) {
          this.realTimeMetrics.delete(key);
        }
      }

      // Add new event to real-time metrics
      const metricKey = `${event.type}_realtime`;
      if (!this.realTimeMetrics.has(metricKey)) {
        this.realTimeMetrics.set(metricKey, {
          events: [],
          count: 0,
          uniqueUsers: new Set()
        });
      }

      const metric = this.realTimeMetrics.get(metricKey);
      metric.events.push(event);
      metric.count++;
      metric.uniqueUsers.add(event.userId);

    } catch (error) {
      logger.error('Error updating real-time metrics:', error);
    }
  }

  // Cache event for persistence
  async cacheEvent(event) {
    try {
      const cacheKey = `analytics:event:${event.id}`;
      await cacheService.set(cacheKey, event, { ttl: this.config.retentionDays * 24 * 60 * 60 });

      // Add to daily aggregation queue
      const dateKey = new Date(event.timestamp).toISOString().split('T')[0];
      const dailyKey = `analytics:daily:${dateKey}`;
      const dailyEvents = await cacheService.get(dailyKey) || [];
      dailyEvents.push(event.id);
      await cacheService.set(dailyKey, dailyEvents, { ttl: this.config.retentionDays * 24 * 60 * 60 });

    } catch (error) {
      logger.error('Error caching event:', error);
    }
  }

  // Get user analytics
  async getUserAnalytics(userId, timeRange = '7d') {
    try {
      const userEvents = this.events.filter(e => e.userId === userId);
      const timeWindow = this.parseTimeRange(timeRange);
      const filteredEvents = userEvents.filter(e => 
        new Date(e.timestamp) >= new Date(Date.now() - timeWindow)
      );

      const analytics = {
        totalEvents: filteredEvents.length,
        uniqueDays: new Set(filteredEvents.map(e => 
          new Date(e.timestamp).toDateString()
        )).size,
        eventBreakdown: this.groupEventsByType(filteredEvents),
        chatStats: this.calculateChatStats(filteredEvents),
        usagePattern: this.calculateUsagePattern(filteredEvents),
        lastActivity: userEvents.length > 0 ? 
          Math.max(...userEvents.map(e => new Date(e.timestamp).getTime())) : null
      };

      return analytics;

    } catch (error) {
      logger.error('Error getting user analytics:', error);
      return null;
    }
  }

  // Get platform analytics
  async getPlatformAnalytics(timeRange = '7d') {
    try {
      const timeWindow = this.parseTimeRange(timeRange);
      const filteredEvents = this.events.filter(e => 
        new Date(e.timestamp) >= new Date(Date.now() - timeWindow)
      );

      const analytics = {
        overview: {
          totalEvents: filteredEvents.length,
          uniqueUsers: new Set(filteredEvents.map(e => e.userId)).size,
          activeUsers: this.calculateActiveUsers(filteredEvents),
          newUsers: this.calculateNewUsers(filteredEvents)
        },
        usage: {
          chatInteractions: this.calculateChatMetrics(filteredEvents),
          modelUsage: this.calculateModelUsage(filteredEvents),
          featureUsage: this.calculateFeatureUsage(filteredEvents)
        },
        revenue: {
          subscriptions: this.calculateSubscriptionMetrics(filteredEvents),
          credits: this.calculateCreditMetrics(filteredEvents)
        },
        performance: {
          averageResponseTime: this.calculateAverageResponseTime(filteredEvents),
          errorRate: this.calculateErrorRate(filteredEvents),
          satisfaction: this.calculateSatisfactionScore(filteredEvents)
        },
        trends: {
          hourly: this.calculateHourlyTrends(filteredEvents),
          daily: this.calculateDailyTrends(filteredEvents)
        }
      };

      return analytics;

    } catch (error) {
      logger.error('Error getting platform analytics:', error);
      return null;
    }
  }

  // Calculate chat statistics
  calculateChatStats(events) {
    const chatEvents = events.filter(e => e.type === 'chat_interaction');
    
    if (chatEvents.length === 0) {
      return {
        totalChats: 0,
        totalTokens: 0,
        totalCredits: 0,
        averageResponseTime: 0,
        modelBreakdown: {}
      };
    }

    const totalTokens = chatEvents.reduce((sum, e) => sum + (e.data.tokensUsed || 0), 0);
    const totalCredits = chatEvents.reduce((sum, e) => sum + (e.data.creditsUsed || 0), 0);
    const responseTime = chatEvents.reduce((sum, e) => sum + (e.data.responseTime || 0), 0);

    const modelBreakdown = {};
    chatEvents.forEach(e => {
      const model = e.data.model || 'unknown';
      modelBreakdown[model] = (modelBreakdown[model] || 0) + 1;
    });

    return {
      totalChats: chatEvents.length,
      totalTokens,
      totalCredits,
      averageResponseTime: responseTime / chatEvents.length,
      modelBreakdown
    };
  }

  // Calculate usage patterns
  calculateUsagePattern(events) {
    const hourlyUsage = new Array(24).fill(0);
    const dailyUsage = {};

    events.forEach(event => {
      const date = new Date(event.timestamp);
      const hour = date.getHours();
      const day = date.toDateString();

      hourlyUsage[hour]++;
      dailyUsage[day] = (dailyUsage[day] || 0) + 1;
    });

    return {
      hourlyDistribution: hourlyUsage,
      dailyDistribution: dailyUsage,
      peakHour: hourlyUsage.indexOf(Math.max(...hourlyUsage)),
      averageSessionsPerDay: Object.values(dailyUsage).reduce((a, b) => a + b, 0) / 
        Object.keys(dailyUsage).length
    };
  }

  // Group events by type
  groupEventsByType(events) {
    const breakdown = {};
    events.forEach(event => {
      breakdown[event.type] = (breakdown[event.type] || 0) + 1;
    });
    return breakdown;
  }

  // Calculate active users
  calculateActiveUsers(events) {
    const timeWindows = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };

    const activeUsers = {};
    const now = Date.now();

    for (const [window, duration] of Object.entries(timeWindows)) {
      const windowEvents = events.filter(e => 
        new Date(e.timestamp).getTime() >= now - duration
      );
      activeUsers[window] = new Set(windowEvents.map(e => e.userId)).size;
    }

    return activeUsers;
  }

  // Calculate new users
  calculateNewUsers(events) {
    const registrationEvents = events.filter(e => e.type === 'user_registration');
    
    const newUsersByDay = {};
    registrationEvents.forEach(event => {
      const day = new Date(event.timestamp).toDateString();
      newUsersByDay[day] = (newUsersByDay[day] || 0) + 1;
    });

    return {
      total: registrationEvents.length,
      byDay: newUsersByDay,
      averagePerDay: registrationEvents.length / 
        (Object.keys(newUsersByDay).length || 1)
    };
  }

  // Calculate chat metrics
  calculateChatMetrics(events) {
    const chatEvents = events.filter(e => e.type === 'chat_interaction');
    
    return {
      totalInteractions: chatEvents.length,
      uniqueUsers: new Set(chatEvents.map(e => e.userId)).size,
      averagePerUser: chatEvents.length / new Set(chatEvents.map(e => e.userId)).size,
      totalTokens: chatEvents.reduce((sum, e) => sum + (e.data.tokensUsed || 0), 0),
      totalCredits: chatEvents.reduce((sum, e) => sum + (e.data.creditsUsed || 0), 0)
    };
  }

  // Calculate model usage
  calculateModelUsage(events) {
    const chatEvents = events.filter(e => e.type === 'chat_interaction');
    const modelStats = {};

    chatEvents.forEach(event => {
      const model = event.data.model || 'unknown';
      if (!modelStats[model]) {
        modelStats[model] = {
          count: 0,
          tokens: 0,
          credits: 0,
          responseTime: 0
        };
      }

      modelStats[model].count++;
      modelStats[model].tokens += event.data.tokensUsed || 0;
      modelStats[model].credits += event.data.creditsUsed || 0;
      modelStats[model].responseTime += event.data.responseTime || 0;
    });

    // Calculate averages
    Object.values(modelStats).forEach(stats => {
      stats.averageResponseTime = stats.count > 0 ? stats.responseTime / stats.count : 0;
      delete stats.responseTime;
    });

    return modelStats;
  }

  // Get real-time metrics
  getRealTimeMetrics() {
    const metrics = {};
    
    for (const [key, data] of this.realTimeMetrics.entries()) {
      metrics[key] = {
        count: data.count,
        uniqueUsers: data.uniqueUsers.size,
        eventsPerMinute: (data.events.length / (this.config.realTimeWindow / 60000)).toFixed(2)
      };
    }

    return {
      timestamp: new Date(),
      window: `${this.config.realTimeWindow / 1000}s`,
      metrics
    };
  }

  // Generate cohort analysis
  async generateCohortAnalysis(timeRange = '30d') {
    try {
      const timeWindow = this.parseTimeRange(timeRange);
      const events = this.events.filter(e => 
        new Date(e.timestamp) >= new Date(Date.now() - timeWindow)
      );

      const registrationEvents = events.filter(e => e.type === 'user_registration');
      const cohorts = {};

      registrationEvents.forEach(event => {
        const cohortDate = new Date(event.timestamp).toISOString().split('T')[0];
        if (!cohorts[cohortDate]) {
          cohorts[cohortDate] = new Set();
        }
        cohorts[cohortDate].add(event.userId);
      });

      // Calculate retention for each cohort
      const cohortAnalysis = {};
      for (const [date, users] of Object.entries(cohorts)) {
        const cohortUsers = Array.from(users);
        const retention = {};

        for (let week = 1; week <= 4; week++) {
          const weekStart = new Date(date);
          weekStart.setDate(weekStart.getDate() + (week * 7));
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 7);

          const activeInWeek = cohortUsers.filter(userId => {
            return events.some(e => 
              e.userId === userId &&
              new Date(e.timestamp) >= weekStart &&
              new Date(e.timestamp) < weekEnd
            );
          });

          retention[`week_${week}`] = {
            count: activeInWeek.length,
            percentage: (activeInWeek.length / cohortUsers.length * 100).toFixed(2)
          };
        }

        cohortAnalysis[date] = {
          totalUsers: cohortUsers.length,
          retention
        };
      }

      return cohortAnalysis;

    } catch (error) {
      logger.error('Error generating cohort analysis:', error);
      return null;
    }
  }

  // Utility functions
  parseTimeRange(timeRange) {
    const units = {
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000,
      'w': 7 * 24 * 60 * 60 * 1000,
      'm': 30 * 24 * 60 * 60 * 1000
    };

    const match = timeRange.match(/(\d+)([hdwm])/);
    if (match) {
      const [, number, unit] = match;
      return parseInt(number) * units[unit];
    }

    return 7 * 24 * 60 * 60 * 1000; // Default to 7 days
  }

  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Start aggregation tasks
  startAggregationTasks() {
    // Aggregate data every hour
    setInterval(() => {
      this.aggregateHourlyData();
    }, 60 * 60 * 1000);

    // Aggregate daily data every day
    setInterval(() => {
      this.aggregateDailyData();
    }, 24 * 60 * 60 * 1000);
  }

  async aggregateHourlyData() {
    try {
      logger.info('Starting hourly data aggregation');
      // Implementation for hourly aggregation
    } catch (error) {
      logger.error('Error in hourly aggregation:', error);
    }
  }

  async aggregateDailyData() {
    try {
      logger.info('Starting daily data aggregation');
      // Implementation for daily aggregation
    } catch (error) {
      logger.error('Error in daily aggregation:', error);
    }
  }

  // Additional helper methods
  calculateHourlyTrends(events) {
    const hourlyData = new Array(24).fill(0);
    events.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      hourlyData[hour]++;
    });
    return hourlyData;
  }

  calculateDailyTrends(events) {
    const dailyData = {};
    events.forEach(event => {
      const day = new Date(event.timestamp).toDateString();
      dailyData[day] = (dailyData[day] || 0) + 1;
    });
    return dailyData;
  }

  calculateAverageResponseTime(events) {
    const chatEvents = events.filter(e => e.type === 'chat_interaction' && e.data.responseTime);
    if (chatEvents.length === 0) return 0;
    
    const totalTime = chatEvents.reduce((sum, e) => sum + e.data.responseTime, 0);
    return totalTime / chatEvents.length;
  }

  calculateErrorRate(events) {
    const errorEvents = events.filter(e => e.type === 'error');
    return events.length > 0 ? (errorEvents.length / events.length) * 100 : 0;
  }

  calculateSatisfactionScore(events) {
    const satisfactionEvents = events.filter(e => 
      e.type === 'chat_interaction' && e.data.satisfaction
    );
    
    if (satisfactionEvents.length === 0) return 0;
    
    const totalSatisfaction = satisfactionEvents.reduce((sum, e) => sum + e.data.satisfaction, 0);
    return totalSatisfaction / satisfactionEvents.length;
  }

  calculateSubscriptionMetrics(events) {
    const subEvents = events.filter(e => e.type === 'subscription');
    
    const metrics = {
      newSubscriptions: subEvents.filter(e => e.data.action === 'subscribe').length,
      upgrades: subEvents.filter(e => e.data.action === 'upgrade').length,
      downgrades: subEvents.filter(e => e.data.action === 'downgrade').length,
      cancellations: subEvents.filter(e => e.data.action === 'cancel').length,
      revenue: subEvents.reduce((sum, e) => sum + (e.data.amount || 0), 0)
    };

    return metrics;
  }

  calculateCreditMetrics(events) {
    const creditEvents = events.filter(e => e.type === 'credit_transaction');
    
    return {
      totalPurchases: creditEvents.filter(e => e.data.type === 'purchase').length,
      totalUsage: creditEvents.filter(e => e.data.type === 'usage').length,
      totalCreditsUsed: creditEvents
        .filter(e => e.data.type === 'usage')
        .reduce((sum, e) => sum + (e.data.amount || 0), 0),
      totalCreditsPurchased: creditEvents
        .filter(e => e.data.type === 'purchase')
        .reduce((sum, e) => sum + (e.data.amount || 0), 0)
    };
  }

  calculateFeatureUsage(events) {
    const features = {};
    
    events.forEach(event => {
      if (event.data && event.data.feature) {
        features[event.data.feature] = (features[event.data.feature] || 0) + 1;
      }
    });

    return features;
  }
}

// Create singleton instance
const analyticsService = new AnalyticsService();

module.exports = analyticsService;