# Aureos Backend API

Production-ready backend system for Aureos that enables indie hackers to collect feedback, cluster it using AI, and build public roadmaps. Includes a comprehensive admin backend for monitoring subscriptions, users, and API usage.

## Features

### Core Features
- **Feedback Collection**: Manual entry, imports, API integration, and web scraping
- **AI-Powered Clustering**: Automatic grouping of similar feedback using Google Gemini (with DeepSeek fallback)
- **Smart Prioritization**: AI-driven priority scoring for feedback clusters
- **Public Roadmaps**: Share your product roadmap with users
- **Web Scraping**: Extract feedback from web pages (Pro plan only) using Firecrawl

### Admin Features
- **User Management**: View all users with statistics, revenue metrics, and activity
- **Subscription Analytics**: Track MRR, ARR, churn, and revenue by plan/interval
- **API Usage Monitoring**: Monitor AI service usage, costs, and trends
- **Dashboard Metrics**: High-level KPIs for business health

### Payment & Plans
- **Free Plan**: 50 feedback items, basic features
- **Starter Plan**: 500 feedback items, AI clustering & prioritization
- **Pro Plan**: 10,000 feedback items, everything + web scraping

## Tech Stack

- **Framework**: Next.js 14+ (App Router, API routes only)
- **Database & Auth**: Supabase (PostgreSQL + Row Level Security)
- **Language**: TypeScript (strict mode)
- **Payments**: Stripe (with webhook integration)
- **AI Services**: Google Gemini (primary), DeepSeek (fallback)
- **Web Scraping**: Firecrawl API
- **Deployment**: Vercel-ready

## Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Stripe account
- Google Gemini API key
- DeepSeek API key (optional, for fallback)
- Firecrawl API key (for Pro plan web scraping)

## Installation & Setup

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd aureos-backend
npm install
```

### 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API to get your credentials
3. Run the migration to create the database schema:
   - Go to SQL Editor in Supabase Dashboard
   - Copy contents of `supabase/migrations/20240101000000_initial_schema.sql`
   - Execute the SQL
4. Your database tables, indexes, RLS policies, and triggers are now set up

### 3. Stripe Setup

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Create products and prices:
   - **Starter Monthly**: Create a recurring product with monthly billing
   - **Starter Yearly**: Same product, yearly billing
   - **Pro Monthly**: Create another recurring product with monthly billing
   - **Pro Yearly**: Same product, yearly billing
3. Copy the Price IDs (they look like `price_xxxxx`)
4. Get your API keys from Stripe Dashboard > Developers > API keys
5. Set up webhook endpoint:
   - Install Stripe CLI: `brew install stripe/stripe-cli/stripe` (or see Stripe docs)
   - For local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
   - Copy the webhook signing secret (starts with `whsec_`)
   - For production: Add webhook endpoint in Stripe Dashboard pointing to your deployed URL

### 4. AI Services Setup

#### Google Gemini
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Copy the key (starts with `AI...`)

#### DeepSeek (Optional)
1. Sign up at [DeepSeek Platform](https://platform.deepseek.com)
2. Generate an API key
3. Copy the key

#### Firecrawl (Pro Plan Feature)
1. Sign up at [Firecrawl](https://www.firecrawl.dev)
2. Subscribe to Pro tier
3. Get your API key from the dashboard

### 5. Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in all the required values:

```env
# Supabase (from Project Settings > API)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Admin Emails (comma-separated)
ADMIN_EMAILS=admin@yourdomain.com,owner@yourdomain.com

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Stripe Price IDs
STRIPE_PRICE_STARTER_MONTHLY=price_xxx
STRIPE_PRICE_STARTER_YEARLY=price_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_YEARLY=price_xxx

# AI Services
GEMINI_API_KEY=AIxxx
DEEPSEEK_API_KEY=sk-xxx
FIRECRAWL_API_KEY=fc-xxx

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 6. Create First Admin User

1. Start the development server: `npm run dev`
2. Sign up with one of the emails listed in `ADMIN_EMAILS`
3. The system will automatically assign admin role
4. You can now access admin endpoints

