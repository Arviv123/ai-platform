/**
 * Personalization Service - Advanced AI Personalization and Adaptation
 * Provides personalized AI interactions based on user behavior and preferences
 */

const logger = require('../../utils/logger');
const { PrismaClient } = require('@prisma/client');

class PersonalizationService {
  constructor() {
    this.prisma = new PrismaClient();
    this.learningPatterns = new Map();
    this.adaptationRules = new Map();
    this.userProfiles = new Map();
    
    this.setupDefaultAdaptationRules();
  }

  /**
   * Initialize the personalization service
   */
  async initialize() {
    try {
      await this.loadExistingProfiles();
      logger.info('✅ Personalization Service initialized successfully');
      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize Personalization Service:', error);
      throw error;
    }
  }

  /**
   * Load existing user profiles from database
   */
  async loadExistingProfiles() {
    try {
      const profiles = await this.prisma.personalizationProfile.findMany({
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      for (const profile of profiles) {
        this.userProfiles.set(profile.userId, {
          ...profile,
          preferences: JSON.parse(profile.preferences || '{}'),
          interactionHistory: JSON.parse(profile.interactionHistory || '{}'),
          goals: JSON.parse(profile.goals || '{}'),
          adaptationData: JSON.parse(profile.adaptationData || '{}')
        });
      }

      logger.info(`📊 Loaded ${profiles.length} personalization profiles`);
    } catch (error) {
      logger.error('❌ Failed to load personalization profiles:', error);
      throw error;
    }
  }

  /**
   * Setup default adaptation rules
   */
  setupDefaultAdaptationRules() {
    // Communication style adaptations
    this.adaptationRules.set('communication_formal', {
      name: 'Formal Communication',
      description: 'Adapt to formal communication style',
      triggers: ['professional', 'business', 'formal'],
      adaptations: {
        tone: 'professional',
        vocabulary: 'formal',
        structure: 'structured',
        examples: 'professional'
      }
    });

    this.adaptationRules.set('communication_casual', {
      name: 'Casual Communication',
      description: 'Adapt to casual communication style',
      triggers: ['casual', 'friendly', 'relaxed'],
      adaptations: {
        tone: 'friendly',
        vocabulary: 'conversational',
        structure: 'flexible',
        examples: 'relatable'
      }
    });

    // Learning style adaptations
    this.adaptationRules.set('learning_visual', {
      name: 'Visual Learning',
      description: 'Adapt to visual learning preferences',
      triggers: ['visual', 'diagrams', 'charts'],
      adaptations: {
        responseFormat: 'structured',
        includeVisualDescriptions: true,
        useAnalogies: true,
        suggestDiagrams: true
      }
    });

    this.adaptationRules.set('learning_hands_on', {
      name: 'Hands-on Learning',
      description: 'Adapt to practical learning preferences',
      triggers: ['practical', 'hands-on', 'examples'],
      adaptations: {
        includeExamples: true,
        provideTutorials: true,
        stepByStep: true,
        actionable: true
      }
    });

    // Skill level adaptations
    this.adaptationRules.set('skill_beginner', {
      name: 'Beginner Adaptation',
      description: 'Adapt explanations for beginners',
      triggers: ['beginner', 'new', 'learning'],
      adaptations: {
        explanationDepth: 'detailed',
        technicalTerms: 'explained',
        assumptions: 'minimal',
        encouragement: 'high'
      }
    });

    this.adaptationRules.set('skill_advanced', {
      name: 'Advanced Adaptation',
      description: 'Adapt explanations for advanced users',
      triggers: ['advanced', 'expert', 'experienced'],
      adaptations: {
        explanationDepth: 'concise',
        technicalTerms: 'assumed',
        assumptions: 'many',
        efficiency: 'prioritized'
      }
    });

    logger.info(`🎯 Loaded ${this.adaptationRules.size} adaptation rules`);
  }

  /**
   * Create or update user personalization profile
   */
  async createOrUpdateProfile(userId, profileData) {
    try {
      const existingProfile = await this.prisma.personalizationProfile.findUnique({
        where: { userId }
      });

      const profilePayload = {
        userId,
        preferences: JSON.stringify(profileData.preferences || {}),
        learningStyle: profileData.learningStyle,
        communicationStyle: profileData.communicationStyle,
        customInstructions: profileData.customInstructions,
        topicInterests: profileData.topicInterests || [],
        skillLevel: profileData.skillLevel,
        goals: JSON.stringify(profileData.goals || {}),
        adaptationData: JSON.stringify(profileData.adaptationData || {})
      };

      let profile;
      if (existingProfile) {
        profile = await this.prisma.personalizationProfile.update({
          where: { userId },
          data: profilePayload
        });
      } else {
        profile = await this.prisma.personalizationProfile.create({
          data: profilePayload
        });
      }

      // Update in-memory cache
      this.userProfiles.set(userId, {
        ...profile,
        preferences: JSON.parse(profile.preferences),
        goals: JSON.parse(profile.goals),
        adaptationData: JSON.parse(profile.adaptationData)
      });

      logger.info(`👤 ${existingProfile ? 'Updated' : 'Created'} personalization profile for user ${userId}`);
      return profile;
    } catch (error) {
      logger.error(`❌ Failed to create/update profile for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get user personalization profile
   */
  async getUserProfile(userId) {
    try {
      // Check in-memory cache first
      if (this.userProfiles.has(userId)) {
        return this.userProfiles.get(userId);
      }

      // Load from database
      const profile = await this.prisma.personalizationProfile.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      if (profile) {
        const parsedProfile = {
          ...profile,
          preferences: JSON.parse(profile.preferences || '{}'),
          interactionHistory: JSON.parse(profile.interactionHistory || '{}'),
          goals: JSON.parse(profile.goals || '{}'),
          adaptationData: JSON.parse(profile.adaptationData || '{}')
        };

        this.userProfiles.set(userId, parsedProfile);
        return parsedProfile;
      }

      return null;
    } catch (error) {
      logger.error(`❌ Failed to get profile for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Personalize AI response based on user profile
   */
  async personalizeResponse(userId, originalPrompt, responseContext = {}) {
    try {
      const profile = await this.getUserProfile(userId);
      if (!profile) {
        // Return original prompt if no profile exists
        return {
          prompt: originalPrompt,
          adaptations: [],
          profile: null
        };
      }

      const adaptations = [];
      let personalizedPrompt = originalPrompt;

      // Apply communication style adaptations
      if (profile.communicationStyle) {
        const styleRule = this.adaptationRules.get(`communication_${profile.communicationStyle}`);
        if (styleRule) {
          personalizedPrompt = this.applyStyleAdaptation(personalizedPrompt, styleRule);
          adaptations.push({
            type: 'communication_style',
            rule: styleRule.name,
            applied: true
          });
        }
      }

      // Apply learning style adaptations
      if (profile.learningStyle) {
        const learningRule = this.adaptationRules.get(`learning_${profile.learningStyle}`);
        if (learningRule) {
          personalizedPrompt = this.applyLearningAdaptation(personalizedPrompt, learningRule);
          adaptations.push({
            type: 'learning_style',
            rule: learningRule.name,
            applied: true
          });
        }
      }

      // Apply skill level adaptations
      if (profile.skillLevel) {
        const skillRule = this.adaptationRules.get(`skill_${profile.skillLevel}`);
        if (skillRule) {
          personalizedPrompt = this.applySkillAdaptation(personalizedPrompt, skillRule);
          adaptations.push({
            type: 'skill_level',
            rule: skillRule.name,
            applied: true
          });
        }
      }

      // Apply custom instructions
      if (profile.customInstructions) {
        personalizedPrompt = this.applyCustomInstructions(personalizedPrompt, profile.customInstructions);
        adaptations.push({
          type: 'custom_instructions',
          applied: true
        });
      }

      // Apply topic interests
      if (profile.topicInterests && profile.topicInterests.length > 0) {
        personalizedPrompt = this.applyTopicInterests(personalizedPrompt, profile.topicInterests);
        adaptations.push({
          type: 'topic_interests',
          interests: profile.topicInterests,
          applied: true
        });
      }

      // Update interaction history
      await this.updateInteractionHistory(userId, {
        prompt: originalPrompt,
        personalizedPrompt,
        adaptations,
        timestamp: new Date()
      });

      logger.info(`🎨 Personalized response for user ${userId} with ${adaptations.length} adaptations`);

      return {
        prompt: personalizedPrompt,
        adaptations,
        profile: {
          communicationStyle: profile.communicationStyle,
          learningStyle: profile.learningStyle,
          skillLevel: profile.skillLevel,
          topicInterests: profile.topicInterests
        }
      };
    } catch (error) {
      logger.error(`❌ Failed to personalize response for user ${userId}:`, error);
      // Return original prompt on error
      return {
        prompt: originalPrompt,
        adaptations: [],
        profile: null,
        error: error.message
      };
    }
  }

  /**
   * Apply communication style adaptation
   */
  applyStyleAdaptation(prompt, styleRule) {
    let adaptedPrompt = prompt;

    const adaptations = styleRule.adaptations;

    if (adaptations.tone === 'professional') {
      adaptedPrompt += '\n\nPlease respond in a professional, business-appropriate tone.';
    } else if (adaptations.tone === 'friendly') {
      adaptedPrompt += '\n\nPlease respond in a friendly, conversational tone.';
    }

    if (adaptations.structure === 'structured') {
      adaptedPrompt += ' Use clear structure with headings and bullet points where appropriate.';
    }

    return adaptedPrompt;
  }

  /**
   * Apply learning style adaptation
   */
  applyLearningAdaptation(prompt, learningRule) {
    let adaptedPrompt = prompt;

    const adaptations = learningRule.adaptations;

    if (adaptations.includeVisualDescriptions) {
      adaptedPrompt += '\n\nWhen possible, describe visual elements, diagrams, or charts that would help explain concepts.';
    }

    if (adaptations.includeExamples) {
      adaptedPrompt += '\n\nPlease include practical examples and step-by-step instructions.';
    }

    if (adaptations.stepByStep) {
      adaptedPrompt += ' Break down complex processes into clear, actionable steps.';
    }

    return adaptedPrompt;
  }

  /**
   * Apply skill level adaptation
   */
  applySkillAdaptation(prompt, skillRule) {
    let adaptedPrompt = prompt;

    const adaptations = skillRule.adaptations;

    if (adaptations.explanationDepth === 'detailed') {
      adaptedPrompt += '\n\nPlease provide detailed explanations and define technical terms.';
    } else if (adaptations.explanationDepth === 'concise') {
      adaptedPrompt += '\n\nPlease be concise and assume familiarity with technical concepts.';
    }

    if (adaptations.encouragement === 'high') {
      adaptedPrompt += ' Use encouraging language appropriate for someone learning.';
    }

    return adaptedPrompt;
  }

  /**
   * Apply custom instructions
   */
  applyCustomInstructions(prompt, customInstructions) {
    return `${prompt}\n\nCustom instructions: ${customInstructions}`;
  }

  /**
   * Apply topic interests
   */
  applyTopicInterests(prompt, topicInterests) {
    const interestsText = topicInterests.join(', ');
    return `${prompt}\n\nNote: User has expressed interest in: ${interestsText}. Feel free to relate explanations to these areas when relevant.`;
  }

  /**
   * Update user interaction history
   */
  async updateInteractionHistory(userId, interactionData) {
    try {
      const profile = await this.getUserProfile(userId);
      if (!profile) return;

      const currentHistory = profile.interactionHistory || {};
      
      // Add new interaction
      if (!currentHistory.interactions) {
        currentHistory.interactions = [];
      }

      currentHistory.interactions.push(interactionData);

      // Keep only last 100 interactions
      if (currentHistory.interactions.length > 100) {
        currentHistory.interactions = currentHistory.interactions.slice(-100);
      }

      // Update statistics
      currentHistory.totalInteractions = (currentHistory.totalInteractions || 0) + 1;
      currentHistory.lastInteraction = new Date();

      // Update in database
      await this.prisma.personalizationProfile.update({
        where: { userId },
        data: {
          interactionHistory: JSON.stringify(currentHistory)
        }
      });

      // Update cache
      profile.interactionHistory = currentHistory;
      this.userProfiles.set(userId, profile);

    } catch (error) {
      logger.error(`❌ Failed to update interaction history for user ${userId}:`, error);
    }
  }

  /**
   * Learn from user feedback and adapt
   */
  async learnFromFeedback(userId, feedback) {
    try {
      const profile = await this.getUserProfile(userId);
      if (!profile) {
        throw new Error('User profile not found');
      }

      const adaptationData = profile.adaptationData || {};
      
      // Process feedback
      if (feedback.rating) {
        if (!adaptationData.feedbackHistory) {
          adaptationData.feedbackHistory = [];
        }
        
        adaptationData.feedbackHistory.push({
          rating: feedback.rating,
          comment: feedback.comment,
          context: feedback.context,
          timestamp: new Date()
        });

        // Calculate average rating
        const ratings = adaptationData.feedbackHistory.map(f => f.rating);
        adaptationData.averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      }

      // Adapt based on feedback patterns
      if (feedback.preferredStyle && feedback.preferredStyle !== profile.communicationStyle) {
        await this.prisma.personalizationProfile.update({
          where: { userId },
          data: {
            communicationStyle: feedback.preferredStyle,
            adaptationData: JSON.stringify(adaptationData)
          }
        });

        logger.info(`📚 Adapted communication style for user ${userId} to ${feedback.preferredStyle}`);
      }

      // Update cache
      profile.adaptationData = adaptationData;
      if (feedback.preferredStyle) {
        profile.communicationStyle = feedback.preferredStyle;
      }
      this.userProfiles.set(userId, profile);

      return {
        success: true,
        adaptations: adaptationData,
        message: 'Feedback processed and adaptations applied'
      };

    } catch (error) {
      logger.error(`❌ Failed to learn from feedback for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Generate personalization insights
   */
  async generateInsights(userId) {
    try {
      const profile = await this.getUserProfile(userId);
      if (!profile) {
        return { insights: [], recommendations: [] };
      }

      const insights = [];
      const recommendations = [];

      // Analyze interaction patterns
      const history = profile.interactionHistory;
      if (history && history.interactions) {
        const totalInteractions = history.interactions.length;
        insights.push(`Has ${totalInteractions} recorded interactions`);

        // Analyze adaptation usage
        const adaptationTypes = history.interactions
          .flatMap(i => i.adaptations || [])
          .map(a => a.type);

        const adaptationCounts = adaptationTypes.reduce((acc, type) => {
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});

        const mostUsedAdaptation = Object.entries(adaptationCounts)
          .sort(([,a], [,b]) => b - a)[0];

        if (mostUsedAdaptation) {
          insights.push(`Most used adaptation: ${mostUsedAdaptation[0]} (${mostUsedAdaptation[1]} times)`);
        }
      }

      // Generate recommendations
      if (!profile.learningStyle) {
        recommendations.push('Consider setting a learning style preference for better personalization');
      }

      if (!profile.topicInterests || profile.topicInterests.length === 0) {
        recommendations.push('Add topic interests to get more relevant examples and explanations');
      }

      if (!profile.customInstructions) {
        recommendations.push('Add custom instructions for more tailored responses');
      }

      // Feedback analysis
      const adaptationData = profile.adaptationData;
      if (adaptationData && adaptationData.averageRating) {
        insights.push(`Average feedback rating: ${adaptationData.averageRating.toFixed(1)}/5`);
        
        if (adaptationData.averageRating < 3.5) {
          recommendations.push('Consider updating preferences based on recent interactions');
        }
      }

      return {
        insights,
        recommendations,
        profile: {
          communicationStyle: profile.communicationStyle,
          learningStyle: profile.learningStyle,
          skillLevel: profile.skillLevel,
          topicInterests: profile.topicInterests,
          lastUpdated: profile.updatedAt
        }
      };

    } catch (error) {
      logger.error(`❌ Failed to generate insights for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      service: 'Personalization Service',
      version: '1.0.0',
      status: 'active',
      profilesLoaded: this.userProfiles.size,
      adaptationRules: this.adaptationRules.size,
      availableAdaptations: Array.from(this.adaptationRules.keys())
    };
  }

  /**
   * Reset user personalization (for testing/privacy)
   */
  async resetUserPersonalization(userId) {
    try {
      await this.prisma.personalizationProfile.delete({
        where: { userId }
      });

      this.userProfiles.delete(userId);

      logger.info(`🔄 Reset personalization for user ${userId}`);
      return { success: true, message: 'Personalization data reset successfully' };

    } catch (error) {
      logger.error(`❌ Failed to reset personalization for user ${userId}:`, error);
      throw error;
    }
  }
}

module.exports = PersonalizationService;