import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../env';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

export interface ClusterResult {
  clusters: Array<{
    name: string;
    description: string;
    feedbackIds: string[];
  }>;
  inputTokens: number;
  outputTokens: number;
}

export interface PriorityResult {
  priorities: Array<{
    clusterId: string;
    score: number;
    reasoning: string;
  }>;
  inputTokens: number;
  outputTokens: number;
}

export async function clusterFeedback(
  feedbackItems: Array<{ id: string; text: string }>
): Promise<ClusterResult> {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const prompt = `You are an AI assistant helping to cluster similar feedback items. 
Analyze the following feedback and group similar items into meaningful clusters.
For each cluster, provide a name and description.

Feedback items:
${feedbackItems.map((item, idx) => `[${idx}] ID: ${item.id}\n${item.text}`).join('\n\n')}

Respond with a JSON array of clusters in this exact format:
[
  {
    "name": "Cluster name",
    "description": "Brief description of what this cluster represents",
    "feedbackIds": ["id1", "id2"]
  }
]

Only return the JSON array, no other text.`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  // Extract JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse clustering response from Gemini');
  }

  const clusters = JSON.parse(jsonMatch[0]);

  // Estimate token counts (Gemini doesn't provide exact counts in API response)
  const inputTokens = Math.ceil(prompt.length / 4);
  const outputTokens = Math.ceil(text.length / 4);

  return {
    clusters,
    inputTokens,
    outputTokens,
  };
}

export async function prioritizeClusters(
  clusters: Array<{ id: string; name: string; description: string | null; feedbackCount: number }>
): Promise<PriorityResult> {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const prompt = `You are an AI assistant helping to prioritize product feedback clusters.
Analyze the following clusters and assign a priority score from 0-100 based on:
- Impact potential
- Number of feedback items
- Urgency
- Business value

Clusters:
${clusters.map(c => `ID: ${c.id}
Name: ${c.name}
Description: ${c.description || 'No description'}
Feedback Count: ${c.feedbackCount}`).join('\n\n')}

Respond with a JSON array in this exact format:
[
  {
    "clusterId": "cluster-id",
    "score": 85,
    "reasoning": "Brief explanation of the score"
  }
]

Only return the JSON array, no other text.`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  // Extract JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse prioritization response from Gemini');
  }

  const priorities = JSON.parse(jsonMatch[0]);

  const inputTokens = Math.ceil(prompt.length / 4);
  const outputTokens = Math.ceil(text.length / 4);

  return {
    priorities,
    inputTokens,
    outputTokens,
  };
}
