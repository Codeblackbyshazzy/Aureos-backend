# Aureos API Documentation

Complete API reference for the Aureos backend system.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://your-domain.vercel.app`

## Authentication

Most endpoints require authentication using Supabase JWT tokens. Include the auth token in cookies or the `Authorization` header.

```
Authorization: Bearer <your-jwt-token>
```

## Rate Limits

Rate limits are enforced per user based on their plan:

| Plan    | Requests/Minute |
|---------|----------------|
| Free    | 10             |
| Starter | 30             |
| Pro     | 100            |

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: When the rate limit resets (ISO 8601)

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "retryAfter": 1641234567890
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request body validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `PLAN_LIMIT_EXCEEDED` | 403 | Plan limit reached |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `SERVICE_ERROR` | 503 | External service failure |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Health Check

### GET `/api/health`

Check API status.

**Auth**: None

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-04T12:00:00.000Z"
}
```

---

## Stripe Endpoints

### POST `/api/stripe/create-checkout-session`

Create a Stripe checkout session for subscription purchase.

**Auth**: Required

**Request Body**:
```json
{
  "plan": "starter",
  "interval": "monthly"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "sessionId": "cs_test_xxx"
  }
}
```

---

### POST `/api/stripe/create-portal-session`

Create a Stripe customer portal session for subscription management.

**Auth**: Required

**Response**:
```json
{
  "success": true,
  "data": {
    "url": "https://billing.stripe.com/session/xxx"
  }
}
```

---

### POST `/api/stripe/webhook`

Stripe webhook handler (called by Stripe, not by clients).

**Auth**: Stripe signature verification

**Handled Events**:
- `checkout.session.completed` - Creates subscription record
- `customer.subscription.updated` - Updates subscription status
- `customer.subscription.deleted` - Marks subscription as cancelled
- `invoice.payment_failed` - Marks subscription as past_due

**Response**:
```json
{
  "received": true
}
```

---

## Feedback Endpoints

### POST `/api/projects/[id]/feedback`

Create a new feedback item.

**Auth**: Required (project ownership)

**Request Body**:
```json
{
  "text": "This is user feedback",
  "sourceType": "manual",
  "sourceUrl": "https://example.com"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "project_id": "uuid",
    "text": "This is user feedback",
    "source_type": "manual",
    "source_url": "https://example.com",
    "sentiment": null,
    "created_at": "2024-01-04T12:00:00.000Z",
    "metadata": null,
    "deleted_at": null
  }
}
```

---

### GET `/api/projects/[id]/feedback`

Get paginated feedback items for a project.

**Auth**: Required (project ownership)

**Query Parameters**:
- `page` (optional, default: 1)
- `limit` (optional, default: 20, max: 100)
- `sentiment` (optional): `positive`, `neutral`, or `negative`
- `startDate` (optional): ISO 8601 datetime
- `endDate` (optional): ISO 8601 datetime

**Response**:
```json
{
  "success": true,
  "data": {
    "data": [...],
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

---

### DELETE `/api/projects/[id]/feedback/[feedbackId]`

Soft delete a feedback item.

**Auth**: Required (project ownership)

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Feedback deleted successfully"
  }
}
```

---

## Voting System

### POST `/api/projects/[id]/feedback/[feedbackId]/vote`

Vote for a feedback item.

**Auth**: Required

**Response**:
```json
{
  "success": true,
  "feedback": {
    "id": "uuid",
    "vote_count": 5,
    ...
  },
  "userHasVoted": true
}
```

---

### DELETE `/api/projects/[id]/feedback/[feedbackId]/vote`

Remove a vote from a feedback item.

**Auth**: Required

**Response**:
```json
{
  "success": true,
  "feedback": {
    "id": "uuid",
    "vote_count": 4,
    ...
  },
  "userHasVoted": false
}
```

---

### GET `/api/projects/[id]/feedback/[feedbackId]/votes`

Get paginated list of votes for a feedback item.

**Auth**: Required

**Query Parameters**:
- `page` (optional, default: 1)
- `limit` (optional, default: 20)

**Response**:
```json
{
  "success": true,
  "votes": [
    {
      "id": "uuid",
      "user": { "id": "uuid", "email": "user@example.com" },
      "created_at": "2024-01-04T12:00:00.000Z"
    }
  ],
  "total": 5
}
```

---

## Comments & Discussions

### POST `/api/projects/[id]/feedback/[feedbackId]/comments`

Add a comment to a feedback item.

**Auth**: Required

**Request Body**:
```json
{
  "text": "Great idea!",
  "parentCommentId": "uuid" (optional)
}
```

**Response**:
```json
{
  "success": true,
  "comment": {
    "id": "uuid",
    "text": "Great idea!",
    "user_id": "uuid",
    "created_at": "..."
  }
}
```

---

### GET `/api/projects/[id]/feedback/[feedbackId]/comments`

Get comments for a feedback item with nested replies.

**Auth**: Required

**Query Parameters**:
- `page` (optional, default: 1, top-level comments only)
- `limit` (optional, default: 20)
- `sort` (optional): `newest` or `oldest`

**Response**:
```json
{
  "success": true,
  "comments": [
    {
      "id": "uuid",
      "text": "Top level comment",
      "user": { "id": "uuid", "email": "..." },
      "replies": [
        { "id": "uuid", "text": "Reply", ... }
      ]
    }
  ],
  "total": 10
}
```

---

### PUT `/api/comments/[commentId]`

Update a comment.

**Auth**: Required (author or admin)

**Request Body**:
```json
{
  "text": "Updated text"
}
```

**Response**:
```json
{
  "success": true,
  "comment": {...}
}
```

---

### DELETE `/api/comments/[commentId]`

Soft delete a comment.

**Auth**: Required (author or admin)

**Response**:
```json
{
  "success": true
}
```

---

## Follow/Subscriber System

### POST `/api/projects/[id]/feedback/[feedbackId]/follow`

Follow a feedback item for updates.

**Auth**: Required

**Response**:
```json
{
  "success": true,
  "isFollowing": true,
  "followerCount": 10
}
```

---

### DELETE `/api/projects/[id]/feedback/[feedbackId]/follow`

Unfollow a feedback item.

**Auth**: Required

**Response**:
```json
{
  "success": true,
  "isFollowing": false,
  "followerCount": 9
}
```

---

### GET `/api/projects/[id]/feedback/[feedbackId]/followers`

Get list of followers for a feedback item.

**Auth**: Required

**Response**:
```json
{
  "success": true,
  "followers": [...],
  "total": 10
}
```

---

## Topics/Categories

### POST `/api/projects/[id]/topics`

Create a new topic for a project.

**Auth**: Required (project owner)

**Request Body**:
```json
{
  "name": "Billing",
  "color": "#FF0000",
  "icon": "💰"
}
```

**Response**:
```json
{
  "success": true,
  "topic": {...}
}
```

---

### GET `/api/projects/[id]/topics`

Get all topics for a project.

**Auth**: Required

**Response**:
```json
{
  "success": true,
  "topics": [...]
}
```

---

### POST `/api/projects/[id]/feedback/[feedbackId]/topics`

Assign topics to a feedback item.

**Auth**: Required (project owner)

**Request Body**:
```json
{
  "topicIds": ["uuid1", "uuid2"]
}
```

**Response**:
```json
{
  "success": true,
  "topics": [...]
}
```

---

## Custom Status System

### POST `/api/projects/[id]/statuses`

Create a new status for a project.

**Auth**: Required (project owner)

**Request Body**:
```json
{
  "name": "Under Review",
  "color": "#FFFF00",
  "display_order": 1
}
```

**Response**:
```json
{
  "success": true,
  "status": {...}
}
```

---

### GET `/api/projects/[id]/statuses`

Get all statuses for a project.

**Auth**: Required

**Response**:
```json
{
  "success": true,
  "statuses": [...]
}
```

---

### PUT `/api/projects/[id]/feedback/[feedbackId]/status`

Update the status of a feedback item.

**Auth**: Required (project owner)

**Request Body**:
```json
{
  "statusId": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "feedback": {...}
}
```

---

## AI Clustering & Prioritization

### POST `/api/projects/[id]/cluster`

Cluster similar feedback items using AI.

**Auth**: Required (project ownership, paid plan)

**Response**:
```json
{
  "success": true,
  "data": {
    "clusters": [
      {
        "id": "uuid",
        "project_id": "uuid",
        "name": "Feature Requests",
        "description": "Users requesting new features",
        "feedback_count": 15,
        "priority_score": null,
        "created_at": "2024-01-04T12:00:00.000Z",
        "updated_at": "2024-01-04T12:00:00.000Z"
      }
    ],
    "service": "gemini"
  }
}
```

---

### POST `/api/projects/[id]/prioritize`

Prioritize clusters using AI.

**Auth**: Required (project ownership, paid plan)

**Request Body** (optional):
```json
{
  "clusterIds": ["uuid1", "uuid2"]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "clusters": [...],
    "priorities": [
      {
        "clusterId": "uuid",
        "score": 85,
        "reasoning": "High impact feature with many requests"
      }
    ],
    "service": "gemini"
  }
}
```

---

## Web Import (Pro Only)

### POST `/api/projects/[id]/import/web`

Scrape web pages and extract feedback.

**Auth**: Required (project ownership, Pro plan)

**Request Body**:
```json
{
  "urls": [
    "https://example.com/feedback",
    "https://example.com/reviews"
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "feedbackCount": 2,
    "creditsUsed": 2,
    "feedback": [...]
  }
}
```

---

## Roadmap Endpoints

### GET `/api/projects/[id]/roadmap`

Get roadmap items for a project.

**Auth**: Required (project ownership)

**Query Parameters**:
- `page` (optional, default: 1)
- `limit` (optional, default: 20)
- `status` (optional): `planned`, `in_progress`, `completed`, `cancelled`
- `priority` (optional): `low`, `medium`, `high`, `critical`

**Response**:
```json
{
  "success": true,
  "data": {
    "data": [...],
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

### POST `/api/projects/[id]/roadmap`

Create a roadmap item.

**Auth**: Required (project ownership)

**Request Body**:
```json
{
  "title": "Dark mode support",
  "description": "Add dark mode theme option",
  "status": "planned",
  "priority": "high",
  "clusterId": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "project_id": "uuid",
    "cluster_id": "uuid",
    "title": "Dark mode support",
    "description": "Add dark mode theme option",
    "status": "planned",
    "priority": "high",
    "votes": 0,
    "created_at": "2024-01-04T12:00:00.000Z",
    "updated_at": "2024-01-04T12:00:00.000Z"
  }
}
```

---

### PUT `/api/projects/[id]/roadmap/[itemId]`

Update a roadmap item.

**Auth**: Required (project ownership)

**Request Body** (all fields optional):
```json
{
  "title": "Dark mode support (updated)",
  "status": "in_progress",
  "priority": "critical"
}
```

**Response**:
```json
{
  "success": true,
  "data": {...}
}
```

---

### DELETE `/api/projects/[id]/roadmap/[itemId]`

Delete a roadmap item.

**Auth**: Required (project ownership)

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Roadmap item deleted successfully"
  }
}
```

---

## Public Roadmap

### GET `/api/public/roadmap/[slug]`

Get public roadmap for a project (no auth required).

**Auth**: None

**Response**:
```json
{
  "success": true,
  "data": {
    "project": {
      "name": "My Project",
      "slug": "my-project"
    },
    "roadmap": [
      {
        "id": "uuid",
        "title": "Dark mode support",
        "description": "Add dark mode theme option",
        "status": "planned",
        "priority": "high",
        "votes": 42,
        "created_at": "2024-01-04T12:00:00.000Z",
        "updated_at": "2024-01-04T12:00:00.000Z"
      }
    ]
  }
}
```

---

## Admin Endpoints

All admin endpoints require admin role (email must be in `ADMIN_EMAILS` env var).

### GET `/api/admin/users`

Get all users with statistics.

**Auth**: Required (admin only)

**Query Parameters**:
- `page` (optional, default: 1)
- `limit` (optional, default: 50, max: 100)
- `search` (optional): Search by email
- `sortBy` (optional, default: `created_at`): `created_at`, `last_active_at`, `email`

**Response**:
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "uuid",
        "email": "user@example.com",
        "role": "user",
        "created_at": "2024-01-01T00:00:00.000Z",
        "last_active_at": "2024-01-04T12:00:00.000Z",
        "project_count": 3,
        "total_feedback_items": 150,
        "lifetime_revenue": 174,
        "mrr_contribution": 29
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 50,
    "totalPages": 2
  }
}
```

