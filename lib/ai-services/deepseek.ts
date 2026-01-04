import axios from 'axios';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

export interface ClusterResult {
  clusters: Array<{
    name: string;
    description: string;
    feedbackIds: string[];
  }>;
  totalTokens: number;
}

export interface PriorityResult {
  priorities: Array<{
    clusterId: string;
    score: number;
    reasoning: string;
  }>;
  totalTokens: number;
}

export async function clusterFeedback(
  feedbackItems: Array<{ id: string; text: string }>
): Promise<ClusterResult> {
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

  const response = await axios.post(
    DEEPSEEK_API_URL,
    {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
    }
  );

  const text = response.data.choices[0].message.content;
  const totalTokens = response.data.usage?.total_tokens || 0;

  // Extract JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse clustering response from DeepSeek');
  }

  const clusters = JSON.parse(jsonMatch[0]);

  return {
    clusters,
    totalTokens,
  };
}

export async function prioritizeClusters(
  clusters: Array<{ id: string; name: string; description: string | null; feedbackCount: number }>
): Promise<PriorityResult> {
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

  const response = await axios.post(
    DEEPSEEK_API_URL,
    {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
    }
  );

  const text = response.data.choices[0].message.content;
  const totalTokens = response.data.usage?.total_tokens || 0;

  // Extract JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse prioritization response from DeepSeek');
  }

  const priorities = JSON.parse(jsonMatch[0]);

  return {
    priorities,
    totalTokens,
  };
}
