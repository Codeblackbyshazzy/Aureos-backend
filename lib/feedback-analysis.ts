import { createAdminClient } from './supabase';
import { z } from 'zod';

// Zod schemas for AI response validation (without UUIDs, we'll generate those)
const ClusterSchema = z.object({
  title: z.string().min(1).max(200),
  count: z.number().int().positive(),
  summary: z.string().min(1).max(500),
  sentiment: z.enum(['Very Negative', 'Negative', 'Neutral', 'Positive', 'Mixed']),
  keyQuotes: z.array(z.string().min(1)).min(1).max(3),
  priorityScore: z.number().int().min(1).max(10),
  effortEstimate: z.enum(['Low', 'Medium', 'High'])
});

const RoadmapItemSchema = z.object({
  title: z.string().min(1).max(200),
  clusterTitles: z.array(z.string()), // Use cluster titles instead of UUIDs
  expectedImpact: z.string().min(1).max(500),
  risks: z.string().min(1).max(500),
  suggestedQuarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4'])
});

const AIAnalysisResponseSchema = z.object({
  clusters: z.array(ClusterSchema).min(1).max(12),
  topRoadmapItems: z.array(RoadmapItemSchema).min(1).max(5)
});

export type AIAnalysisResponse = z.infer<typeof AIAnalysisResponseSchema>;
export type Cluster = z.infer<typeof ClusterSchema>;
export type RoadmapItem = z.infer<typeof RoadmapItemSchema>;

// Internal data structures with UUIDs
export interface ClusterWithId extends Cluster {
  id: string;
}

export interface RoadmapItemWithId extends RoadmapItem {
  id: string;
  clusterIds: string[];
}

// AI service interface
interface AIService {
  analyzeFeedback(feedbackItems: Array<{ id: string; text: string }>, context: {
    productName: string;
    productDescription: string;
    targetUsers: string;
  }): Promise<{ response: string; provider: string }>;
}

// Gemini AI service implementation
class GeminiAIService implements AIService {
  async analyzeFeedback(feedbackItems: Array<{ id: string; text: string }>, context: {
    productName: string;
    productDescription: string;
    targetUsers: string;
  }): Promise<{ response: string; provider: string }> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = this.buildAnalysisPrompt(feedbackItems, context);

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    return {
      response: text,
      provider: 'gemini'
    };
  }

  private buildAnalysisPrompt(feedbackItems: Array<{ id: string; text: string }>, context: {
    productName: string;
    productDescription: string;
    targetUsers: string;
  }): string {
    const feedbackText = feedbackItems.map((item, index) => `${index + 1}. ${item.text}`).join('\n');

    return `You are an elite Senior Product Manager analyzing user feedback for a SaaS product.

Product: ${context.productName}
Description: ${context.productDescription}
Target Users: ${context.targetUsers}

Raw feedback comments (numbered for reference):
${feedbackText}

Task:
1. Identify and group near-duplicate/very similar ideas (merge mentally, note combined count).
2. Cluster all feedback into 6–12 logical, mutually exclusive themes.
3. For EACH cluster, provide: title, count, one-sentence summary, sentiment (Very Negative/Negative/Neutral/Positive/Mixed), 2–3 key quotes, priority score (1–10 based on frequency + pain severity + business impact), effort estimate (Low/Medium/High).
4. Identify the top 5 roadmap items: feature/epic name, which clusters it addresses (use cluster titles), expected impact, risks, suggested quarter.

Output ONLY valid JSON with this structure:
{
  "clusters": [{"title": "...", "count": N, "summary": "...", "sentiment": "...", "keyQuotes": [...], "priorityScore": N, "effortEstimate": "..."}],
  "topRoadmapItems": [{"title": "...", "clusterTitles": [...], "expectedImpact": "...", "risks": "...", "suggestedQuarter": "..."}]
}`;
  }
}

// DeepSeek AI service implementation
class DeepSeekAIService implements AIService {
  async analyzeFeedback(feedbackItems: Array<{ id: string; text: string }>, context: {
    productName: string;
    productDescription: string;
    targetUsers: string;
  }): Promise<{ response: string; provider: string }> {
    // For now, return a mock response since DeepSeek integration isn't implemented
    // In a real implementation, this would call the DeepSeek API
    throw new Error('DeepSeek AI service not yet implemented');
  }
}

