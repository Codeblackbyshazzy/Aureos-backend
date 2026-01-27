import DOMPurify from 'isomorphic-dompurify';
import { sanitizeUserInput } from './sanitizer';

/**
 * Sanitize HTML for safe display (removes scripts, dangerous attributes)
 */
export function sanitizeHtml(html: string): string {
  const config = {
    ALLOWED_TAGS: ['p', 'strong', 'em', 'a', 'br', 'ul', 'li', 'code', 'blockquote'],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
    FORCE_BODY: false,
    RETURN_TRUSTED_TYPE: false,
  };
  
  const clean = DOMPurify.sanitize(html, config);
  
  // Additional: remove javascript: URLs
  return clean.replace(/javascript:/gi, '');
}

/**
 * Sanitize text for display (escape but allow safe markdown-like formatting)
 */
export function sanitizeText(text: string): string {
  // Just escape HTML, don't allow any tags
  return sanitizeUserInput(text);
}
