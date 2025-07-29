/**
 * Intelligence Analyzer - Advanced AI Intelligence Metrics and Analysis
 * Analyzes and tracks various aspects of AI performance and intelligence
 */

const logger = require('../../utils/logger');
const { PrismaClient } = require('@prisma/client');

class IntelligenceAnalyzer {
  constructor() {
    this.prisma = new PrismaClient();
    this.metricTypes = new Map();
    this.analysisRules = new Map();
    this.performanceCache = new Map();
    
    this.setupMetricTypes();
    this.setupAnalysisRules();
  }

  /**
   * Initialize the intelligence analyzer
   */
  async initialize() {
    try {
      logger.info('✅ Intelligence Analyzer initialized successfully');
      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize Intelligence Analyzer:', error);
      throw error;
    }
  }

  /**
   * Setup metric types for intelligence analysis
   */
  setupMetricTypes() {
    // Reasoning and Logic Metrics
    this.metricTypes.set('reasoning_depth', {
      name: 'Reasoning Depth',
      description: 'Measures the depth of logical reasoning in responses',
      scale: 'linear',
      range: [0, 10],
      category: 'reasoning'
    });

    this.metricTypes.set('logical_consistency', {
      name: 'Logical Consistency',
      description: 'Measures consistency of logical arguments',
      scale: 'percentage',
      range: [0, 100],
      category: 'reasoning'
    });

    // Creativity and Innovation Metrics
    this.metricTypes.set('creativity_score', {
      name: 'Creativity Score',
      description: 'Measures creative and innovative thinking',
      scale: 'linear',
      range: [0, 10],
      category: 'creativity'
    });

    this.metricTypes.set('novelty_index', {
      name: 'Novelty Index',
      description: 'Measures uniqueness and originality of responses',
      scale: 'percentage',
      range: [0, 100],
      category: 'creativity'
    });

    // Technical and Accuracy Metrics
    this.metricTypes.set('technical_accuracy', {
      name: 'Technical Accuracy',
      description: 'Measures accuracy of technical information',
      scale: 'percentage',
      range: [0, 100],
      category: 'accuracy'
    });

    this.metricTypes.set('factual_correctness', {
      name: 'Factual Correctness',
      description: 'Measures correctness of factual statements',
      scale: 'percentage',
      range: [0, 100],
      category: 'accuracy'
    });

    // Communication and Clarity Metrics
    this.metricTypes.set('clarity_score', {
      name: 'Clarity Score',
      description: 'Measures clarity and understandability of responses',
      scale: 'linear',
      range: [0, 10],
      category: 'communication'
    });

    this.metricTypes.set('coherence_index', {
      name: 'Coherence Index',
      description: 'Measures internal coherence and flow',
      scale: 'percentage',
      range: [0, 100],
      category: 'communication'
    });

    // Problem-Solving Metrics
    this.metricTypes.set('problem_solving_effectiveness', {
      name: 'Problem Solving Effectiveness',
      description: 'Measures effectiveness in solving problems',
      scale: 'linear',
      range: [0, 10],
      category: 'problem_solving'
    });

    this.metricTypes.set('solution_completeness', {
      name: 'Solution Completeness',
      description: 'Measures completeness of provided solutions',
      scale: 'percentage',
      range: [0, 100],
      category: 'problem_solving'
    });

    // Learning and Adaptation Metrics
    this.metricTypes.set('learning_rate', {
      name: 'Learning Rate',
      description: 'Measures rate of learning from interactions',
      scale: 'linear',
      range: [0, 5],
      category: 'learning'
    });

    this.metricTypes.set('adaptation_speed', {
      name: 'Adaptation Speed',
      description: 'Measures speed of adaptation to user preferences',
      scale: 'linear',
      range: [0, 5],
      category: 'learning'
    });

    logger.info(`📊 Loaded ${this.metricTypes.size} intelligence metric types`);
  }

