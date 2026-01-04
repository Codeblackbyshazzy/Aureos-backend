import { createAdminClient } from '@/lib/supabase';

export type AnnouncementStatus = 'draft' | 'scheduled' | 'published';

export interface AnnouncementRecord {
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

export interface AnnouncementListResult {
  announcements: AnnouncementRecord[];
  total: number;
}

/**
 * Publishes any scheduled announcements whose scheduled time has passed.
 */
export async function publishDueScheduledAnnouncements(projectId: string): Promise<void> {
  const adminClient = createAdminClient();
  const nowIso = new Date().toISOString();

  await adminClient
    .from('announcements')
    .update({ status: 'published', published_at: nowIso })
    .eq('project_id', projectId)
    .eq('status', 'scheduled')
    .lte('scheduled_for', nowIso);
}

/**
 * Creates an announcement.
 */
export async function createAnnouncement(params: {
  projectId: string;
  userId: string;
  title: string;
  content: string;
  categoryId?: string | null;
  status: Exclude<AnnouncementStatus, 'published'>;
  scheduledFor?: string | null;
}): Promise<AnnouncementRecord> {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from('announcements')
    .insert({
      project_id: params.projectId,
      category_id: params.categoryId ?? null,
      title: params.title,
      content: params.content,
      status: params.status,
      scheduled_for: params.status === 'scheduled' ? params.scheduledFor ?? null : null,
      created_by: params.userId,
      updated_by: params.userId,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Failed to create announcement');
  }

  return data as AnnouncementRecord;
}

/**
 * Lists announcements for a project.
 */
export async function listAnnouncements(params: {
  projectId: string;
  page: number;
  limit: number;
  status?: AnnouncementStatus;
  q?: string;
}): Promise<AnnouncementListResult> {
  const adminClient = createAdminClient();

  await publishDueScheduledAnnouncements(params.projectId);

  const offset = (params.page - 1) * params.limit;

  let query = adminClient
    .from('announcements')
    .select('*', { count: 'exact' })
    .eq('project_id', params.projectId)
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (params.status) {
    query = query.eq('status', params.status);
  }

  if (params.q) {
    query = query.textSearch('search_vector', params.q, {
      type: 'websearch',
      config: 'english',
    });
  }

  const { data, error, count } = await query.range(offset, offset + params.limit - 1);

  if (error) {
    throw new Error('Failed to list announcements');
  }

  return {
    announcements: (data ?? []) as AnnouncementRecord[],
    total: count ?? 0,
  };
}

/**
 * Gets a single announcement.
 */
export async function getAnnouncement(params: {
  projectId: string;
  announcementId: string;
}): Promise<AnnouncementRecord> {
  const adminClient = createAdminClient();

  await publishDueScheduledAnnouncements(params.projectId);

  const { data, error } = await adminClient
    .from('announcements')
    .select('*')
    .eq('project_id', params.projectId)
    .eq('id', params.announcementId)
    .single();

  if (error || !data) {
    throw new Error('Announcement not found');
  }

  return data as AnnouncementRecord;
}

/**
 * Updates an announcement.
 */
export async function updateAnnouncement(params: {
  projectId: string;
  announcementId: string;
  userId: string;
  title?: string;
  content?: string;
  categoryId?: string | null;
  status?: Exclude<AnnouncementStatus, 'published'>;
  scheduledFor?: string | null;
}): Promise<AnnouncementRecord> {
  const adminClient = createAdminClient();

  const update: Record<string, unknown> = {
    updated_by: params.userId,
  };

  if (params.title !== undefined) update.title = params.title;
  if (params.content !== undefined) update.content = params.content;
  if (params.categoryId !== undefined) update.category_id = params.categoryId;

  if (params.status !== undefined) {
    update.status = params.status;
    update.scheduled_for = params.status === 'scheduled' ? params.scheduledFor ?? null : null;
  } else if (params.scheduledFor !== undefined) {
    update.scheduled_for = params.scheduledFor;
  }

  const { data, error } = await adminClient
    .from('announcements')
    .update(update)
    .eq('project_id', params.projectId)
    .eq('id', params.announcementId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Failed to update announcement');
  }

  return data as AnnouncementRecord;
}

/**
 * Deletes an announcement.
 */
export async function deleteAnnouncement(params: {
  projectId: string;
  announcementId: string;
}): Promise<void> {
  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from('announcements')
    .delete()
    .eq('project_id', params.projectId)
    .eq('id', params.announcementId);

  if (error) {
    throw new Error('Failed to delete announcement');
  }
}

/**
 * Publishes an announcement.
 */
export async function publishAnnouncement(params: {
  projectId: string;
  announcementId: string;
  userId: string;
}): Promise<AnnouncementRecord> {
  const adminClient = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await adminClient
    .from('announcements')
    .update({
      status: 'published',
      published_at: nowIso,
      scheduled_for: null,
      updated_by: params.userId,
    })
    .eq('project_id', params.projectId)
    .eq('id', params.announcementId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Failed to publish announcement');
  }

  return data as AnnouncementRecord;
}

/**
 * Subscribes or unsubscribes a user from project announcements.
 */
export async function setAnnouncementSubscription(params: {
  projectId: string;
  userId: string;
  subscribed: boolean;
}): Promise<{ subscribed: boolean }>
{
  const adminClient = createAdminClient();

  if (params.subscribed) {
    const { error } = await adminClient
      .from('announcement_subscribers')
      .upsert(
        {
          project_id: params.projectId,
          user_id: params.userId,
          subscribed_at: new Date().toISOString(),
          unsubscribed_at: null,
        },
        { onConflict: 'project_id,user_id' }
      );

    if (error) {
      throw new Error('Failed to subscribe');
    }

    return { subscribed: true };
  }

  const { error } = await adminClient
    .from('announcement_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('project_id', params.projectId)
    .eq('user_id', params.userId);

  if (error) {
    throw new Error('Failed to unsubscribe');
  }

  return { subscribed: false };
}

/**
 * Records that a user has read an announcement.
 */
export async function recordAnnouncementRead(params: {
  announcementId: string;
  userId: string;
}): Promise<void> {
  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from('announcement_reads')
    .upsert(
      {
        announcement_id: params.announcementId,
        user_id: params.userId,
        read_at: new Date().toISOString(),
      },
      { onConflict: 'announcement_id,user_id' }
    );

  if (error) {
    throw new Error('Failed to record read status');
  }
}

/**
 * Returns read engagement stats for an announcement.
 */
export async function getAnnouncementReadStats(params: {
  announcementId: string;
}): Promise<{ totalReads: number; firstReadAt: string | null; lastReadAt: string | null }> {
  const adminClient = createAdminClient();

  const { count, error } = await adminClient
    .from('announcement_reads')
    .select('id', { count: 'exact', head: true })
    .eq('announcement_id', params.announcementId);

  if (error) {
    throw new Error('Failed to fetch engagement stats');
  }

  const { data: firstRead } = await adminClient
    .from('announcement_reads')
    .select('read_at')
    .eq('announcement_id', params.announcementId)
    .order('read_at', { ascending: true })
    .limit(1)
    .single();

  const { data: lastRead } = await adminClient
    .from('announcement_reads')
    .select('read_at')
    .eq('announcement_id', params.announcementId)
    .order('read_at', { ascending: false })
    .limit(1)
    .single();

  return {
    totalReads: count ?? 0,
    firstReadAt: (firstRead?.read_at as string | undefined) ?? null,
    lastReadAt: (lastRead?.read_at as string | undefined) ?? null,
  };
}
