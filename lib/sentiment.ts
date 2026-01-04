import { logApiUsage } from './usage-logger';
import { createServerClient, createAdminClient } from './supabase';
import { SentimentAnalysis } from '../types';
import crypto from 'crypto';

interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  keywords: string[];
}

export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  try {
    // Use AI service for sentiment analysis
    const result = await callAIService(text);
    
    // Log API usage
    await logApiUsage('gemini', 1000, 0.01, 'sentiment-analysis', {
      text_length: text.length
    });

    return result;
  } catch (error) {
    console.error('Sentiment analysis failed:', error);
    
    // Fallback to rule-based sentiment analysis
    return fallbackSentimentAnalysis(text);
  }
}

async function callAIService(text: string): Promise<SentimentResult> {
  const prompt = `
Analyze the sentiment of the following feedback text and extract key sentiment keywords.

Text: "${text}"

Please provide:
1. Sentiment: positive, neutral, or negative
2. Confidence score: 0-1 (higher = more confident)
3. Keywords that indicate sentiment

Respond in JSON format:
{
  "sentiment": "positive|neutral|negative",
  "confidence": 0.0-1.0,
  "keywords": ["keyword1", "keyword2"]
}`;

  // This would call your AI service (Gemini/DeepSeek)
  const response = await fetch(`${process.env.AI_SERVICE_URL}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.AI_SERVICE_KEY}`
    },
    body: JSON.stringify({
      prompt,
      max_tokens: 200,
      temperature: 0.1
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
      sentiment: parsed.sentiment,
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : []
    };
  } catch (parseError) {
    throw new Error('Failed to parse AI response');
  }
}

function fallbackSentimentAnalysis(text: string): SentimentResult {
  const positiveWords = [
    'love', 'great', 'amazing', 'excellent', 'fantastic', 'wonderful', 'awesome',
    'perfect', 'brilliant', 'outstanding', 'impressive', 'beautiful', 'nice',
    'good', 'best', 'cool', 'excited', 'happy', 'pleased', 'satisfied'
  ];

  const negativeWords = [
    'hate', 'terrible', 'awful', 'horrible', 'disgusting', 'worst', 'bad',
    'stupid', 'annoying', 'frustrating', 'confusing', 'difficult', 'slow',
    'broken', 'useless', 'disappointing', 'ridiculous', 'unacceptable'
  ];

  const words = text.toLowerCase().split(/\s+/);
  let positiveScore = 0;
  let negativeScore = 0;
  const keywords: string[] = [];

  words.forEach(word => {
    if (positiveWords.includes(word)) {
      positiveScore++;
      if (!keywords.includes(word)) keywords.push(word);
    }
    if (negativeWords.includes(word)) {
      negativeScore++;
      if (!keywords.includes(word)) keywords.push(word);
    }
  });

  let sentiment: 'positive' | 'neutral' | 'negative';
  let confidence: number;

  if (positiveScore > negativeScore) {
    sentiment = 'positive';
    confidence = Math.min(0.9, 0.3 + (positiveScore * 0.15));
  } else if (negativeScore > positiveScore) {
    sentiment = 'negative';
    confidence = Math.min(0.9, 0.3 + (negativeScore * 0.15));
  } else {
    sentiment = 'neutral';
    confidence = Math.max(0.1, 1 - (Math.abs(positiveScore - negativeScore) * 0.1));
  }

  return { sentiment, confidence, keywords };
}

export async function batchAnalyzeSentiment(feedbackIds: string[]): Promise<SentimentAnalysis[]> {
  const supabase = createServerClient();

  // Get feedback items
  const { data: feedbackItems, error } = await supabase
    .from('feedback_items')
    .select('id, text')
    .in('id', feedbackIds)
    .is('deleted_at', null);

  if (error) throw error;

  const results: SentimentAnalysis[] = [];

  // Process in batches to avoid overwhelming the AI service
  const batchSize = 10;
  for (let i = 0; i < feedbackItems.length; i += batchSize) {
    const batch = feedbackItems.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (item) => {
      try {
        const sentimentResult = await analyzeSentiment(item.text);
        
        return {
          id: crypto.randomUUID(),
          feedback_id: item.id,
          sentiment: sentimentResult.sentiment,
          confidence: sentimentResult.confidence,
          keywords: sentimentResult.keywords,
          created_at: new Date().toISOString()
        };
      } catch (error) {
        console.error(`Failed to analyze sentiment for feedback ${item.id}:`, error);
        
        // Return neutral sentiment with low confidence
        return {
          id: crypto.randomUUID(),
          feedback_id: item.id,
          sentiment: 'neutral' as const,
          confidence: 0.1,
          keywords: [],
          created_at: new Date().toISOString()
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

export async function updateFeedbackSentiment(feedbackId: string, sentiment: SentimentAnalysis['sentiment']) {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('feedback_items')
    .update({ sentiment })
    .eq('id', feedbackId);

  if (error) throw error;

  return true;
}

export async function getSentimentStats(projectId: string) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('feedback_items')
    .select('sentiment')
    .eq('project_id', projectId)
    .eq('deleted_at', null)
    .not('sentiment', 'is', null);

  if (error) throw error;

  const stats = {
    positive: 0,
    neutral: 0,
    negative: 0,
    total: data?.length || 0
  };

  data?.forEach(item => {
    if (item.sentiment) {
      stats[item.sentiment as keyof typeof stats]++;
    }
  });

  return stats;
}

export async function analyzeFeedbackOnCreation(feedbackId: string) {
  const supabase = createServerClient();

  // Get the feedback text
  const { data: feedback, error } = await supabase
    .from('feedback_items')
    .select('text, project_id')
    .eq('id', feedbackId)
    .single();

  if (error) throw error;

  try {
    // Analyze sentiment
    const sentimentResult = await analyzeSentiment(feedback.text);
    
    // Update feedback with sentiment
    await supabase
      .from('feedback_items')
      .update({ sentiment: sentimentResult.sentiment })
      .eq('id', feedbackId);

    // Store detailed analysis
    const { error: analysisError } = await supabase
      .from('feedback_sentiment_analysis') // This table should be created via migration
      .insert({
        feedback_id: feedbackId,
        sentiment: sentimentResult.sentiment,
        confidence: sentimentResult.confidence,
        keywords: sentimentResult.keywords
      });

    if (analysisError) {
      console.error('Failed to store sentiment analysis:', analysisError);
    }

    return sentimentResult;
  } catch (error) {
    console.error('Auto sentiment analysis failed:', error);
    return null;
  }
}

// Export sentiment analysis results
export async function exportSentimentAnalysis(projectId: string) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('feedback_items')
    .select(`
      id,
      text,
      sentiment,
      created_at,
      vote_count,
      comment_count
    `)
    .eq('project_id', projectId)
    .eq('deleted_at', null)
    .not('sentiment', 'is', null)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data?.map(item => ({
    ...item,
    sentiment_score: getSentimentScore(item.sentiment)
  })) || [];
}

function getSentimentScore(sentiment: string): number {
  switch (sentiment) {
    case 'positive': return 1;
    case 'neutral': return 0;
    case 'negative': return -1;
    default: return 0;
  }
}