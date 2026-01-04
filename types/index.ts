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
  metadata: Record<string, any> | null;
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
  metadata: Record<string, any> | null;
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

// API Response Types

export interface ApiResponse<T = any> {
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

export interface IdeaPoll {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: PollStatus;
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
}

export interface UpdatePollRequest {
  title?: string;
  description?: string;
  status?: PollStatus;
  closed_at?: string;
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
