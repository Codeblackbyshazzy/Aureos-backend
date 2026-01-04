import { z } from 'zod';

export const createFeedbackSchema = z.object({
  text: z.string().min(1, 'Feedback text is required').max(5000, 'Feedback text too long'),
  sourceType: z.enum(['manual', 'import', 'api', 'web']).optional(),
  sourceUrl: z.string().url().optional().or(z.literal('')),
});

export const clusterFeedbackSchema = z.object({
  // Optional parameters can be added here in the future
});

export const prioritizeClustersSchema = z.object({
  clusterIds: z.array(z.string().uuid()).optional(),
});

export const webImportSchema = z.object({
  urls: z.array(z.string().url()).min(1, 'At least one URL is required').max(10, 'Maximum 10 URLs per request'),
});

export const createRoadmapItemSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  status: z.enum(['planned', 'in_progress', 'completed', 'cancelled']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  clusterId: z.string().uuid().optional(),
});

export const updateRoadmapItemSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  description: z.string().max(2000, 'Description too long').optional(),
  status: z.enum(['planned', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  clusterId: z.string().uuid().optional().nullable(),
});

export const createCheckoutSessionSchema = z.object({
  plan: z.enum(['starter', 'pro']),
  interval: z.enum(['monthly', 'yearly']),
});

export const changePlanSchema = z.object({
  plan: z.enum(['free', 'starter', 'pro']),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const feedbackQuerySchema = paginationSchema.extend({
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const adminUsersQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  sortBy: z.enum(['created_at', 'last_active_at', 'email']).default('created_at'),
});

export const apiUsageQuerySchema = z.object({
  service: z.enum(['gemini', 'deepseek', 'firecrawl']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  userId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});
