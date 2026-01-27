import { env } from './env';
import { logApiUsage } from './usage-logger';
import { createServerClient, createAdminClient } from './supabase';
import { TopicAuto } from '../types';
import crypto from 'crypto';

interface CategorizationResult {
  topic_name: string;
  confidence: number;
  keywords: string[];
}

export async function categorizeFeedback(text: string, projectContext: string): Promise<CategorizationResult> {
  try {
    // Use AI service for auto-categorization
    const result = await callAICategorization(text, projectContext);
    
    // Log API usage
    await logApiUsage({
      userId: null,
      projectId: null,
      service: 'gemini',
      tokensOrCredits: 1000,
      endpoint: 'auto-categorization',
      metadata: { text_length: text.length }
    });

    return result;
  } catch (error) {
    console.error('Auto-categorization failed:', error);
    
    // Fallback to rule-based categorization
    return fallbackCategorization(text);
  }
}

async function callAICategorization(text: string, projectContext: string): Promise<CategorizationResult> {
  const prompt = `
Analyze the following feedback and suggest an appropriate topic/category for it.

Project Context: ${projectContext}
Feedback Text: "${text}"

Please suggest a relevant topic name (1-3 words) that would best categorize this feedback.
Consider common product feedback categories like: features, bugs, usability, performance, 
design, pricing, documentation, support, integration, mobile, etc.

Respond in JSON format:
{
  "topic_name": "category_name",
  "confidence": 0.0-1.0,
  "keywords": ["keyword1", "keyword2", "keyword3"]
}`;

  if (!env.AI_SERVICE_URL || !env.AI_SERVICE_KEY) {
    throw new Error('AI service not configured');
  }

  // This would call your AI service (Gemini/DeepSeek)
  const response = await fetch(`${env.AI_SERVICE_URL}/categorize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.AI_SERVICE_KEY}`
    },
    body: JSON.stringify({
      prompt,
      max_tokens: 150,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    throw new Error(`AI service error: ${response.status}`);
  }

  const data = await response.json();
  
  // Parse the AI response
  try {
    const parsed = JSON.parse(data.text);
    return {
      topic_name: parsed.topic_name || 'general',
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : []
    };
  } catch (parseError) {
    throw new Error('Failed to parse AI response');
  }
}

function fallbackCategorization(text: string): CategorizationResult {
  const textLower = text.toLowerCase();
  
  // Define keyword patterns for different categories
  const categories = {
    'bug': {
      keywords: ['bug', 'error', 'broken', 'crash', 'fail', 'issue', 'problem', 'wrong', 'not working'],
      weight: 1
    },
    'feature': {
      keywords: ['feature', 'add', 'implement', 'would like', 'wish', 'request', 'suggestion', 'enhancement'],
      weight: 1
    },
    'usability': {
      keywords: ['confusing', 'difficult', 'hard', 'complicated', 'user-friendly', 'interface', 'ux', 'ui'],
      weight: 1
    },
    'performance': {
      keywords: ['slow', 'fast', 'performance', 'loading', 'speed', 'lag', 'optimization'],
      weight: 1
    },
    'design': {
      keywords: ['design', 'look', 'appearance', 'visual', 'color', 'layout', 'style', 'theme'],
      weight: 1
    },
    'pricing': {
      keywords: ['price', 'cost', 'expensive', 'cheap', 'billing', 'payment', 'subscription', 'money'],
      weight: 1
    },
    'support': {
      keywords: ['help', 'support', 'documentation', 'tutorial', 'guide', 'how to', 'contact'],
      weight: 1
    },
    'integration': {
      keywords: ['integration', 'api', 'connect', 'sync', 'import', 'export', 'third-party'],
      weight: 1
    },
    'mobile': {
      keywords: ['mobile', 'phone', 'app', 'responsive', 'touch', 'screen size'],
      weight: 1
    }
  };

  let bestMatch = 'general';
  let bestScore = 0;
  const matchedKeywords: string[] = [];

  Object.entries(categories).forEach(([category, config]) => {
    let score = 0;
    const categoryKeywords: string[] = [];

    config.keywords.forEach(keyword => {
      if (textLower.includes(keyword)) {
        score += config.weight;
        categoryKeywords.push(keyword);
      }
    });

    if (score > bestScore) {
      bestScore = score;
      bestMatch = category;
      matchedKeywords.push(...categoryKeywords);
    }
  });

  // If no clear match, return general with low confidence
  if (bestScore === 0) {
    return {
      topic_name: 'general',
      confidence: 0.1,
      keywords: []
    };
  }

  return {
    topic_name: bestMatch,
    confidence: Math.min(0.8, 0.3 + (bestScore * 0.1)),
    keywords: [...new Set(matchedKeywords)]
  };
}

export async function autoCategorizeFeedback(feedbackIds: string[], projectId: string): Promise<TopicAuto[]> {
  const supabase = createServerClient();

  // Get feedback items
  const { data: feedbackItems, error } = await supabase
    .from('feedback_items')
    .select('id, text')
    .in('id', feedbackIds)
    .eq('project_id', projectId)
    .is('deleted_at', null);

  if (error) throw error;

  const results: TopicAuto[] = [];

  // Process in batches to avoid overwhelming the AI service
  const batchSize = 5;
  for (let i = 0; i < feedbackItems.length; i += batchSize) {
    const batch = feedbackItems.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (item) => {
      try {
        // Get project context
        const { data: project } = await supabase
          .from('projects')
          .select('name, description')
          .eq('id', projectId)
          .single();

        const projectContext = project ? `${project.name}: ${project.description || 'Product feedback collection'}` : 'Product feedback';
        
        const categorizationResult = await categorizeFeedback(item.text, projectContext);
        
        // Create or find topic
        const { data: existingTopic } = await supabase
          .from('topics')
          .select('id')
          .eq('project_id', projectId)
          .ilike('name', categorizationResult.topic_name)
          .single();

        let topicId;
        if (existingTopic) {
          topicId = existingTopic.id;
        } else {
          const { data: newTopic } = await supabase
            .from('topics')
            .insert({
              project_id: projectId,
              name: categorizationResult.topic_name
            })
            .select('id')
            .single();
          topicId = newTopic?.id;
        }

        // Link feedback to topic
        if (topicId) {
          await supabase
            .from('feedback_topics')
            .upsert({
              feedback_id: item.id,
              topic_id: topicId,
              confidence: categorizationResult.confidence
            });
        }

        return {
          id: crypto.randomUUID(),
          project_id: projectId,
          feedback_id: item.id,
          topic_name: categorizationResult.topic_name,
          confidence: categorizationResult.confidence,
          created_at: new Date().toISOString()
        };
      } catch (error) {
        console.error(`Failed to categorize feedback ${item.id}:`, error);
        
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter(Boolean) as TopicAuto[]);
  }

  return results;
}

export async function getAutoCategorizationStats(projectId: string) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('feedback_topics')
    .select(`
      confidence,
      topic:topics(name)
    `)
    .eq('feedback_id', `(
      SELECT id FROM feedback_items 
      WHERE project_id = ${projectId} 
      AND deleted_at IS NULL
    )`);

  if (error) throw error;

  const stats = {
    total_categorized: data?.length || 0,
    average_confidence: 0,
    topic_distribution: {} as Record<string, number>
  };

  if (data && data.length > 0) {
    let totalConfidence = 0;
    
    data.forEach(item => {
      totalConfidence += item.confidence;
      
      const topicName = item.topic?.name || 'unknown';
      stats.topic_distribution[topicName] = (stats.topic_distribution[topicName] || 0) + 1;
    });

    stats.average_confidence = totalConfidence / data.length;
  }

  return stats;
}

export async function analyzeFeedbackOnCreation(feedbackId: string) {
  const supabase = createServerClient();

  // Get the feedback text and project
  const { data: feedback, error } = await supabase
    .from('feedback_items')
    .select('text, project_id')
    .eq('id', feedbackId)
    .single();

  if (error) throw error;

  try {
    // Auto-categorize the feedback
    const result = await autoCategorizeFeedback([feedbackId], feedback.project_id);
    
    return result[0] || null;
  } catch (error) {
    console.error('Auto categorization failed:', error);
    return null;
  }
}

export async function getCategorizationSuggestions(projectId: string, partialQuery: string) {
  const supabase = createServerClient();

  if (!partialQuery || partialQuery.length < 2) {
    return [];
  }

  // Get existing topics for suggestions
  const { data: topics, error } = await supabase
    .from('topics')
    .select('name')
    .eq('project_id', projectId)
    .ilike('name', `%${partialQuery}%`)
    .limit(5);

  if (error) throw error;

  return topics?.map(t => t.name) || [];
}

export async function retrainCategorizationModel(projectId: string) {
  // This would be used to improve the AI model based on user corrections
  // For now, this is a placeholder for future implementation
  
  const supabase = createServerClient();

  // Get feedback with manual topic assignments (high confidence human input)
  const { data: feedback, error } = await supabase
    .from('feedback_items')
    .select(`
      text,
      feedback_topics!inner(
        confidence,
        topic:topics(name)
      )
    `)
    .eq('project_id', projectId)
    .eq('deleted_at', null)
    .lte('feedback_topics.confidence', 0.3); // Low confidence AI suggestions

  if (error) throw error;

  // In a real implementation, this would retrain the model
  // For now, we just return the training data
  return {
    training_data_count: feedback?.length || 0,
    message: 'Model retraining placeholder - would implement with actual ML pipeline'
  };
}
