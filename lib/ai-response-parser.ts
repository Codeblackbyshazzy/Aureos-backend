import { z, ZodSchema } from 'zod';
import { sanitizeForLog } from './sanitizer';

/**
 * Safely parse and validate AI responses
 * Extracts JSON, validates with Zod, handles errors gracefully
 */
export async function parseAndValidateAiResponse<T>(
  rawText: string,
  schema: ZodSchema
): Promise<T> {
  try {
    // 1. Extract JSON from response (search for first {...} or [...] block)
    const jsonMatch = rawText.match(/[\{\[][\s\S]*[\}\]]/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }
    
    const jsonStr = jsonMatch[0];
    
    // 2. Parse JSON
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error(`Invalid JSON in AI response: ${(e as Error).message}`);
    }
    
    // 3. Validate with Zod
    const validated = schema.parse(parsed);
    
    return validated as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to parse AI response:', {
      error: sanitizeForLog(message),
      rawLength: rawText.length,
      preview: rawText.slice(0, 200)
    });
    
    // Return null or throw - caller decides
    throw error;
  }
}

// Helper: sanitize error messages for client response
export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return `Validation failed: ${error.issues.map(i => i.path.join('.')).join(', ')}`;
  }
  
  if (error instanceof Error) {
    return sanitizeForLog(error.message);
  }
  
  return 'An unexpected error occurred';
}