### 7. Run the Application

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

Check health: `http://localhost:3000/api/health`

## API Documentation

See [API_DOCS.md](./API_DOCS.md) for complete API reference with:
- All endpoints with request/response examples
- Authentication requirements
- Rate limits per plan
- Error codes and handling
- Webhook specifications

## Testing

### Manual API Testing

Use tools like Postman, Insomnia, or cURL to test endpoints:

```bash
# Health check
curl http://localhost:3000/api/health

# Create feedback (requires auth)
curl -X POST http://localhost:3000/api/projects/{project-id}/feedback \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{"text": "Great feature request!"}'
```

### Stripe Webhook Testing

Use Stripe CLI for local webhook testing:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Trigger test events:

```bash
stripe trigger checkout.session.completed
```

## Deployment to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Add all environment variables from `.env.local`
4. Deploy

### 3. Update Stripe Webhook

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://your-domain.vercel.app/api/stripe/webhook`
3. Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
4. Copy the webhook signing secret
5. Update `STRIPE_WEBHOOK_SECRET` in Vercel environment variables

### 4. Update App URL

Update `NEXT_PUBLIC_APP_URL` in Vercel to your production URL.

## Project Structure

```
/app
  /api
    /health              # Health check endpoint
    /stripe              # Stripe integration (checkout, portal, webhooks)
    /projects/[id]       # Project-specific endpoints
      /feedback          # Feedback CRUD
      /cluster           # AI clustering
      /prioritize        # AI prioritization
      /roadmap           # Roadmap management
      /import/web        # Web scraping
    /public
      /roadmap/[slug]    # Public roadmap view
    /admin               # Admin-only endpoints
      /users             # User management
      /subscriptions     # Subscription analytics
      /api-usage         # API usage monitoring
      /metrics           # Dashboard metrics
/lib
  /ai-services           # AI service wrappers (Gemini, DeepSeek, Firecrawl)
  auth.ts                # Authentication helpers
  supabase.ts            # Supabase client configuration
  stripe.ts              # Stripe integration helpers
  validation.ts          # Zod schemas for request validation
  rate-limiter.ts        # Rate limiting logic
  usage-logger.ts        # API usage logging
  project-utils.ts       # Project helper functions
  errors.ts              # Error handling utilities
/types
  index.ts               # TypeScript type definitions
/supabase
  /migrations            # Database migration files
```

## Security Features

- **Row Level Security (RLS)**: Database-level access control
- **JWT Authentication**: Supabase Auth with secure tokens
- **Rate Limiting**: Per-user, per-plan rate limits
- **Input Validation**: Zod schemas on all endpoints
- **Webhook Signature Verification**: Stripe webhook security
- **Admin Role Enforcement**: Email-based admin access control
- **Soft Deletes**: Preserve data integrity

## Rate Limits

- **Free**: 10 requests/minute
- **Starter**: 30 requests/minute
- **Pro**: 100 requests/minute

Rate limit headers are included in all responses.

## Cost Estimates

The system logs estimated costs for all AI service usage:

- **Gemini**: ~$0.000001/input token, ~$0.000002/output token
- **DeepSeek**: ~$0.0000005/token
- **Firecrawl**: ~$0.01/credit

Configure rates in environment variables for accurate tracking.

## Troubleshooting

### Database Connection Issues
- Verify Supabase credentials in `.env.local`
- Check if migration was run successfully
- Ensure RLS policies are enabled

### Stripe Webhook Failures
- Verify webhook secret matches Stripe Dashboard
- Check webhook endpoint is accessible
- Review Stripe logs for delivery attempts

### AI Service Errors
- Verify API keys are valid
- Check rate limits on AI provider dashboards
- Review fallback logic is working (Gemini → DeepSeek)

### Rate Limiting Issues
- Check plan limits are configured correctly
- Verify rate limiter is working in development
- Consider implementing Redis for production

## Support & Contributing

For issues, questions, or contributions, please open an issue or pull request in the repository.

## License

[Your License Here]