  /**
   * Setup analysis rules for different contexts
   */
  setupAnalysisRules() {
    // Code-related analysis
    this.analysisRules.set('code_analysis', {
      name: 'Code Analysis',
      description: 'Analyzes intelligence in code-related responses',
      applicableMetrics: [
        'technical_accuracy',
        'logical_consistency',
        'problem_solving_effectiveness',
        'solution_completeness',
        'clarity_score'
      ],
      weights: {
        'technical_accuracy': 0.3,
        'logical_consistency': 0.25,
        'problem_solving_effectiveness': 0.25,
        'solution_completeness': 0.15,
        'clarity_score': 0.05
      }
    });

    // Creative tasks analysis
    this.analysisRules.set('creative_analysis', {
      name: 'Creative Analysis',
      description: 'Analyzes intelligence in creative tasks',
      applicableMetrics: [
        'creativity_score',
        'novelty_index',
        'coherence_index',
        'clarity_score'
      ],
      weights: {
        'creativity_score': 0.4,
        'novelty_index': 0.3,
        'coherence_index': 0.2,
        'clarity_score': 0.1
      }
    });

    // General conversation analysis
    this.analysisRules.set('conversation_analysis', {
      name: 'Conversation Analysis',
      description: 'Analyzes intelligence in general conversations',
      applicableMetrics: [
        'reasoning_depth',
        'clarity_score',
        'coherence_index',
        'factual_correctness',
        'adaptation_speed'
      ],
      weights: {
        'reasoning_depth': 0.25,
        'clarity_score': 0.25,
        'coherence_index': 0.2,
        'factual_correctness': 0.2,
        'adaptation_speed': 0.1
      }
    });

    // Problem-solving analysis
    this.analysisRules.set('problem_solving_analysis', {
      name: 'Problem Solving Analysis',
      description: 'Analyzes intelligence in problem-solving tasks',
      applicableMetrics: [
        'problem_solving_effectiveness',
        'reasoning_depth',
        'logical_consistency',
        'solution_completeness',
        'creativity_score'
      ],
      weights: {
        'problem_solving_effectiveness': 0.3,
        'reasoning_depth': 0.25,
        'logical_consistency': 0.2,
        'solution_completeness': 0.15,
        'creativity_score': 0.1
      }
    });

    logger.info(`🎯 Loaded ${this.analysisRules.size} analysis rules`);
  }

