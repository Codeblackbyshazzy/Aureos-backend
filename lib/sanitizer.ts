/**
 * Sanitize user input for safe storage and display
 */
export function sanitizeUserInput(text: string, maxLength: number = 2000): string {
  // 1. Trim whitespace
  let sanitized = text.trim();
  
  // 2. Escape HTML entities: <>&"'
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  
  // 3. Remove control characters (ASCII 0-31, except \n \t \r)
  sanitized = sanitized.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
  
  // 4. Truncate to maxLength
  sanitized = sanitized.slice(0, maxLength);
  
  // 5. Validate UTF-8 (reject invalid sequences)
  try {
    new TextEncoder().encode(sanitized);
  } catch {
    throw new Error('Invalid UTF-8 sequence');
  }
  
  return sanitized;
}

/**
 * Sanitize for logging (remove secrets)
 */
export function sanitizeForLog(text: string): string {
  // 1. Truncate to 500 chars
  let sanitized = text.slice(0, 500);
  
  // 2. Replace secrets with [REDACTED]
  // Patterns: api_key, secret, token, password, authorization, bearer, sk_
  sanitized = sanitized.replace(
    /(api_key|secret|token|password|authorization|bearer|sk_[a-zA-Z0-9_]+)[:=\s]+\S+/gi,
    '[REDACTED]'
  );
  
  return sanitized;
}

/**
 * Sanitize user input for AI prompts (prevent injection)
 */
export function sanitizeForAiPrompt(text: string): string {
  // 1. Use sanitizeUserInput first
  let sanitized = sanitizeUserInput(text);
  
  // 2. Escape backticks (could break JSON/code blocks)
  sanitized = sanitized.replace(/`/g, '\\`');
  
  // 3. Check for injection attempts and log
  const injectionKeywords = ['ignore', 'bypass', 'instruction', 'system prompt', 'jailbreak'];
  const hasInjectionAttempt = injectionKeywords.some(keyword =>
    sanitized.toLowerCase().includes(keyword)
  );
  
  if (hasInjectionAttempt) {
    console.warn('⚠️ Potential prompt injection detected:', {
      text: sanitized.slice(0, 100),
      keywords: injectionKeywords.filter(k => sanitized.toLowerCase().includes(k))
    });
  }
  
  // 4. Wrap in delimiters to mark as user input
  return `"""${sanitized}"""`;
}
