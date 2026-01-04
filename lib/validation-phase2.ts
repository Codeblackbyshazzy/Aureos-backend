import { z } from 'zod';

export const announcementStatusSchema = z.enum(['draft', 'scheduled', 'published']);

export const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(20000),
  categoryId: z.string().uuid().optional().nullable(),
  status: announcementStatusSchema.exclude(['published']).optional(),
  scheduledFor: z.string().datetime().optional(),
});

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(20000).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  status: announcementStatusSchema.exclude(['published']).optional(),
  scheduledFor: z.string().datetime().optional().nullable(),
});

export const announcementListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: announcementStatusSchema.optional(),
  q: z.string().min(1).max(200).optional(),
});

export const subscribeToAnnouncementsSchema = z.object({
  subscribed: z.boolean().optional().default(true),
});

export const configureSsoSchema = z
  .object({
    providerType: z.enum(['oidc', 'saml']),
    name: z.string().min(1).max(120),
    enabled: z.boolean().optional().default(true),
    attributeMapping: z.record(z.string()).optional().default({}),

    oidc: z
      .object({
        issuerUrl: z.string().url(),
        clientId: z.string().min(1),
        clientSecret: z.string().min(1),
        redirectUrl: z.string().url(),
        scopes: z.array(z.string().min(1)).optional(),
      })
      .optional(),

    saml: z
      .object({
        entityId: z.string().min(1),
        ssoUrl: z.string().url(),
        certificate: z.string().min(1),
      })
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (val.providerType === 'oidc' && !val.oidc) {
      ctx.addIssue({ code: 'custom', path: ['oidc'], message: 'OIDC configuration required' });
    }
    if (val.providerType === 'saml' && !val.saml) {
      ctx.addIssue({ code: 'custom', path: ['saml'], message: 'SAML configuration required' });
    }
  });

export const ssoAuthorizeSchema = z.object({
  projectId: z.string().uuid(),
});

export const ssoCallbackSchema = z.object({
  projectId: z.string().uuid(),
  state: z.string().min(8).max(512),
  providerType: z.enum(['oidc', 'saml']),
  code: z.string().min(1).optional(),
  idToken: z.string().min(1).optional(),
  email: z.string().email().optional(),
  externalUserId: z.string().min(1).optional(),
});

export const ssoLogoutSchema = z.object({
  sessionId: z.string().uuid(),
});

export const createEmailTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  subject: z.string().min(1).max(200),
  bodyHtml: z.string().min(1).max(200000).optional(),
  bodyText: z.string().min(1).max(200000).optional(),
});

export const updateEmailTemplateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  subject: z.string().min(1).max(200).optional(),
  bodyHtml: z.string().min(1).max(200000).optional().nullable(),
  bodyText: z.string().min(1).max(200000).optional().nullable(),
});

export const sendEmailSchema = z.object({
  to: z.string().email(),
  templateId: z.string().uuid().optional(),
  subject: z.string().min(1).max(200).optional(),
  variables: z.record(z.string()).optional().default({}),
  html: z.string().min(1).max(200000).optional(),
  text: z.string().min(1).max(200000).optional(),
});

export const emailPreferencesSchema = z.object({
  announcementsEnabled: z.boolean().optional(),
  feedbackEnabled: z.boolean().optional(),
  marketingEnabled: z.boolean().optional(),
});

export const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string().min(1)).min(1).max(50),
  isActive: z.boolean().optional().default(true),
});

export const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string().min(1)).min(1).max(50).optional(),
  isActive: z.boolean().optional(),
  rotateSecret: z.boolean().optional().default(false),
});

export const webhookDeliveriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const triggerWebhookEventSchema = z.object({
  projectId: z.string().uuid(),
  event: z.string().min(1).max(120),
  payload: z.record(z.unknown()).default({}),
});

export const createGuestAccessSchema = z
  .object({
    permissions: z.array(z.string().min(1)).default([]),
    expiresInMinutes: z.coerce.number().int().min(1).max(60 * 24 * 30).optional(),
    expiresAt: z.string().datetime().optional(),
    oneTime: z.boolean().optional().default(false),
  })
  .superRefine((val, ctx) => {
    if (!val.expiresAt && !val.expiresInMinutes) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiresInMinutes'],
        message: 'expiresInMinutes or expiresAt is required',
      });
    }
  });

export const verifyGuestTokenSchema = z.object({
  token: z.string().min(20).max(2000),
});
