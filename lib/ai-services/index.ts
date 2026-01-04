import * as gemini from './gemini';
import * as deepseek from './deepseek';

export interface ClusterResult {
  clusters: Array<{
    name: string;
    description: string;
    feedbackIds: string[];
  }>;
  service: 'gemini' | 'deepseek';
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface PriorityResult {
  priorities: Array<{
    clusterId: string;
    score: number;
    reasoning: string;
  }>;
  service: 'gemini' | 'deepseek';
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export async function clusterFeedbackWithFallback(
  feedbackItems: Array<{ id: string; text: string }>
): Promise<ClusterResult> {
  try {
    console.log('Attempting to cluster with Gemini...');
    const result = await gemini.clusterFeedback(feedbackItems);
    return {
      ...result,
      service: 'gemini',
    };
  } catch (error) {
    console.error('Gemini clustering failed, falling back to DeepSeek:', error);
    
    try {
      const result = await deepseek.clusterFeedback(feedbackItems);
      return {
        ...result,
        service: 'deepseek',
      };
    } catch (deepseekError) {
      console.error('DeepSeek clustering also failed:', deepseekError);
      throw new Error('Both AI services failed to cluster feedback. Please try again later.');
    }
  }
}

export async function prioritizeClustersWithFallback(
  clusters: Array<{ id: string; name: string; description: string | null; feedbackCount: number }>
): Promise<PriorityResult> {
  try {
    console.log('Attempting to prioritize with Gemini...');
    const result = await gemini.prioritizeClusters(clusters);
    return {
      ...result,
      service: 'gemini',
    };
  } catch (error) {
    console.error('Gemini prioritization failed, falling back to DeepSeek:', error);
    
    try {
      const result = await deepseek.prioritizeClusters(clusters);
      return {
        ...result,
        service: 'deepseek',
      };
    } catch (deepseekError) {
      console.error('DeepSeek prioritization also failed:', deepseekError);
      throw new Error('Both AI services failed to prioritize clusters. Please try again later.');
    }
  }
}

export { scrapeAndExtractText, batchScrapeUrls } from './firecrawl';