// Factory for AI service selection
function createAIService(): AIService {
  const provider = (process.env.FEEDBACK_ANALYSIS_AI_PROVIDER || 'gemini').toLowerCase();
  
  switch (provider) {
    case 'deepseek':
      return new DeepSeekAIService();
    case 'gemini':
    default:
      return new GeminiAIService();
  }
}

// Main analysis function
export async function analyzeFeedback(projectId: string, userId: string) {
  const adminClient = createAdminClient();

  try {
    // 1. Fetch feedback from database
    const { data: feedbackItems, error: feedbackError } = await adminClient
      .from('feedback_items')
      .select('id, text')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (feedbackError) {
      throw new Error('Failed to fetch feedback items');
    }

    if (!feedbackItems || feedbackItems.length < 3) {
      throw new Error('Not enough feedback to analyze. Need at least 3 feedback items.');
    }

    // 2. Deduplicate feedback (basic string similarity)
    const deduplicatedFeedback = deduplicateFeedback(feedbackItems);

    if (deduplicatedFeedback.length < 3) {
      throw new Error('Not enough unique feedback to analyze. Need at least 3 unique feedback items.');
    }

    // 3. Get project context for AI prompt
    const { data: project } = await adminClient
      .from('projects')
      .select('name, description')
      .eq('id', projectId)
      .single();

    if (!project) {
      throw new Error('Project not found');
    }

    // 4. Call AI service
    const aiService = createAIService();
    const aiResult = await aiService.analyzeFeedback(deduplicatedFeedback, {
      productName: project.name || 'Unknown Product',
      productDescription: project.description || 'No description available',
      targetUsers: 'General users' // This could be enhanced to use actual user research data
    });

    // 5. Parse and validate AI response
    const aiResponse = parseAIResponse(aiResult.response);

    // 6. Generate UUIDs and create enhanced data
    const clustersWithIds: ClusterWithId[] = aiResponse.clusters.map(cluster => ({
      ...cluster,
      id: crypto.randomUUID()
    }));

    const roadmapItemsWithIds: RoadmapItemWithId[] = aiResponse.topRoadmapItems.map(item => ({
      ...item,
      id: crypto.randomUUID(),
      clusterIds: [] // Will be populated after clusters are saved
    }));

    // 7. Create analysis record
    const { data: analysis, error: analysisError } = await adminClient
      .from('feedback_analyses')
      .insert({
        project_id: projectId,
        user_id: userId,
        ai_provider: aiResult.provider,
        feedback_count: deduplicatedFeedback.length,
        cluster_count: clustersWithIds.length,
        status: 'completed'
      })
      .select()
      .single();

    if (analysisError || !analysis) {
      throw new Error('Failed to create analysis record');
    }

    // 8. Save clusters first
    const clusterIds = await saveClustersToDatabase(adminClient, analysis.id, clustersWithIds);

    // 9. Map roadmap items to cluster IDs and save
    const roadmapItemsWithClusterIds = roadmapItemsWithIds.map(item => ({
      ...item,
      clusterIds: (item as any).clusterTitles.map((title: string) => {
        const cluster = clustersWithIds.find(c => c.title === title);
        return clusterIds[title] || '';
      }).filter(id => id)
    }));

    await saveRoadmapItemsToDatabase(adminClient, analysis.id, roadmapItemsWithClusterIds);

    // 10. Log API usage
    await logAPIUsage(adminClient, userId, projectId, aiResult.provider, deduplicatedFeedback.length);

    // 11. Add analytics event
    await logAnalyticsEvent(adminClient, projectId, 'feedback_analyzed', {
      feedback_count: deduplicatedFeedback.length,
      cluster_count: clustersWithIds.length,
      roadmap_items_count: roadmapItemsWithIds.length
    });

    // 12. Return formatted response
    return {
      projectId,
      analysisId: analysis.id,
      timestamp: analysis.created_at,
      totalFeedbackProcessed: deduplicatedFeedback.length,
      clusters: clustersWithIds,
      topRoadmapItems: roadmapItemsWithClusterIds
    };

  } catch (error) {
    // Log failed analysis attempt
    await logAPIUsage(adminClient, userId, projectId, 'unknown', 0, { error: error instanceof Error ? error.message : 'Unknown error' });
    
    throw error;
  }
}

