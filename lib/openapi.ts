export interface OpenApiSpec {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
}

/**
 * Minimal OpenAPI specification for Phase 2 endpoints.
 */
export function getOpenApiSpec(): OpenApiSpec {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Aureos API',
      version: '2.0.0',
    },
    paths: {
      '/api/projects/{projectId}/announcements': {
        get: { summary: 'List announcements' },
        post: { summary: 'Create announcement' },
      },
      '/api/projects/{projectId}/announcements/{announcementId}': {
        get: { summary: 'Get announcement' },
        put: { summary: 'Update announcement' },
        delete: { summary: 'Delete announcement' },
      },
      '/api/projects/{projectId}/announcements/{announcementId}/publish': {
        post: { summary: 'Publish announcement' },
      },
      '/api/projects/{projectId}/announcements/{announcementId}/subscribers': {
        post: { summary: 'Subscribe to announcements' },
      },
      '/api/projects/{projectId}/announcements/{announcementId}/reads': {
        get: { summary: 'Get announcement read engagement' },
      },

      '/api/projects/{projectId}/sso/configure': {
        post: { summary: 'Configure SSO provider' },
      },
      '/api/projects/{projectId}/sso/config': {
        get: { summary: 'Get SSO configuration' },
      },
      '/api/auth/sso/authorize': {
        post: { summary: 'Initiate SSO flow' },
      },
      '/api/auth/sso/callback': {
        post: { summary: 'Handle SSO callback' },
      },
      '/api/auth/sso/logout': {
        post: { summary: 'Logout from SSO session' },
      },

      '/api/projects/{projectId}/email-templates': {
        get: { summary: 'List email templates' },
        post: { summary: 'Create email template' },
      },
      '/api/projects/{projectId}/email-templates/{templateId}': {
        put: { summary: 'Update email template' },
      },
      '/api/projects/{projectId}/email-send': {
        post: { summary: 'Send email' },
      },
      '/api/users/email-preferences': {
        get: { summary: 'Get user email preferences' },
        put: { summary: 'Update user email preferences' },
      },

      '/api/projects/{projectId}/webhooks': {
        get: { summary: 'List webhooks' },
        post: { summary: 'Create webhook' },
      },
      '/api/projects/{projectId}/webhooks/{webhookId}': {
        put: { summary: 'Update webhook' },
        delete: { summary: 'Delete webhook' },
      },
      '/api/projects/{projectId}/webhooks/{webhookId}/test': {
        post: { summary: 'Send test webhook' },
      },
      '/api/projects/{projectId}/webhooks/{webhookId}/deliveries': {
        get: { summary: 'Get webhook delivery logs' },
      },
      '/api/webhooks/events': {
        post: { summary: 'Trigger webhook event (internal)' },
      },

      '/api/projects/{projectId}/guest-access': {
        get: { summary: 'List active guest sessions' },
        post: { summary: 'Create guest access token' },
      },
      '/api/projects/{projectId}/guest-access/{sessionId}': {
        delete: { summary: 'Revoke guest access' },
      },
      '/api/auth/guest/verify': {
        post: { summary: 'Verify guest token' },
      },
    },
  };
}
