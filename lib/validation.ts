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

// Phase 4 Validation Schemas

export const createPollSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  options: z.array(z.string().min(1).max(500)).min(2, 'At least 2 options required').max(10, 'Maximum 10 options allowed'),
  status: z.enum(['active', 'closed', 'draft']).optional()
});

export const updatePollSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  status: z.enum(['active', 'closed', 'draft']).optional(),
  closed_at: z.string().datetime().optional()
});

export const voteSchema = z.object({
  option_id: z.string().uuid('Invalid option ID')
});

export const customDomainSchema = z.object({
  domain: z.string()
    .min(1, 'Domain is required')
    .max(255, 'Domain too long')
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/, 'Invalid domain format')
});

export const verifyDomainSchema = z.object({
  verification_token: z.string().min(1, 'Verification token is required')
});

export const addMemberSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  role_id: z.string().uuid('Invalid role ID')
});

export const updateMemberRoleSchema = z.object({
  role_id: z.string().uuid('Invalid role ID')
});

export const sentimentAnalysisSchema = z.object({
  feedback_ids: z.array(z.string().uuid()).min(1, 'At least one feedback ID required').max(100, 'Maximum 100 feedback items per request')
});

export const autoCategorizeSchema = z.object({
  feedback_ids: z.array(z.string().uuid()).min(1, 'At least one feedback ID required').max(50, 'Maximum 50 feedback items per request')
});

export const searchQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const advancedSearchSchema = searchQuerySchema.extend({
  sentiment: z.string().optional(),
  sourceType: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  minVotes: z.coerce.number().int().min(0).optional(),
  hasComments: z.coerce.boolean().optional(),
  hasVotes: z.coerce.boolean().optional(),
  sortBy: z.enum(['relevance', 'date', 'votes', 'comments']).default('relevance'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const addPollOptionsSchema = z.object({
  options: z.array(z.string().min(1).max(500)).min(1, 'At least one option required').max(10, 'Maximum 10 options allowed')
});

// Phase 3 Validation Schemas

// Survey Schemas
export const createSurveySchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  status: z.enum(['draft', 'active', 'closed']).optional(),
  settings: z.record(z.any()).optional()
});

export const updateSurveySchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  status: z.enum(['draft', 'active', 'closed']).optional(),
  settings: z.record(z.any()).optional(),
  closed_at: z.string().datetime().optional()
});

export const createSurveyQuestionSchema = z.object({
  question_text: z.string().min(1, 'Question text is required').max(1000, 'Question text too long'),
  question_type: z.enum(['multiple_choice', 'single_choice', 'text', 'rating', 'yes_no']),
  options: z.array(z.object({
    text: z.string().min(1, 'Option text is required').max(200, 'Option text too long'),
    value: z.string().min(1).max(200)
  })).optional(),
  required: z.boolean().optional(),
  order_index: z.number().int().min(0).optional()
});

export const submitSurveyResponseSchema = z.object({
  respondent_id: z.string().uuid().optional(),
  respondent_email: z.string().email().optional(),
  answers: z.array(z.object({
    question_id: z.string().uuid('Invalid question ID'),
    answer_text: z.string().optional(),
    answer_value: z.any().optional()
  })).min(1, 'At least one answer required'),
  metadata: z.record(z.any()).optional()
});

// Integration Schemas
export const configureIntegrationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  config: z.record(z.any()).default({}),
  credentials: z.record(z.any()).default({}),
  is_active: z.boolean().optional()
});

export const updateIntegrationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  config: z.record(z.any()).optional(),
  credentials: z.record(z.any()).optional(),
  is_active: z.boolean().optional()
});

// Analytics Schemas
export const analyticsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  metric: z.string().optional(),
  dimensions: z.record(z.any()).optional()
});

export const createCustomMetricSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  formula: z.string().min(1, 'Formula is required').max(2000, 'Formula too long'),
  chart_type: z.enum(['line', 'bar', 'pie', 'metric']).optional()
});

export const updateCustomMetricSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  description: z.string().max(500, 'Description too long').optional(),
  formula: z.string().min(1, 'Formula is required').max(2000, 'Formula too long').optional(),
  chart_type: z.enum(['line', 'bar', 'pie', 'metric']).optional(),
  is_active: z.boolean().optional()
});

export const createDashboardWidgetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  widget_type: z.enum(['metric', 'chart', 'table', 'list']),
  metric_name: z.string().optional(),
  custom_metric_id: z.string().uuid().optional(),
  configuration: z.record(z.any()).default({}),
  position_x: z.number().int().min(0).optional(),
  position_y: z.number().int().min(0).optional(),
  width: z.number().int().min(1).max(12).optional(),
  height: z.number().int().min(1).max(12).optional()
});

export const updateDashboardWidgetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  widget_type: z.enum(['metric', 'chart', 'table', 'list']).optional(),
  metric_name: z.string().optional(),
  custom_metric_id: z.string().uuid().optional(),
  configuration: z.record(z.any()).optional(),
  position_x: z.number().int().min(0).optional(),
  position_y: z.number().int().min(0).optional(),
  width: z.number().int().min(1).max(12).optional(),
  height: z.number().int().min(1).max(12).optional(),
  is_visible: z.boolean().optional()
});

// Multi-language Support Schemas
export const addProjectLanguageSchema = z.object({
  language_code: z.string().min(2, 'Language code is required').max(10, 'Language code too long'),
  language_name: z.string().min(1, 'Language name is required').max(50, 'Language name too long'),
  is_default: z.boolean().optional()
});

export const updateTranslationSchema = z.object({
  value: z.string().min(1, 'Translation value is required').max(2000, 'Translation value too long'),
  context: z.string().max(500, 'Context too long').optional(),
  is_approved: z.boolean().optional()
});

export const bulkUpdateTranslationsSchema = z.object({
  translations: z.array(z.object({
    key: z.string().min(1, 'Translation key is required'),
    value: z.string().min(1, 'Translation value is required').max(2000, 'Translation value too long'),
    context: z.string().max(500, 'Context too long').optional()
  })).min(1, 'At least one translation required')
});

export const importTranslationsSchema = z.object({
  format: z.enum(['json', 'csv', 'po']),
  content: z.string().min(1, 'Content is required'),
  language_code: z.string().min(2, 'Language code is required').max(10, 'Language code too long')
});

export const updateUserLanguagePreferenceSchema = z.object({
  language_code: z.string().min(2, 'Language code is required').max(10, 'Language code too long'),
  preference_level: z.number().int().min(1).max(5)
});
