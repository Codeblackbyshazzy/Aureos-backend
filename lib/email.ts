import { env } from './env';
import { createAdminClient } from '@/lib/supabase';
import { sleep } from '@/lib/crypto-utils';

export interface EmailTemplateRecord {
  id: string;
  project_id: string;
  name: string;
  subject: string;
  body_html: string | null;
  body_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailPreferencesRecord {
  id: string;
  user_id: string;
  announcements_enabled: boolean;
  feedback_enabled: boolean;
  marketing_enabled: boolean;
  created_at: string;
  updated_at: string;
}

function renderTemplate(input: string, variables: Record<string, unknown>): string {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = variables[key];
    return value != null ? String(value) : '';
  });
}

async function sendWithResend(params: {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
}): Promise<{ id: string }>
{
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Email provider error: ${body}`);
  }

  const json = (await res.json()) as unknown;
  if (!json || typeof json !== 'object') {
    throw new Error('Email provider error');
  }

  const id = (json as Record<string, unknown>).id;
  if (typeof id !== 'string') {
    throw new Error('Email provider error');
  }

  return { id };
}

/**
 * Creates an email template for a project.
 */
export async function createEmailTemplate(params: {
  projectId: string;
  userId: string;
  name: string;
  subject: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
}): Promise<EmailTemplateRecord> {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from('email_templates')
    .insert({
      project_id: params.projectId,
      name: params.name,
      subject: params.subject,
      body_html: params.bodyHtml ?? null,
      body_text: params.bodyText ?? null,
      created_by: params.userId,
      updated_by: params.userId,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Failed to create email template');
  }

  return data as EmailTemplateRecord;
}

/**
 * Lists email templates for a project.
 */
export async function listEmailTemplates(projectId: string): Promise<EmailTemplateRecord[]> {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from('email_templates')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Failed to list email templates');
  }

  return (data ?? []) as EmailTemplateRecord[];
}

/**
 * Updates an email template.
 */
export async function updateEmailTemplate(params: {
  projectId: string;
  templateId: string;
  userId: string;
  name?: string;
  subject?: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
}): Promise<EmailTemplateRecord> {
  const adminClient = createAdminClient();

  const update: Record<string, unknown> = { updated_by: params.userId };
  if (params.name !== undefined) update.name = params.name;
  if (params.subject !== undefined) update.subject = params.subject;
  if (params.bodyHtml !== undefined) update.body_html = params.bodyHtml;
  if (params.bodyText !== undefined) update.body_text = params.bodyText;

  const { data, error } = await adminClient
    .from('email_templates')
    .update(update)
    .eq('project_id', params.projectId)
    .eq('id', params.templateId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Failed to update email template');
  }

  return data as EmailTemplateRecord;
}

async function logEmail(params: {
  projectId: string;
  templateId?: string;
  toEmail: string;
  subject: string;
  provider: string;
  providerMessageId?: string;
  status: 'sent' | 'failed';
  errorMessage?: string;
  attemptCount: number;
  sentAt?: string;
}): Promise<void> {
  const adminClient = createAdminClient();

  await adminClient.from('email_logs').insert({
    project_id: params.projectId,
    template_id: params.templateId ?? null,
    to_email: params.toEmail,
    subject: params.subject,
    provider: params.provider,
    provider_message_id: params.providerMessageId ?? null,
    status: params.status,
    error_message: params.errorMessage ?? null,
    attempt_count: params.attemptCount,
    sent_at: params.sentAt ?? null,
  });
}

/**
 * Sends an email (transactional). Uses Resend by default.
 */
export async function sendEmail(params: {
  projectId: string;
  templateId?: string;
  to: string;
  subject?: string;
  html?: string;
  text?: string;
  variables?: Record<string, unknown>;
}): Promise<{ providerMessageId: string }>
{
  const adminClient = createAdminClient();

  const from = env.EMAIL_FROM;
  if (!from) {
    throw new Error('Missing EMAIL_FROM');
  }

  let subject = params.subject;
  let html = params.html;
  let text = params.text;

  if (params.templateId) {
    const { data: template, error } = await adminClient
      .from('email_templates')
      .select('*')
      .eq('project_id', params.projectId)
      .eq('id', params.templateId)
      .single();

    if (error || !template) {
      throw new Error('Email template not found');
    }

    subject = subject ?? (template.subject as string);
    html = html ?? ((template.body_html as string | null) ?? undefined);
    text = text ?? ((template.body_text as string | null) ?? undefined);
  }

  if (!subject) {
    throw new Error('Missing email subject');
  }

  if (!html && !text) {
    throw new Error('Missing email body');
  }

  const variables = params.variables ?? {};

  const renderedSubject = renderTemplate(subject, variables);
  const renderedHtml = html ? renderTemplate(html, variables) : undefined;
  const renderedText = text ? renderTemplate(text, variables) : undefined;

  const provider = env.SENDGRID_API_KEY ? 'sendgrid' : 'resend';

  let lastError: string | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (provider !== 'resend') {
        throw new Error('SendGrid not configured in this build');
      }

      const result = await sendWithResend({
        from,
        to: params.to,
        subject: renderedSubject,
        html: renderedHtml,
        text: renderedText,
      });

      await logEmail({
        projectId: params.projectId,
        templateId: params.templateId,
        toEmail: params.to,
        subject: renderedSubject,
        provider,
        providerMessageId: result.id,
        status: 'sent',
        attemptCount: attempt,
        sentAt: new Date().toISOString(),
      });

      return { providerMessageId: result.id };
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Email send failed';

      if (attempt < 3) {
        await sleep(250 * attempt);
      }

      if (attempt === 3) {
        await logEmail({
          projectId: params.projectId,
          templateId: params.templateId,
          toEmail: params.to,
          subject: renderedSubject,
          provider,
          status: 'failed',
          errorMessage: lastError,
          attemptCount: attempt,
        });
      }
    }
  }

  throw new Error(lastError ?? 'Email send failed');
}

/**
 * Returns user email preferences (creates defaults if missing).
 */
export async function getEmailPreferences(userId: string): Promise<EmailPreferencesRecord> {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from('email_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!error && data) {
    return data as EmailPreferencesRecord;
  }

  const { data: created, error: createError } = await adminClient
    .from('email_preferences')
    .insert({ user_id: userId })
    .select('*')
    .single();

  if (createError || !created) {
    throw new Error('Failed to create email preferences');
  }

  return created as EmailPreferencesRecord;
}

/**
 * Updates user email preferences.
 */
export async function updateEmailPreferences(params: {
  userId: string;
  announcementsEnabled?: boolean;
  feedbackEnabled?: boolean;
  marketingEnabled?: boolean;
}): Promise<EmailPreferencesRecord> {
  const adminClient = createAdminClient();

  const current = await getEmailPreferences(params.userId);

  const update = {
    announcements_enabled: params.announcementsEnabled ?? current.announcements_enabled,
    feedback_enabled: params.feedbackEnabled ?? current.feedback_enabled,
    marketing_enabled: params.marketingEnabled ?? current.marketing_enabled,
  };

  const { data, error } = await adminClient
    .from('email_preferences')
    .update(update)
    .eq('user_id', params.userId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Failed to update email preferences');
  }

  return data as EmailPreferencesRecord;
}