// Basic deduplication using string similarity
function deduplicateFeedback(feedbackItems: Array<{ id: string; text: string }>): Array<{ id: string; text: string }> {
  const deduplicated: Array<{ id: string; text: string }> = [];
  
  for (const item of feedbackItems) {
    const isDuplicate = deduplicated.some(existing => 
      calculateSimilarity(item.text, existing.text) > 0.8
    );
    
    if (!isDuplicate) {
      deduplicated.push(item);
    }
  }
  
  return deduplicated;
}

// Simple similarity calculation (can be improved with more sophisticated algorithms)
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = Array.from(set1).filter(x => set2.has(x));
  const union = Array.from(new Set([...words1, ...words2]));
  
  return intersection.length / union.length;
}

// Parse AI response and validate with Zod
function parseAIResponse(response: string): AIAnalysisResponse {
  try {
    // Extract JSON from response (in case AI adds extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return AIAnalysisResponseSchema.parse(parsed);
  } catch (error) {
    throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
  }
}

// Save clusters to database and return mapping of title to UUID
async function saveClustersToDatabase(adminClient: any, analysisId: string, clusters: ClusterWithId[]): Promise<Record<string, string>> {
  const clusterInserts = clusters.map(cluster => ({
    analysis_id: analysisId,
    title: cluster.title,
    summary: cluster.summary,
    sentiment: cluster.sentiment,
    priority_score: cluster.priorityScore,
    effort_estimate: cluster.effortEstimate,
    key_quotes: cluster.keyQuotes
  }));

  const { data: savedClusters, error: clustersError } = await adminClient
    .from('feedback_clusters_analysis')
    .insert(clusterInserts)
    .select();

  if (clustersError) {
    throw new Error(`Failed to save cluster analysis: ${clustersError.message}`);
  }

  // Create mapping of title to UUID
  const titleToUuid: Record<string, string> = {};
  if (savedClusters) {
    savedClusters.forEach((saved: any, index: number) => {
      titleToUuid[clusters[index].title] = saved.id;
    });
  }

  return titleToUuid;
}

// Save roadmap items to database
async function saveRoadmapItemsToDatabase(adminClient: any, analysisId: string, roadmapItems: RoadmapItemWithId[]) {
  const roadmapInserts = roadmapItems.map(item => ({
    analysis_id: analysisId,
    title: item.title,
    expected_impact: item.expectedImpact,
    risks: item.risks,
    suggested_quarter: item.suggestedQuarter,
    cluster_ids: item.clusterIds
  }));

  const { error: roadmapError } = await adminClient
    .from('roadmap_items_analysis')
    .insert(roadmapInserts);

  if (roadmapError) {
    throw new Error(`Failed to save roadmap analysis: ${roadmapError.message}`);
  }
}

// Log API usage
async function logAPIUsage(adminClient: any, userId: string, projectId: string, service: string, feedbackCount: number, metadata?: any) {
  const { error } = await adminClient
    .from('api_usage_logs')
    .insert({
      user_id: userId,
      project_id: projectId,
      service: service,
      tokens_or_credits: feedbackCount, // Using feedback count as proxy for tokens
      cost_estimate: 0, // Could calculate actual cost based on API pricing
      endpoint: 'analyze_feedback',
      metadata: {
        feedback_count: feedbackCount,
        ...metadata
      }
    });

  if (error) {
    console.error('Failed to log API usage:', error);
  }
}

// Log analytics event
async function logAnalyticsEvent(adminClient: any, projectId: string, eventName: string, properties: any) {
  try {
    const { error } = await adminClient
      .from('analytics_events')
      .insert({
        project_id: projectId,
        event_name: eventName,
        event_type: 'feedback_analysis',
        properties: properties
      });

    if (error) {
      console.error('Failed to log analytics event:', error);
    }
  } catch (error) {
    console.error('Failed to log analytics event:', error);
  }
}