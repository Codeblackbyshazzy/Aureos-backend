import { env } from './env';
import { createAdminClient } from './supabase';
import { AIService } from '@/types';

interface LogUsageParams {
  userId: string | null;
  projectId: string | null;
  service: AIService;
  tokensOrCredits: number;
  endpoint: string;
  metadata?: Record<string, unknown>;
}

const COST_RATES = {
  gemini: {
    input: env.GEMINI_INPUT_TOKEN_COST,
    output: env.GEMINI_OUTPUT_TOKEN_COST,
  },
  deepseek: env.DEEPSEEK_TOKEN_COST,
  firecrawl: env.FIRECRAWL_CREDIT_COST,
};

function calculateCost(
  service: AIService,
  tokensOrCredits: number,
  metadata?: Record<string, unknown>
): number {
  switch (service) {
    case 'gemini': {
      const inputTokens = typeof metadata?.inputTokens === 'number' ? metadata.inputTokens : 0;
      const outputTokens = typeof metadata?.outputTokens === 'number' ? metadata.outputTokens : 0;
      return inputTokens * COST_RATES.gemini.input + outputTokens * COST_RATES.gemini.output;
    }
    case 'deepseek':
      return tokensOrCredits * COST_RATES.deepseek;
    case 'firecrawl':
      return tokensOrCredits * COST_RATES.firecrawl;
    default:
      return 0;
  }
}

export async function logApiUsage(params: LogUsageParams): Promise<void> {
  const { userId, projectId, service, tokensOrCredits, endpoint, metadata } = params;
  const adminClient = createAdminClient();

  const costEstimate = calculateCost(service, tokensOrCredits, metadata);

  try {
    await adminClient.from('api_usage_logs').insert({
      user_id: userId,
      project_id: projectId,
      service,
      tokens_or_credits: tokensOrCredits,
      cost_estimate: costEstimate,
      endpoint,
      timestamp: new Date().toISOString(),
      metadata: metadata || null,
    });
  } catch (error) {
    // Log error but don't fail the request
    console.error('Failed to log API usage:', error);
  }
}

export async function batchLogApiUsage(logs: LogUsageParams[]): Promise<void> {
  const adminClient = createAdminClient();

  const records = logs.map(params => ({
    user_id: params.userId,
    project_id: params.projectId,
    service: params.service,
    tokens_or_credits: params.tokensOrCredits,
    cost_estimate: calculateCost(params.service, params.tokensOrCredits, params.metadata),
    endpoint: params.endpoint,
    timestamp: new Date().toISOString(),
    metadata: params.metadata || null,
  }));

  try {
    await adminClient.from('api_usage_logs').insert(records);
  } catch (error) {
    console.error('Failed to batch log API usage:', error);
  }
}
