import { createAdminClient } from './supabase';
import { Project, Plan } from '@/types';

const PLAN_LIMITS = {
  free: parseInt(process.env.PLAN_FREE_FEEDBACK_LIMIT || '50'),
  starter: parseInt(process.env.PLAN_STARTER_FEEDBACK_LIMIT || '500'),
  pro: parseInt(process.env.PLAN_PRO_FEEDBACK_LIMIT || '10000'),
};

export async function getProjectWithOwnership(projectId: string, userId: string): Promise<Project> {
  const adminClient = createAdminClient();

  const { data: project, error } = await adminClient
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error || !project) {
    throw new Error('Project not found');
  }

  if (project.user_id !== userId) {
    throw new Error('Forbidden: You do not own this project');
  }

  return project;
}

export async function checkFeedbackLimit(projectId: string, plan: Plan): Promise<void> {
  const adminClient = createAdminClient();

  const { count } = await adminClient
    .from('feedback_items')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .is('deleted_at', null);

  const limit = PLAN_LIMITS[plan];

  if ((count || 0) >= limit) {
    throw new Error(`Feedback limit reached for ${plan} plan. Upgrade to add more feedback.`);
  }
}

export function requireProPlan(plan: Plan): void {
  if (plan !== 'pro') {
    throw new Error('This feature requires a Pro plan. Please upgrade your subscription.');
  }
}

export function requirePaidPlan(plan: Plan): void {
  if (plan === 'free') {
    throw new Error('This feature requires a paid plan. Please upgrade your subscription.');
  }
}

export async function getUserPlan(userId: string): Promise<Plan> {
  const adminClient = createAdminClient();

  // Check if user has an active subscription
  const { data: subscription } = await adminClient
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (subscription) {
    return subscription.plan;
  }

  // Check projects for plan (legacy or default)
  const { data: project } = await adminClient
    .from('projects')
    .select('plan')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return project?.plan || 'free';
}
