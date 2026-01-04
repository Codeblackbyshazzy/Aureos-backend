import { z } from 'zod';

export const voteSchema = z.object({});

export const commentSchema = z.object({
  text: z.string().min(1).max(5000),
  parentCommentId: z.string().uuid().optional()
});

export const commentUpdateSchema = z.object({
  text: z.string().min(1).max(5000)
});

export const topicSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional().nullable(),
  icon: z.string().max(50).optional().nullable()
});

export const statusSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-F]{6}$/i),
  icon: z.string().max(50).optional().nullable(),
  display_order: z.number().int().min(0).optional()
});

export const feedbackTopicsSchema = z.object({
  topicIds: z.array(z.string().uuid()).max(10)
});

export const feedbackStatusUpdateSchema = z.object({
  statusId: z.string().uuid()
});