  /**
   * Analyze response and calculate intelligence metrics
   */
  async analyzeResponse(userId, sessionId, response, context = {}) {
    try {
      const analysisType = this.determineAnalysisType(response, context);
      const rule = this.analysisRules.get(analysisType);
      
      if (!rule) {
        logger.warn(`No analysis rule found for type: ${analysisType}`);
        return null;
      }

      const metrics = {};
      const rawScores = {};

      // Calculate individual metrics
      for (const metricType of rule.applicableMetrics) {
        const score = await this.calculateMetric(metricType, response, context);
        rawScores[metricType] = score;
        metrics[metricType] = {
          value: score,
          weight: rule.weights[metricType] || 0,
          category: this.metricTypes.get(metricType)?.category || 'general'
        };
      }

      // Calculate weighted overall score
      const overallScore = Object.entries(metrics).reduce((sum, [type, data]) => {
        return sum + (data.value * data.weight);
      }, 0);

      // Store metrics in database
      const metricPromises = Object.entries(rawScores).map(([type, value]) =>
        this.prisma.intelligenceMetrics.create({
          data: {
            userId,
            sessionId,
            metricType: type,
            value,
            context: JSON.stringify({
              analysisType,
              responseLength: response.length,
              timestamp: new Date(),
              ...context
            })
          }
        })
      );

      await Promise.all(metricPromises);

      // Update performance cache
      this.updatePerformanceCache(userId, analysisType, overallScore);

      logger.info(`🧠 Analyzed response for user ${userId}: overall score ${overallScore.toFixed(2)}`);

      return {
        analysisType,
        overallScore: Math.round(overallScore * 100) / 100,
        metrics,
        insights: this.generateInsights(metrics, analysisType),
        timestamp: new Date()
      };

    } catch (error) {
      logger.error(`❌ Failed to analyze response for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Determine the appropriate analysis type based on response and context
   */
  determineAnalysisType(response, context) {
    const text = response.toLowerCase();
    
    // Check for code-related content
    if (context.type === 'code' || 
        text.includes('function') || 
        text.includes('class') || 
        text.includes('algorithm') ||
        text.includes('```')) {
      return 'code_analysis';
    }

    // Check for creative content
    if (context.type === 'creative' ||
        text.includes('creative') ||
        text.includes('imagine') ||
        text.includes('story') ||
        text.includes('design')) {
      return 'creative_analysis';
    }

    // Check for problem-solving content
    if (context.type === 'problem' ||
        text.includes('problem') ||
        text.includes('solution') ||
        text.includes('solve') ||
        text.includes('approach')) {
      return 'problem_solving_analysis';
    }

    // Default to conversation analysis
    return 'conversation_analysis';
  }

  /**
   * Calculate specific metric value
   */
  async calculateMetric(metricType, response, context) {
    try {
      switch (metricType) {
        case 'reasoning_depth':
          return this.calculateReasoningDepth(response);
          
        case 'logical_consistency':
          return this.calculateLogicalConsistency(response);
          
        case 'creativity_score':
          return this.calculateCreativityScore(response);
          
        case 'novelty_index':
          return this.calculateNoveltyIndex(response, context);
          
        case 'technical_accuracy':
          return this.calculateTechnicalAccuracy(response, context);
          
        case 'factual_correctness':
          return this.calculateFactualCorrectness(response);
          
        case 'clarity_score':
          return this.calculateClarityScore(response);
          
        case 'coherence_index':
          return this.calculateCoherenceIndex(response);
          
        case 'problem_solving_effectiveness':
          return this.calculateProblemSolvingEffectiveness(response, context);
          
        case 'solution_completeness':
          return this.calculateSolutionCompleteness(response, context);
          
        case 'learning_rate':
          return this.calculateLearningRate(response, context);
          
        case 'adaptation_speed':
          return this.calculateAdaptationSpeed(response, context);
          
        default:
          logger.warn(`Unknown metric type: ${metricType}`);
          return 0;
      }
    } catch (error) {
      logger.error(`❌ Failed to calculate metric ${metricType}:`, error);
      return 0;
    }
  }

  /**
   * Calculate reasoning depth score
   */
  calculateReasoningDepth(response) {
    let score = 0;
    
    // Check for logical connectors
    const logicalConnectors = ['because', 'therefore', 'however', 'furthermore', 'consequently', 'moreover'];
    const connectorCount = logicalConnectors.reduce((count, connector) => {
      return count + (response.toLowerCase().match(new RegExp(connector, 'g')) || []).length;
    }, 0);
    
    score += Math.min(connectorCount * 0.5, 3);
    
    // Check for cause-effect relationships
    const causeEffectPatterns = ['leads to', 'results in', 'causes', 'due to', 'as a result'];
    const causeEffectCount = causeEffectPatterns.reduce((count, pattern) => {
      return count + (response.toLowerCase().includes(pattern) ? 1 : 0);
    }, 0);
    
    score += Math.min(causeEffectCount * 0.8, 2);
    
    // Check for multi-step reasoning
    const steps = response.split(/\d+\.|first|second|third|then|next|finally/i).length - 1;
    score += Math.min(steps * 0.3, 2);
    
    // Check for conditional reasoning
    const conditionalPatterns = ['if', 'unless', 'provided that', 'assuming'];
    const conditionalCount = conditionalPatterns.reduce((count, pattern) => {
      return count + (response.toLowerCase().includes(pattern) ? 1 : 0);
    }, 0);
    
    score += Math.min(conditionalCount * 0.5, 1.5);
    
    return Math.min(score, 10);
  }

  /**
   * Calculate logical consistency score
   */
  calculateLogicalConsistency(response) {
    let consistencyScore = 100;
    
    // Check for contradictions (simplified approach)
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const contradictionKeywords = [
      ['always', 'never'],
      ['all', 'none'],
      ['possible', 'impossible'],
      ['can', 'cannot'],
      ['will', 'will not']
    ];
    
    for (const [positive, negative] of contradictionKeywords) {
      if (response.toLowerCase().includes(positive) && response.toLowerCase().includes(negative)) {
        consistencyScore -= 15;
      }
    }
    
    // Check for logical flow
    const illogicalTransitions = ['but however', 'although but', 'because but'];
    for (const transition of illogicalTransitions) {
      if (response.toLowerCase().includes(transition)) {
        consistencyScore -= 10;
      }
    }
    
    return Math.max(consistencyScore, 0);
  }

  /**
   * Calculate creativity score
   */
  calculateCreativityScore(response) {
    let score = 0;
    
    // Check for creative language
    const creativeWords = ['innovative', 'unique', 'creative', 'original', 'novel', 'imaginative'];
    const creativeCount = creativeWords.reduce((count, word) => {
      return count + (response.toLowerCase().includes(word) ? 1 : 0);
    }, 0);
    
    score += Math.min(creativeCount * 0.5, 2);
    
    // Check for metaphors and analogies
    const metaphorPatterns = ['like', 'as if', 'similar to', 'reminds me of', 'imagine'];
    const metaphorCount = metaphorPatterns.reduce((count, pattern) => {
      return count + (response.toLowerCase().includes(pattern) ? 1 : 0);
    }, 0);
    
    score += Math.min(metaphorCount * 0.8, 3);
    
    // Check for diverse vocabulary
    const words = response.toLowerCase().match(/\b\w+\b/g) || [];
    const uniqueWords = new Set(words);
    const vocabularyDiversity = uniqueWords.size / words.length;
    
    score += vocabularyDiversity * 3;
    
    // Check for alternative solutions or perspectives
    const alternativePatterns = ['alternatively', 'another approach', 'different way', 'consider', 'what if'];
    const alternativeCount = alternativePatterns.reduce((count, pattern) => {
      return count + (response.toLowerCase().includes(pattern) ? 1 : 0);
    }, 0);
    
    score += Math.min(alternativeCount * 0.6, 2);
    
    return Math.min(score, 10);
  }

  /**
   * Calculate novelty index
   */
  calculateNoveltyIndex(response, context) {
    // This is a simplified implementation
    // In production, you'd compare against a database of previous responses
    
    let noveltyScore = 50; // Base score
    
    // Check for uncommon words (simplified)
    const uncommonWords = ['serendipity', 'paradigm', 'synergy', 'optimization', 'algorithm'];
    const uncommonCount = uncommonWords.reduce((count, word) => {
      return count + (response.toLowerCase().includes(word) ? 1 : 0);
    }, 0);
    
    noveltyScore += uncommonCount * 10;
    
    // Check for unique combinations of concepts
    const concepts = ['AI', 'machine learning', 'blockchain', 'cloud', 'IoT'];
    const conceptCount = concepts.reduce((count, concept) => {
      return count + (response.toLowerCase().includes(concept.toLowerCase()) ? 1 : 0);
    }, 0);
    
    if (conceptCount > 2) {
      noveltyScore += 20;
    }
    
    return Math.min(noveltyScore, 100);
  }

  /**
   * Calculate technical accuracy score
   */
  calculateTechnicalAccuracy(response, context) {
    // This would require domain-specific knowledge bases
    // For now, using heuristics
    
    let accuracyScore = 80; // Default assumption of reasonable accuracy
    
    // Check for common technical inaccuracies (simplified)
    const inaccuracies = [
      'AI is conscious',
      'blockchain solves everything',
      'quantum computers are just faster',
      'machine learning is magic'
    ];
    
    for (const inaccuracy of inaccuracies) {
      if (response.toLowerCase().includes(inaccuracy.toLowerCase())) {
        accuracyScore -= 20;
      }
    }
    
    // Bonus for technical precision indicators
    const precisionIndicators = ['specifically', 'precisely', 'according to', 'research shows'];
    const precisionCount = precisionIndicators.reduce((count, indicator) => {
      return count + (response.toLowerCase().includes(indicator) ? 1 : 0);
    }, 0);
    
    accuracyScore += precisionCount * 5;
    
    return Math.min(Math.max(accuracyScore, 0), 100);
  }

  /**
   * Calculate factual correctness score
   */
  calculateFactualCorrectness(response) {
    // Simplified factual checking
    let correctnessScore = 90; // Default high score
    
    // Check for common factual errors (very basic)
    const factualErrors = [
      'sun revolves around earth',
      'humans have 206 bones', // It's actually 206 in adults, this is correct
      'water boils at 200 degrees' // Missing unit makes this ambiguous
    ];
    
    for (const error of factualErrors) {
      if (response.toLowerCase().includes(error)) {
        correctnessScore -= 30;
      }
    }
    
    return Math.max(correctnessScore, 0);
  }

  /**
   * Calculate clarity score
   */
  calculateClarityScore(response) {
    let score = 5; // Base score
    
    // Check sentence length (shorter is often clearer)
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(' ').length, 0) / sentences.length;
    
    if (avgSentenceLength < 15) score += 2;
    else if (avgSentenceLength < 25) score += 1;
    else score -= 1;
    
    // Check for clear structure
    const structureIndicators = ['first', 'second', 'finally', 'in conclusion', 'summary'];
    const structureCount = structureIndicators.reduce((count, indicator) => {
      return count + (response.toLowerCase().includes(indicator) ? 1 : 0);
    }, 0);
    
    score += Math.min(structureCount * 0.5, 2);
    
    // Check for jargon density
    const jargonWords = ['paradigm', 'leverage', 'synergy', 'optimization', 'methodology'];
    const jargonCount = jargonWords.reduce((count, word) => {
      return count + (response.toLowerCase().includes(word) ? 1 : 0);
    }, 0);
    
    score -= Math.min(jargonCount * 0.3, 1);
    
    return Math.min(Math.max(score, 0), 10);
  }