---

### GET `/api/admin/users/[id]`

Get detailed user profile.

**Auth**: Required (admin only)

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {...},
    "projects": [
      {
        "id": "uuid",
        "name": "My Project",
        "feedback_count": 50,
        "cluster_count": 5,
        "created_at": "2024-01-01T00:00:00.000Z"
      }
    ],
    "subscription_history": [...],
    "api_usage_breakdown": {
      "gemini": {
        "total_spend": 5.23,
        "call_count": 42
      },
      "deepseek": {
        "total_spend": 0.15,
        "call_count": 3
      },
      "firecrawl": {
        "total_spend": 0.50,
        "call_count": 50
      }
    },
    "recent_activity": "2024-01-04T12:00:00.000Z"
  }
}
```

---

### POST `/api/admin/users/[id]/change-plan`

Change a user's plan.

**Auth**: Required (admin only)

**Request Body**:
```json
{
  "plan": "pro"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "User plan changed to pro",
    "plan": "pro"
  }
}
```

---

### GET `/api/admin/subscriptions`

Get subscription analytics.

**Auth**: Required (admin only)

**Response**:
```json
{
  "success": true,
  "data": {
    "active_count": 50,
    "churned_count": 5,
    "revenue_summary": {
      "total_mrr": 2450,
      "total_arr": 29400,
      "revenue_by_plan": {
        "starter": {
          "mrr": 580,
          "arr": 6960
        },
        "pro": {
          "mrr": 1870,
          "arr": 22440
        }
      },
      "revenue_by_interval": {
        "monthly": {
          "count": 30,
          "mrr": 1450
        },
        "yearly": {
          "count": 20,
          "arr": 12000
        }
      }
    },
    "status_distribution": {
      "active": 50,
      "cancelled": 10,
      "past_due": 2,
      "paused": 0
    }
  }
}
```

---

### GET `/api/admin/api-usage`

Get API usage analytics.

**Auth**: Required (admin only)

**Query Parameters**:
- `service` (optional): `gemini`, `deepseek`, `firecrawl`
- `startDate` (optional): ISO 8601 datetime
- `endDate` (optional): ISO 8601 datetime
- `userId` (optional): Filter by user UUID
- `limit` (optional, default: 100, max: 1000)

**Response**:
```json
{
  "success": true,
  "data": {
    "total_usage": 1000,
    "service_breakdown": {
      "gemini": {
        "call_count": 500,
        "total_input_tokens": 100000,
        "total_output_tokens": 50000,
        "estimated_cost": 150.00
      },
      "deepseek": {
        "call_count": 50,
        "total_tokens": 25000,
        "estimated_cost": 12.50
      },
      "firecrawl": {
        "call_count": 450,
        "total_credits": 450,
        "estimated_cost": 450.00
      }
    },
    "top_users": [
      {
        "user_id": "uuid",
        "email": "user@example.com",
        "service": "gemini",
        "spend": 50.00,
        "call_count": 200
      }
    ],
    "cost_trends": [
      {
        "date": "2024-01-01",
        "gemini_cost": 10.00,
        "deepseek_cost": 0.50,
        "firecrawl_cost": 20.00,
        "total": 30.50
      }
    ]
  }
}
```

---

### GET `/api/admin/metrics`

Get dashboard metrics.

**Auth**: Required (admin only)

**Response**:
```json
{
  "success": true,
  "data": {
    "users": {
      "total_all_time": 1000,
      "active_this_month": 500,
      "this_month_new": 50
    },
    "revenue": {
      "current_mrr": 2450.00,
      "arr": 29400.00,
      "growth_rate_percent": 15.5
    },
    "feedback": {
      "total_processed": 50000,
      "avg_per_project": 25.5
    },
    "projects": {
      "total_active": 1500,
      "avg_feedback_per_project": 33.3,
      "avg_clusters_per_project": 4.2
    },
    "conversion": {
      "free_to_paid_count": 100,
      "conversion_rate_percent": 10.0
    },
    "plans": {
      "free_count": 900,
      "starter_count": 70,
      "pro_count": 30
    }
  }
}
```

---

## Plan Limits

| Feature | Free | Starter | Pro |
|---------|------|---------|-----|
| Feedback items | 50 | 500 | 10,000 |
| AI clustering | ❌ | ✅ | ✅ |
| AI prioritization | ❌ | ✅ | ✅ |
| Web scraping | ❌ | ❌ | ✅ |
| Requests/minute | 10 | 30 | 100 |

---

## Webhook Events

### Stripe Webhooks

Configure these events in your Stripe Dashboard:

| Event | Description |
|-------|-------------|
| `checkout.session.completed` | User completed checkout, subscription created |
| `customer.subscription.updated` | Subscription status or period updated |
| `customer.subscription.deleted` | Subscription cancelled |
| `invoice.payment_failed` | Payment failed, subscription marked past_due |

---

## Best Practices

1. **Always handle rate limits**: Check for 429 status and `Retry-After` header
2. **Implement exponential backoff**: For AI service calls that may fail
3. **Validate input**: Use provided schemas for request validation
4. **Monitor costs**: Track AI usage via admin endpoints
5. **Test webhooks locally**: Use Stripe CLI during development
6. **Secure admin access**: Keep `ADMIN_EMAILS` secure and up to date
7. **Use pagination**: For endpoints returning large datasets
8. **Cache where appropriate**: Reduce API calls for non-sensitive data

---

## Phase 2: Feature Parity Endpoints

### OpenAPI

A minimal OpenAPI specification is available at:

- `GET /api/openapi`

### Announcements / Changelog

- `POST /api/projects/[id]/announcements` - Create announcement
- `GET /api/projects/[id]/announcements` - List announcements (pagination + optional search)
- `GET /api/projects/[id]/announcements/[announcementId]` - Get announcement (records read)
- `PUT /api/projects/[id]/announcements/[announcementId]` - Update announcement
- `DELETE /api/projects/[id]/announcements/[announcementId]` - Delete announcement
- `POST /api/projects/[id]/announcements/[announcementId]/publish` - Publish announcement
- `POST /api/projects/[id]/announcements/[announcementId]/subscribers` - Subscribe/unsubscribe
- `GET /api/projects/[id]/announcements/[announcementId]/reads` - Read engagement stats

### Single Sign-On (SSO)

- `POST /api/projects/[id]/sso/configure` - Configure SSO provider
- `GET /api/projects/[id]/sso/config` - Get SSO configuration
- `POST /api/auth/sso/authorize` - Initiate SSO flow
- `POST /api/auth/sso/callback` - Handle SSO callback
- `POST /api/auth/sso/logout` - Logout from SSO session

### Email Notifications

- `POST /api/projects/[id]/email-templates` - Create email template
- `GET /api/projects/[id]/email-templates` - List email templates
- `PUT /api/projects/[id]/email-templates/[templateId]` - Update email template
- `POST /api/projects/[id]/email-send` - Send email
- `GET /api/users/email-preferences` - Get user notification preferences
- `PUT /api/users/email-preferences` - Update user notification preferences

### Webhooks

- `POST /api/projects/[id]/webhooks` - Create webhook endpoint
- `GET /api/projects/[id]/webhooks` - List webhooks
- `PUT /api/projects/[id]/webhooks/[webhookId]` - Update webhook
- `DELETE /api/projects/[id]/webhooks/[webhookId]` - Delete webhook
- `POST /api/projects/[id]/webhooks/[webhookId]/test` - Send test webhook
- `GET /api/projects/[id]/webhooks/[webhookId]/deliveries` - Delivery logs
- `POST /api/webhooks/events` - Trigger webhook events (admin/internal)

### Guest Authentication

- `POST /api/projects/[id]/guest-access` - Create guest access token
- `GET /api/projects/[id]/guest-access` - List active guest sessions
- `DELETE /api/projects/[id]/guest-access/[sessionId]` - Revoke guest access
- `POST /api/auth/guest/verify` - Verify and use guest token

---

## Support

For issues or questions about the API, please refer to the main [README.md](./README.md) or open an issue in the repository.
