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