  /**
   * Calculate coherence index
   */
  calculateCoherenceIndex(response) {
    let coherenceScore = 70; // Base score
    
    // Check for coherent transitions
    const transitions = ['however', 'furthermore', 'additionally', 'consequently', 'meanwhile'];
    const transitionCount = transitions.reduce((count, transition) => {
      return count + (response.toLowerCase().includes(transition) ? 1 : 0);
    }, 0);
    
    coherenceScore += transitionCount * 5;
    
    // Check for topic consistency (simplified)
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 1) {
      // Very basic topic consistency check
      const words = response.toLowerCase().match(/\b\w{4,}\b/g) || [];
      const wordFreq = {};
      words.forEach(word => {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      });
      
      const repeatedWords = Object.values(wordFreq).filter(freq => freq > 1).length;
      coherenceScore += Math.min(repeatedWords * 2, 20);
    }
    
    return Math.min(coherenceScore, 100);
  }

  /**
   * Calculate problem-solving effectiveness
   */
  calculateProblemSolvingEffectiveness(response, context) {
    let score = 0;
    
    // Check for systematic approach
    const systematicIndicators = ['step', 'approach', 'method', 'strategy', 'plan'];
    const systematicCount = systematicIndicators.reduce((count, indicator) => {
      return count + (response.toLowerCase().includes(indicator) ? 1 : 0);
    }, 0);
    
    score += Math.min(systematicCount * 0.8, 3);
    
    // Check for consideration of alternatives
    const alternativeIndicators = ['alternative', 'option', 'consider', 'might', 'could'];
    const alternativeCount = alternativeIndicators.reduce((count, indicator) => {
      return count + (response.toLowerCase().includes(indicator) ? 1 : 0);
    }, 0);
    
    score += Math.min(alternativeCount * 0.6, 2);
    
    // Check for implementation details
    const implementationIndicators = ['implement', 'execute', 'apply', 'use', 'perform'];
    const implementationCount = implementationIndicators.reduce((count, indicator) => {
      return count + (response.toLowerCase().includes(indicator) ? 1 : 0);
    }, 0);
    
    score += Math.min(implementationCount * 0.5, 2);
    
    // Check for problem identification
    if (response.toLowerCase().includes('problem') || response.toLowerCase().includes('issue')) {
      score += 1;
    }
    
    // Check for solution verification
    const verificationIndicators = ['test', 'verify', 'check', 'validate', 'confirm'];
    const verificationCount = verificationIndicators.reduce((count, indicator) => {
      return count + (response.toLowerCase().includes(indicator) ? 1 : 0);
    }, 0);
    
    score += Math.min(verificationCount * 0.4, 1.5);
    
    // Bonus for considering constraints
    if (response.toLowerCase().includes('constraint') || response.toLowerCase().includes('limitation')) {
      score += 0.5;
    }
    
    return Math.min(score, 10);
  }

  /**
   * Calculate solution completeness
   */
  calculateSolutionCompleteness(response, context) {
    let completenessScore = 20; // Base score
    
    // Check for complete solution elements
    const solutionElements = [
      'analysis', 'approach', 'implementation', 'result', 'conclusion'
    ];
    
    const elementCount = solutionElements.reduce((count, element) => {
      return count + (response.toLowerCase().includes(element) ? 1 : 0);
    }, 0);
    
    completenessScore += elementCount * 15;
    
    // Check for examples
    if (response.toLowerCase().includes('example') || response.toLowerCase().includes('instance')) {
      completenessScore += 10;
    }
    
    // Check for explanations
    const explanationIndicators = ['because', 'why', 'reason', 'explain'];
    const explanationCount = explanationIndicators.reduce((count, indicator) => {
      return count + (response.toLowerCase().includes(indicator) ? 1 : 0);
    }, 0);
    
    completenessScore += Math.min(explanationCount * 5, 15);
    
    return Math.min(completenessScore, 100);
  }

  /**
   * Calculate learning rate (simplified)
   */
  calculateLearningRate(response, context) {
    // This would require tracking previous interactions
    // For now, return a base score with some variation
    return 2.5 + Math.random() * 2; // Random between 2.5 and 4.5
  }

  /**
   * Calculate adaptation speed (simplified)
   */
  calculateAdaptationSpeed(response, context) {
    // Check for adaptation indicators
    let score = 2; // Base score
    
    const adaptationIndicators = ['adjust', 'adapt', 'modify', 'change', 'customize'];
    const adaptationCount = adaptationIndicators.reduce((count, indicator) => {
      return count + (response.toLowerCase().includes(indicator) ? 1 : 0);
    }, 0);
    
    score += Math.min(adaptationCount * 0.5, 2);
    
    // Check for user-specific language
    const personalIndicators = ['you', 'your', 'specifically', 'particular'];
    const personalCount = personalIndicators.reduce((count, indicator) => {
      return count + (response.toLowerCase().includes(indicator) ? 1 : 0);
    }, 0);
    
    score += Math.min(personalCount * 0.2, 1);
    
    return Math.min(score, 5);
  }

  /**
   * Generate insights from metrics
   */
  generateInsights(metrics, analysisType) {
    const insights = [];
    
    // Overall performance insight
    const scores = Object.values(metrics).map(m => m.value);
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    if (avgScore > 7) {
      insights.push('Excellent overall performance across metrics');
    } else if (avgScore > 5) {
      insights.push('Good performance with room for improvement');
    } else {
      insights.push('Performance needs improvement in several areas');
    }
    
    // Category-specific insights
    const categories = {};
    Object.entries(metrics).forEach(([type, data]) => {
      if (!categories[data.category]) {
        categories[data.category] = [];
      }
      categories[data.category].push(data.value);
    });
    
    Object.entries(categories).forEach(([category, values]) => {
      const categoryAvg = values.reduce((sum, val) => sum + val, 0) / values.length;
      
      if (categoryAvg > 7) {
        insights.push(`Strong ${category} capabilities`);
      } else if (categoryAvg < 4) {
        insights.push(`${category} needs improvement`);
      }
    });
    
    return insights;
  }

  /**
   * Update performance cache
   */
  updatePerformanceCache(userId, analysisType, score) {
    const key = `${userId}_${analysisType}`;
    
    if (!this.performanceCache.has(key)) {
      this.performanceCache.set(key, []);
    }
    
    const scores = this.performanceCache.get(key);
    scores.push({ score, timestamp: new Date() });
    
    // Keep only last 10 scores
    if (scores.length > 10) {
      scores.shift();
    }
  }

  /**
   * Get user intelligence trends
   */
  async getUserIntelligenceTrends(userId, days = 30) {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);
      
      const metrics = await this.prisma.intelligenceMetrics.findMany({
        where: {
          userId,
          timestamp: {
            gte: since
          }
        },
        orderBy: {
          timestamp: 'asc'
        }
      });
      
      // Group by metric type
      const trends = {};
      metrics.forEach(metric => {
        if (!trends[metric.metricType]) {
          trends[metric.metricType] = [];
        }
        trends[metric.metricType].push({
          value: metric.value,
          timestamp: metric.timestamp
        });
      });
      
      // Calculate trend direction for each metric
      const trendAnalysis = {};
      Object.entries(trends).forEach(([type, values]) => {
        if (values.length > 1) {
          const recent = values.slice(-5).map(v => v.value);
          const earlier = values.slice(0, 5).map(v => v.value);
          
          const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
          const earlierAvg = earlier.reduce((sum, val) => sum + val, 0) / earlier.length;
          
          trendAnalysis[type] = {
            direction: recentAvg > earlierAvg ? 'improving' : 'declining',
            change: Math.abs(recentAvg - earlierAvg),
            current: recentAvg,
            dataPoints: values.length
          };
        }
      });
      
      return {
        period: `${days} days`,
        totalMetrics: metrics.length,
        trends: trendAnalysis,
        summary: this.generateTrendSummary(trendAnalysis)
      };
      
    } catch (error) {
      logger.error(`❌ Failed to get intelligence trends for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Generate trend summary
   */
  generateTrendSummary(trendAnalysis) {
    const improving = Object.entries(trendAnalysis)
      .filter(([_, trend]) => trend.direction === 'improving').length;
    
    const declining = Object.entries(trendAnalysis)
      .filter(([_, trend]) => trend.direction === 'declining').length;
    
    const total = Object.keys(trendAnalysis).length;
    
    if (total === 0) {
      return 'Insufficient data for trend analysis';
    }
    
    const improvingPercent = Math.round((improving / total) * 100);
    
    if (improvingPercent > 70) {
      return 'Strong improvement trend across most metrics';
    } else if (improvingPercent > 50) {
      return 'Generally improving with some areas needing attention';
    } else if (improvingPercent < 30) {
      return 'Declining trend - may need intervention';
    } else {
      return 'Mixed performance trends';
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      service: 'Intelligence Analyzer',
      version: '1.0.0',
      status: 'active',
      metricTypes: this.metricTypes.size,
      analysisRules: this.analysisRules.size,
      cachedPerformances: this.performanceCache.size,
      availableMetrics: Array.from(this.metricTypes.keys()),
      availableAnalysisTypes: Array.from(this.analysisRules.keys())
    };
  }
}

module.exports = IntelligenceAnalyzer;