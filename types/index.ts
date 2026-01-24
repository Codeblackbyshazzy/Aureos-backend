// Database Models

export type UserRole = 'user' | 'admin';

export type Plan = 'free' | 'starter' | 'pro';

export type BillingInterval = 'monthly' | 'yearly';

export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'paused';

export type SourceType = 'manual' | 'import' | 'api' | 'web';

export type Sentiment = 'positive' | 'neutral' | 'negative';

export type RoadmapStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export type RoadmapPriority = 'low' | 'medium' | 'high' | 'critical';

export type AIService = 'gemini' | 'deepseek' | 'firecrawl';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  last_active_at: string | null;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  plan: Plan;
  created_at: string;
  updated_at: string;
}

export interface FeedbackItem {
  id: string;
  project_id: string;
  text: string;
  source_type: SourceType;
  source_url: string | null;
  sentiment: Sentiment | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
  deleted_at: string | null;
  vote_count: number;
  follower_count: number;
  comment_count: number;
  status_id: string | null;
}

export interface FeedbackCluster {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  feedback_count: number;
  priority_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface RoadmapItem {
  id: string;
  project_id: string;
  cluster_id: string | null;
  title: string;
  description: string | null;
  status: RoadmapStatus;
  priority: RoadmapPriority;
  votes: number;
  created_at: string;
  updated_at: string;
}

export interface ApiUsageLog {
  id: string;
  user_id: string | null;
  project_id: string | null;
  service: AIService;
  tokens_or_credits: number;
  cost_estimate: number;
  endpoint: string;
  timestamp: string;
  metadata: Record<string, unknown> | null;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  plan: Plan;
  billing_interval: BillingInterval;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  updated_at: string;
}

export interface Vote {
  id: string;
  feedback_id: string;
  user_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  feedback_id: string;
  project_id: string;
  user_id: string | null;
  user_name?: string;
  user_email?: string;
  text: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  parent_comment_id?: string | null;
}

export interface Follower {
  id: string;
  feedback_id: string;
  user_id: string;
  created_at: string;
}

export interface Topic {
  id: string;
  project_id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedbackStatus {
  id: string;
  project_id: string;
  name: string;
  color: string;
  icon?: string | null;
  display_order: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeedbackItemExtended extends FeedbackItem {
  vote_count: number;
  follower_count: number;
  comment_count: number;
  topics: Topic[];
  status: FeedbackStatus | null;
  user_has_voted: boolean;
  user_is_following: boolean;
}

// Phase 2 Models

export type AnnouncementStatus = 'draft' | 'scheduled' | 'published';

export interface AnnouncementCategory {
  id: string;
  project_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: string;
  project_id: string;
  category_id: string | null;
  title: string;
  content: string;
  status: AnnouncementStatus;
  scheduled_for: string | null;
  published_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementSubscriber {
  id: string;
  project_id: string;
  user_id: string;
  subscribed_at: string;
  unsubscribed_at: string | null;
}

export interface AnnouncementRead {
  id: string;
  announcement_id: string;
  user_id: string;
  read_at: string;
}

export type SsoProviderType = 'oidc' | 'saml';

export interface SsoConfiguration {
  id: string;
  project_id: string;
  provider_type: SsoProviderType;
  name: string;
  enabled: boolean;
  oidc_issuer_url: string | null;
  oidc_client_id: string | null;
  oidc_client_secret: string | null;
  oidc_redirect_url: string | null;
  oidc_scopes: string[];
  saml_entity_id: string | null;
  saml_sso_url: string | null;
  saml_certificate: string | null;
  attribute_mapping: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SsoSession {
  id: string;
  project_id: string;
  provider_type: SsoProviderType;
  status: 'pending' | 'active' | 'revoked';
  state: string;
  nonce: string | null;
  code_verifier: string | null;
  external_user_id: string | null;
  email: string | null;
  user_id: string | null;
  created_at: string;
  expires_at: string;
  last_active_at: string | null;
  revoked_at: string | null;
}

export interface EmailTemplate {
  id: string;
  project_id: string;
  name: string;
  subject: string;
  body_html: string | null;
  body_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailLog {
  id: string;
  project_id: string;
  template_id: string | null;
  to_email: string;
  to_user_id: string | null;
  subject: string;
  provider: string;
  provider_message_id: string | null;
  status: 'sent' | 'failed';
  error_message: string | null;
  attempt_count: number;
  sent_at: string | null;
  created_at: string;
}

export interface EmailPreferences {
  id: string;
  user_id: string;
  announcements_enabled: boolean;
  feedback_enabled: boolean;
  marketing_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookEvent {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Webhook {
  id: string;
  project_id: string;
  url: string;
  secret: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookDeliveryLog {
  id: string;
  webhook_id: string;
  event_name: string;
  payload: Record<string, unknown>;
  status_code: number | null;
  success: boolean;
  attempt: number;
  error_message: string | null;
  delivered_at: string | null;
  next_retry_at: string | null;
  created_at: string;
}

export interface GuestSession {
  id: string;
  project_id: string;
  created_by: string | null;
  permissions: string[];
  one_time: boolean;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface GuestAccessToken {
  id: string;
  session_id: string;
  token_hash: string;
  created_at: string;
  last_used_at: string | null;
}

// Feedback Analysis Models

export interface FeedbackAnalysis {
  id: string;
  project_id: string;
  user_id: string;
  ai_provider: 'gemini' | 'deepseek';
  feedback_count: number;
  cluster_count: number;
  status: 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

export interface FeedbackClusterAnalysis {
  id: string;
  analysis_id: string;
  cluster_id: string | null;
  title: string;
  summary: string | null;
  sentiment: 'Very Negative' | 'Negative' | 'Neutral' | 'Positive' | 'Mixed' | null;
  priority_score: number | null;
  effort_estimate: 'Low' | 'Medium' | 'High' | null;
  key_quotes: string[];
  created_at: string;
}

export interface RoadmapItemAnalysis {
  id: string;
  analysis_id: string;
  cluster_id: string | null;
  title: string;
  expected_impact: string | null;
  risks: string | null;
  suggested_quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4' | null;
  cluster_ids: string[];
  created_at: string;
}

export interface FeedbackAnalysisRequest {
  projectId: string;
}

export interface FeedbackAnalysisResponse {
  projectId: string;
  analysisId: string;
  timestamp: string;
  totalFeedbackProcessed: number;
  clusters: Array<{
    id: string;
    title: string;
    count: number;
    summary: string;
    sentiment: 'Very Negative' | 'Negative' | 'Neutral' | 'Positive' | 'Mixed';
    keyQuotes: string[];
    priorityScore: number;
    effortEstimate: 'Low' | 'Medium' | 'High';
  }>;
  topRoadmapItems: Array<{
    id: string;
    title: string;
    clusterIds: string[];
    expectedImpact: string;
    risks: string;
    suggestedQuarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  }>;
}

// API Response Types

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  retryAfter?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Admin Types

export interface UserWithStats extends User {
  project_count: number;
  total_feedback_items: number;
  lifetime_revenue: number;
  mrr_contribution: number;
}

export interface UserDetailedProfile {
  user: User;
  projects: Array<{
    id: string;
    name: string;
    feedback_count: number;
    cluster_count: number;
    created_at: string;
  }>;
  subscription_history: Subscription[];
  api_usage_breakdown: {
    [service in AIService]: {
      total_spend: number;
      call_count: number;
    };
  };
  recent_activity: string | null;
}

export interface SubscriptionAnalytics {
  active_count: number;
  churned_count: number;
  revenue_summary: {
    total_mrr: number;
    total_arr: number;
    revenue_by_plan: {
      starter: { mrr: number; arr: number };
      pro: { mrr: number; arr: number };
    };
    revenue_by_interval: {
      monthly: { count: number; mrr: number };
      yearly: { count: number; arr: number };
    };
  };
  status_distribution: {
    active: number;
    cancelled: number;
    past_due: number;
    paused: number;
  };
}

export interface ServiceUsage {
  call_count: number;
  total_input_tokens?: number;
  total_output_tokens?: number;
  total_tokens?: number;
  total_credits?: number;
  estimated_cost: number;
}

export interface ApiUsageAnalytics {
  total_usage: number;
  service_breakdown: {
    [service in AIService]: ServiceUsage;
  };
  top_users: Array<{
    user_id: string;
    email: string;
    service: AIService;
    spend: number;
    call_count: number;
  }>;
  cost_trends: Array<{
    date: string;
    gemini_cost: number;
    deepseek_cost: number;
    firecrawl_cost: number;
    total: number;
  }>;
}

export interface DashboardMetrics {
  users: {
    total_all_time: number;
    active_this_month: number;
    this_month_new: number;
  };
  revenue: {
    current_mrr: number;
    arr: number;
    growth_rate_percent: number;
  };
  feedback: {
    total_processed: number;
    avg_per_project: number;
  };
  projects: {
    total_active: number;
    avg_feedback_per_project: number;
    avg_clusters_per_project: number;
  };
  conversion: {
    free_to_paid_count: number;
    conversion_rate_percent: number;
  };
  plans: {
    free_count: number;
    starter_count: number;
    pro_count: number;
  };
}

// Request Body Types

export interface CreateFeedbackRequest {
  text: string;
  sourceType?: SourceType;
  sourceUrl?: string;
}

export interface ClusterFeedbackRequest {
  // Optional body parameters can be added here
}

export interface PrioritizeClustersRequest {
  clusterIds?: string[];
}

export interface WebImportRequest {
  urls: string[];
}

export interface CreateRoadmapItemRequest {
  title: string;
  description: string;
  status: RoadmapStatus;
  priority: RoadmapPriority;
  clusterId?: string;
}

export interface UpdateRoadmapItemRequest {
  title?: string;
  description?: string;
  status?: RoadmapStatus;
  priority?: RoadmapPriority;
  clusterId?: string;
}

export interface CreateCheckoutSessionRequest {
  plan: 'starter' | 'pro';
  interval: 'monthly' | 'yearly';
}

export interface ChangePlanRequest {
  plan: Plan;
}

// Auth Context Types

export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
}

export interface ProjectContext extends AuthContext {
  projectId: string;
  project: Project;
}

// Phase 4: Extended Types

export type PollStatus = 'active' | 'closed' | 'draft';
export type PollType = 'single_choice' | 'multiple_choice' | 'ranking';

export interface IdeaPoll {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: PollStatus;
  type: PollType;
  settings: Record<string, unknown>;
  is_anonymous: boolean;
  allow_retraction: boolean;
  created_at: string;
  closed_at: string | null;
  created_by: string;
}

export interface PollOption {
  id: string;
  poll_id: string;
  option_text: string;
  display_order: number;
  created_at: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  option_id: string;
  user_id: string;
  created_at: string;
}

export interface PollResults {
  poll: IdeaPoll;
  options: Array<PollOption & {
    vote_count: number;
    percentage: number;
    user_voted?: boolean;
  }>;
  total_votes: number;
  user_has_voted: boolean;
}

export interface CustomDomain {
  custom_domain: string;
  domain_verified: boolean;
  domain_verification_token: string | null;
  domain_verified_at: string | null;
}

export interface ProjectRole {
  id: string;
  project_id: string;
  name: string;
  permissions: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role_id: string | null;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    email: string;
  };
  role: ProjectRole | null;
}

export interface SearchFilters {
  sentiment?: Sentiment[];
  sourceType?: SourceType[];
  status?: string[];
  dateFrom?: string;
  dateTo?: string;
  hasComments?: boolean;
  hasVotes?: boolean;
  minVotes?: number;
}

export interface SearchResult extends FeedbackItem {
  search_rank: number;
  highlighted_text: string;
}

export interface SentimentAnalysis {
  id: string;
  feedback_id: string;
  sentiment: Sentiment;
  confidence: number;
  keywords: string[];
  created_at: string;
}

export interface TopicAuto {
  id: string;
  project_id: string;
  feedback_id: string;
  topic_name: string;
  confidence: number;
  created_at: string;
}

// Request/Response Types for Phase 4

export interface CreatePollRequest {
  title: string;
  description?: string;
  options: string[];
  status?: PollStatus;
  type?: PollType;
  settings?: Record<string, unknown>;
  is_anonymous?: boolean;
  allow_retraction?: boolean;
}

export interface UpdatePollRequest {
  title?: string;
  description?: string;
  status?: PollStatus;
  type?: PollType;
  settings?: Record<string, unknown>;
  is_anonymous?: boolean;
  allow_retraction?: boolean;
  closed_at?: string | null;
}

export interface VoteRequest {
  option_id: string;
}

export interface CustomDomainRequest {
  domain: string;
}

export interface VerifyDomainRequest {
  verification_token: string;
}

export interface AddMemberRequest {
  user_id: string;
  role_id: string;
}

export interface UpdateMemberRoleRequest {
  role_id: string;
}

export interface SearchRequest {
  query: string;
  filters?: SearchFilters;
  page?: number;
  limit?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  facets: {
    sentiments: Array<{ value: Sentiment; count: number }>;
    sourceTypes: Array<{ value: SourceType; count: number }>;
    dateRange: {
      min: string;
      max: string;
    };
  };
}

export interface SentimentAnalysisRequest {
  feedback_ids: string[];
}

export interface AutoCategorizeRequest {
  feedback_ids: string[];
}

// WebSocket Types
export interface WebSocketMessage {
  type: 'feedback:created' | 'feedback:voted' | 'comment:added' | 'status:changed' | 'user:online' | 'user:offline' | 'poll:created' | 'poll:voted';
  payload: any;
  timestamp: string;
  user_id: string;
}

export interface ProjectPresence {
  user_id: string;
  email: string;
  last_seen: string;
  is_online: boolean;
}

// Phase 3 Types

// Survey Types
export type SurveyStatus = 'draft' | 'active' | 'closed';

export type SurveyQuestionType = 'multiple_choice' | 'single_choice' | 'text' | 'rating' | 'yes_no';

export interface Survey {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  settings: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  question_text: string;
  question_type: SurveyQuestionType;
  options: SurveyQuestionOption[];
  required: boolean;
  order_index: number;
  created_at: string;
}

export interface SurveyQuestionOption {
  text: string;
  value: string;
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  respondent_id: string | null;
  respondent_email: string | null;
  submitted_at: string;
  metadata: Record<string, unknown>;
}

export interface SurveyAnswer {
  id: string;
  response_id: string;
  question_id: string;
  answer_text: string | null;
  answer_value: unknown;
  created_at: string;
}

export interface SurveyAnalytics {
  total_responses: number;
  completion_rate: number;
  question_analytics: Array<{
    question_id: string;
    question_text: string;
    question_type: SurveyQuestionType;
    total_answers: number;
    answer_distribution: Array<{
      answer: string;
      count: number;
      percentage: number;
    }>;
  }>;
}

// Integration Types
export type IntegrationProvider = 'slack' | 'discord' | 'github' | 'zapier' | 'mailchimp' | 'intercom';

export interface Integration {
  id: string;
  project_id: string;
  provider: IntegrationProvider;
  name: string;
  is_active: boolean;
  config: Record<string, unknown>;
  credentials: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_sync_at: string | null;
}

export interface IntegrationLog {
  id: string;
  integration_id: string;
  event_type: string;
  message: string | null;
  data: Record<string, unknown>;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

// Analytics Types
export interface AnalyticsEvent {
  id: string;
  project_id: string;
  event_type: string;
  event_name: string;
  user_id: string | null;
  session_id: string | null;
  properties: Record<string, unknown>;
  timestamp: string;
  ip_address: string | null;
  user_agent: string | null;
}

export interface AnalyticsAggregate {
  id: string;
  project_id: string;
  metric_name: string;
  date: string;
  hour: number | null;
  value: number;
  dimensions: Record<string, unknown>;
  created_at: string;
}

export interface CustomMetric {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  formula: string;
  chart_type: 'line' | 'bar' | 'pie' | 'metric';
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardWidget {
  id: string;
  project_id: string;
  name: string;
  widget_type: 'metric' | 'chart' | 'table' | 'list';
  metric_name: string | null;
  custom_metric_id: string | null;
  configuration: Record<string, unknown>;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsOverview {
  total_events: number;
  unique_users: number;
  page_views: number;
  feedback_created: number;
  engagement_rate: number;
  top_events: Array<{
    event_name: string;
    count: number;
  }>;
  trend_data: Array<{
    date: string;
    value: number;
  }>;
}

// Multi-language Support Types
export interface ProjectLanguage {
  id: string;
  project_id: string;
  language_code: string;
  language_name: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Translation {
  id: string;
  project_id: string;
  language_code: string;
  key: string;
  value: string;
  context: string | null;
  is_approved: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserLanguagePreference {
  id: string;
  user_id: string;
  language_code: string;
  preference_level: number;
  created_at: string;
  updated_at: string;
}

// Request/Response Types for Phase 3

export interface CreateSurveyRequest {
  title: string;
  description?: string;
  status?: SurveyStatus;
  settings?: Record<string, unknown>;
}

export interface UpdateSurveyRequest {
  title?: string;
  description?: string;
  status?: SurveyStatus;
  settings?: Record<string, unknown>;
  closed_at?: string;
}

export interface CreateSurveyQuestionRequest {
  question_text: string;
  question_type: SurveyQuestionType;
  options?: SurveyQuestionOption[];
  required?: boolean;
  order_index?: number;
}

export interface SubmitSurveyResponseRequest {
  respondent_id?: string;
  respondent_email?: string;
  answers: Array<{
    question_id: string;
    answer_text?: string;
    answer_value?: unknown;
  }>;
  metadata?: Record<string, unknown>;
}

export interface ConfigureIntegrationRequest {
  name: string;
  config?: Record<string, unknown>;
  credentials?: Record<string, unknown>;
  is_active?: boolean;
}

export interface UpdateIntegrationRequest {
  name?: string;
  config?: Record<string, unknown>;
  credentials?: Record<string, unknown>;
  is_active?: boolean;
}

export interface AnalyticsQueryRequest {
  startDate?: string;
  endDate?: string;
  metric?: string;
  dimensions?: Record<string, unknown>;
}

export interface CreateCustomMetricRequest {
  name: string;
  description?: string;
  formula: string;
  chart_type?: 'line' | 'bar' | 'pie' | 'metric';
}

export interface UpdateCustomMetricRequest {
  name?: string;
  description?: string;
  formula?: string;
  chart_type?: 'line' | 'bar' | 'pie' | 'metric';
  is_active?: boolean;
}

export interface CreateDashboardWidgetRequest {
  name: string;
  widget_type: 'metric' | 'chart' | 'table' | 'list';
  metric_name?: string;
  custom_metric_id?: string;
  configuration?: Record<string, unknown>;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
}

export interface UpdateDashboardWidgetRequest {
  name?: string;
  widget_type?: 'metric' | 'chart' | 'table' | 'list';
  metric_name?: string;
  custom_metric_id?: string;
  configuration?: Record<string, unknown>;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  is_visible?: boolean;
}

export interface AddProjectLanguageRequest {
  language_code: string;
  language_name: string;
  is_default?: boolean;
}

export interface UpdateTranslationRequest {
  value: string;
  context?: string;
  is_approved?: boolean;
}

export interface BulkUpdateTranslationsRequest {
  translations: Array<{
    key: string;
    value: string;
    context?: string;
  }>;
}

export interface ImportTranslationsRequest {
  format: 'json' | 'csv' | 'po';
  content: string;
  language_code: string;
}

export interface UpdateUserLanguagePreferenceRequest {
  language_code: string;
  preference_level: number;
}

// Phase 4: Enterprise Features Types

export interface CustomDomainEnterprise {
  id: string;
  project_id: string;
  domain: string;
  status: 'pending' | 'verified' | 'failed';
  ssl_status: 'none' | 'pending' | 'active' | 'expired';
  verification_method: 'dns-txt' | 'dns-cname' | 'http';
  verification_token: string | null;
  created_at: string;
  updated_at: string;
  verified_at: string | null;
}

export interface DomainVerification {
  id: string;
  domain_id: string;
  type: string;
  name: string;
  value: string;
  is_verified: boolean;
  last_checked_at: string | null;
  created_at: string;
}

export interface DomainSettings {
  id: string;
  domain_id: string;
  branding_settings: Record<string, unknown>;
  custom_css: string | null;
  custom_js: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchIndex {
  id: string;
  project_id: string;
  name: string;
  index_type: string;
  status: string;
  last_indexed_at: string | null;
  created_at: string;
}

export interface SavedSearchFilter {
  id: string;
  project_id: string;
  name: string;
  filter_config: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface RealtimeSubscription {
  id: string;
  project_id: string;
  channel: string;
  event: string;
  created_at: string;
}

export interface CreateCustomDomainRequest {
  domain: string;
  verification_method?: 'dns-txt' | 'dns-cname' | 'http';
}

export interface UpdateCustomDomainRequest {
  branding_settings?: Record<string, unknown>;
  custom_css?: string;
  custom_js?: string;
}

export interface SearchRequest {
  query: string;
  filters?: SearchFilters;
  page?: number;
  limit?: number;
}

export interface CreateSearchFilterRequest {
  name: string;
  filter_config: Record<string, unknown>;
}

export interface RealtimeSubscribeRequest {
  event_types: string[];
  channel_name: string;
}
