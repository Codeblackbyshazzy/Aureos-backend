# Aureos Backend API

Production-ready backend system for Aureos that enables indie hackers to collect feedback, cluster it using AI, and build public roadmaps. Includes a comprehensive admin backend for monitoring subscriptions, users, and API usage.

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Available Scripts & Commands](#available-scripts--commands)
- [Environment Variables Setup](#environment-variables-setup)
- [Supabase Setup](#supabase-setup-step-by-step)
- [Stripe Setup](#stripe-setup-step-by-step)
- [AI Services Setup](#ai-services-setup-step-by-step)
- [Admin User Setup](#admin-user-setup)
- [Running Locally](#running-locally)
- [Building & Deploying](#building--deploying)
- [Code Quality & Pre-commit](#code-quality--pre-commit)
- [API Documentation](#api-documentation)
- [Testing Endpoints](#testing-endpoints-local-development)
- [Database Schema Overview](#database-schema-overview)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)
- [Support & Contributing](#support--contributing)

## Project Overview

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

- **Framework**: Next.js 16+ (App Router, API routes only)
- **Database & Auth**: Supabase (PostgreSQL + Row Level Security)
- **Language**: TypeScript (strict mode)
- **Payments**: Stripe (with webhook integration)
- **AI Services**: Google Gemini (primary), DeepSeek (fallback)
- **Web Scraping**: Firecrawl API
- **Deployment**: Vercel-ready
- **Linting**: ESLint with Next.js configuration

## Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Version 8 or higher (comes with Node.js)
- **Git**: Version 2.0 or higher
- **Supabase Account**: Required for database and authentication
- **Stripe Account**: Required for payment processing
- **Google AI Studio Account**: Required for AI clustering
- **DeepSeek Account** (optional): Recommended for AI fallback
- **Firecrawl Account** (optional): Required for web scraping feature

## Installation & Setup

### Clone and Set Up Repository

```bash
# Clone the repository
git clone https://github.com/Codeblackbyshazzy/Aureos-backend.git
cd Aureos-backend

# Install all dependencies
npm install

# Copy the environment template file
cp .env.example .env.local
```

### 2. Supabase Setup (Step-by-Step)

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com) and sign in
   - Click "New Project" and enter your project details
   - Wait for the project to be provisioned

2. **Get Your Credentials**
   - Go to Project Settings > API
   - Copy the following:
     - **Project URL** (e.g., `https://xxxxx.supabase.co`)
     - **anon public key** (starts with `eyJ`)
     - **service_role key** (under Service Keys, also starts with `eyJ`)

3. **Run Database Migrations**
   The database schema is defined in `/supabase/migrations/` directory. Apply the migrations using Supabase CLI:

   ```bash
   # Install Supabase CLI if you don't have it
   npm install -g supabase

   # Login to Supabase
   supabase login

   # Link your project (follow the prompts)
   supabase link --project-id your-project-id

   # Run all pending migrations
   supabase db push
   ```

4. **Verify Created Tables**
   After running migrations, your database should include:
   - `users` - User profiles
   - `projects` - User projects with plan information
   - `feedback_items` - Individual feedback entries
   - `feedback_clusters` - AI-generated feedback clusters
   - `cluster_feedback_items` - Junction table for clusters
   - `roadmap_items` - Public roadmap entries
   - `api_usage_logs` - AI service usage tracking
   - `subscriptions` - Stripe subscription data

5. **Row Level Security (RLS)**
   The migrations include RLS policies that restrict data access. Verify RLS is enabled on all tables in the Supabase dashboard under Authentication > Policies.

### 3. Stripe Setup (Step-by-Step)

1. **Create Stripe Account**
   - Sign up at [stripe.com](https://stripe.com)
   - Complete the onboarding process
   - Switch to Test Mode (toggle in top right)

2. **Create Products and Prices**
   Go to Stripe Dashboard > Products and create the following products:

   **Starter Plan:**
   - Product name: "Starter Plan"
   - Create two prices:
     - Monthly: $X/month (recurring)
     - Yearly: $Y/year (recurring)

   **Pro Plan:**
   - Product name: "Pro Plan"
   - Create two prices:
     - Monthly: $X/month (recurring)
     - Yearly: $Y/year (recurring)

3. **Get Price IDs**
   - After creating prices, click on each price to view its details
   - Copy the Price ID (format: `price_xxxxx`)
   - You'll need these for your environment variables

4. **Get API Keys**
   - Go to Stripe Dashboard > Developers > API keys
   - Copy your **Secret key** (starts with `sk_test_`)
   - Copy your **Publishable key** (starts with `pk_test_`)

5. **Set Up Webhook for Production**
   - Go to Stripe Dashboard > Developers > Webhooks
   - Add endpoint: `https://your-domain.vercel.app/api/stripe/webhook`
   - Select these events:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
   - Copy the webhook signing secret (starts with `whsec_`)

6. **Test Webhooks Locally (Optional)**
   ```bash
   # Install Stripe CLI
   # macOS: brew install stripe/stripe-cli/stripe
   # Linux: See https://stripe.com/docs/stripe-cli/install

   # Login to Stripe CLI
   stripe login

   # Listen for webhook events locally
   stripe listen --forward-to localhost:3000/api/stripe/webhook

   # In another terminal, trigger test events
   stripe trigger checkout.session.completed
   ```

### 4. AI Services Setup (Step-by-Step)

#### Google Gemini API (Primary AI Service)

1. **Get API Key**
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Sign in with your Google account
   - Click "Create API Key" or use an existing one
   - Copy the key (starts with `AI...`)

2. **Add to Environment**
   ```env
   GEMINI_API_KEY=AI_your_gemini_api_key
   ```

#### DeepSeek API (Fallback AI Service)

1. **Create Account**
   - Sign up at [DeepSeek Platform](https://platform.deepseek.com)
   - Verify your email

2. **Generate API Key**
   - Go to API Keys section in dashboard
   - Click "Create New API Key"
   - Give it a name (e.g., "Aureos Backend")
   - Copy the key (starts with `sk-...`)

3. **Add to Environment**
   ```env
   DEEPSEEK_API_KEY=sk_your_deepseek_api_key
   ```

#### Firecrawl API (Web Scraping - Pro Plan)

1. **Sign Up**
   - Go to [Firecrawl](https://www.firecrawl.dev)
   - Create an account

2. **Get API Key**
   - Subscribe to Pro tier (required for web scraping)
   - Go to dashboard and copy your API key

3. **Add to Environment**
   ```env
   FIRECRAWL_API_KEY=fc_your_firecrawl_api_key
   ```

### 5. Environment Variables Setup

After copying `.env.example` to `.env.local`, fill in all variables:

```env
# Supabase Configuration (from Project Settings > API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Admin Configuration (your email for admin access)
ADMIN_EMAILS=your-admin-email@example.com

# Stripe Configuration (from Stripe Dashboard)
STRIPE_SECRET_KEY=sk_test_your_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Stripe Price IDs (from Products in Stripe)
STRIPE_PRICE_STARTER_MONTHLY=price_your_starter_monthly
STRIPE_PRICE_STARTER_YEARLY=price_your_starter_yearly
STRIPE_PRICE_PRO_MONTHLY=price_your_pro_monthly
STRIPE_PRICE_PRO_YEARLY=price_your_pro_yearly

# AI Services
GEMINI_API_KEY=AI_your_gemini_key
DEEPSEEK_API_KEY=sk_your_deepseek_key
FIRECRAWL_API_KEY=fc_your_firecrawl_key

# Optional: Cost Tracking (defaults shown)
GEMINI_INPUT_TOKEN_COST=0.000001
GEMINI_OUTPUT_TOKEN_COST=0.000002
DEEPSEEK_TOKEN_COST=0.0000005
FIRECRAWL_CREDIT_COST=0.01

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 6. Admin User Setup

1. **Set Admin Email**
   - Add your email to the `ADMIN_EMAILS` variable in `.env.local`
   - Format: `email1@example.com,email2@example.com` (comma-separated, no spaces)

2. **Create Account**
   - Start the development server: `npm run dev`
   - Sign up with one of the admin emails via the signup endpoint
   - The system automatically assigns admin role based on your email

3. **Verify Admin Access**
   - Test admin endpoints (they start with `/api/admin/`)
   - Access to admin endpoints is protected by email verification

## Available Scripts & Commands

This project includes the following npm scripts for development, testing, and deployment:

### Development
```bash
# Start development server (runs on http://localhost:3000)
npm run dev
```
Starts the Next.js development server with hot reloading. Use this during active development.

### Building & Production
```bash
# Build for production
npm run build

# Start production server (requires successful build first)
npm start
```

`npm run build` creates an optimized production build. `npm start` runs the compiled production server.

### Code Quality
```bash
# Linting - check for code style issues
npm run lint

# Linting - automatically fix fixable code style issues
npm run lint:fix

# Type checking - verify TypeScript types without emitting files
npm run type-check
```

### Pre-deployment Commands

Before deploying, run these commands to catch issues:

```bash
# 1. Run type checking to catch TypeScript errors
npm run type-check

# 2. Run linter to catch style issues
npm run lint

# 3. Build to catch compilation errors
npm run build
```

## Running Locally

```bash
# Start the development server
npm run dev
```

Expected output:
```
ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

Access points:
- **Base URL**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health

If the server starts successfully, you should see "OK" when visiting the health endpoint.

## Building & Deploying

### Local Build Testing

Before deploying to production, test your build locally:

```bash
# 1. Build the project
npm run build

# If build succeeds, you'll see:
# ✓ Linting and checking validity of types
# ✓ Creating an optimized production build
# ✓ Compiled successfully

# 2. Start production server
npm start

# 3. Test that it works at http://localhost:3000
```

### Deployment to Vercel

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Deploy to production"
   git push origin main
   ```

2. **Deploy Steps**
   - Go to [vercel.com](https://vercel.com)
   - Sign in and connect your GitHub account
   - Click "New Project" and import your repository
   - Add all environment variables from `.env.local` in the Vercel dashboard
   - Click "Deploy"

3. **Post-Deployment**
   - Update your Stripe webhook URL to point to your Vercel domain
   - Update `NEXT_PUBLIC_APP_URL` in Vercel to your production URL
   - Test all functionality

### Environment Variables for Production

When deploying to Vercel or any other platform, ensure these environment variables are added:

- All Supabase credentials
- All Stripe credentials including price IDs
- All AI service API keys
- Admin emails
- Application URL

## Code Quality & Pre-commit

To ensure code quality before committing:

1. **Run Type Checking**
   ```bash
   npm run type-check
   ```
   This catches TypeScript errors without building.

2. **Run the Linter**
   ```bash
   npm run lint
   ```
   This checks for code style and potential issues.

3. **Run the Build**
   ```bash
   npm run build
   ```
   This catches compilation errors.

4. **Fix Any Issues**
   - Address all linting errors
   - Fix TypeScript type errors
   - Test your changes locally

Following this pre-deployment checklist ensures your code will build and deploy successfully.

## API Documentation

Complete API documentation is available in [API_DOCS.md](./API_DOCS.md).

The API includes:
- Authentication endpoints (signup, login, logout)
- Feedback management (CRUD operations)
- AI-powered clustering and prioritization
- Public roadmap endpoints
- Web scraping (Pro plan)
- Admin endpoints for user/subscription management
- Stripe integration endpoints

## Testing Endpoints (Local Development)

### Using cURL

```bash
# Health check
curl http://localhost:3000/api/health
# Expected: {"status":"OK"}

# Create a new user (signup)
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"securepassword"}'
```

### Using Postman

1. Import collection from API_DOCS.md
2. Set base URL to `http://localhost:3000`
3. For authenticated endpoints, extract the auth cookie from signup/login response

### Testing Authenticated Endpoints

After signup/login, include the auth cookie in subsequent requests:

```bash
curl -X POST http://localhost:3000/api/projects/{project-id}/feedback \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{"text": "This is test feedback"}'
```

## Database Schema Overview

Main tables created by migrations:

- **users**: User profiles synced from Supabase Auth
- **projects**: User projects with associated plans
- **feedback_items**: Individual feedback submissions
- **feedback_clusters**: AI-generated clusters of similar feedback
- **cluster_feedback_items**: Many-to-many link between clusters and feedback
- **roadmap_items**: Items displayed on public roadmaps
- **api_usage_logs**: Logs of all AI service usage for cost tracking
- **subscriptions**: Stripe subscription data

For detailed schema, see migration files in `/supabase/migrations/`.

## Troubleshooting

### Common Issues and Solutions

#### "Cannot find module" Error
**Problem**: Module not found when running the app
**Solution**: Run `npm install` to ensure all dependencies are installed

#### "Supabase connection failed"
**Problem**: Cannot connect to Supabase
**Solutions**:
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`
- Check that your Supabase project is active
- Ensure migrations have been run

#### "Stripe webhook not working"
**Problem**: Stripe webhooks return errors
**Solutions**:
- Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
- For local testing, run `stripe listen --forward-to localhost:3000/api/stripe/webhook`
- Check webhook endpoint is accessible from Stripe's servers (for production)

#### "Admin endpoint returns 403"
**Problem**: Cannot access admin endpoints
**Solutions**:
- Verify your email is listed in `ADMIN_EMAILS` environment variable
- Ensure you're using the same email for signup
- Restart the server after changing environment variables

#### "Build fails with TypeScript errors"
**Problem**: `npm run build` fails
**Solutions**:
- Run `npx tsc --noEmit` to see all TypeScript errors
- Fix type errors before building
- Check for any missing imports or incorrect types

#### "Linting errors prevent commit"
**Problem**: ESLint errors in your code
**Solutions**:
- Run `npm run lint` to see all issues
- Fix eslint errors manually
- Ensure consistent code style

#### "AI clustering returns errors"
**Problem**: AI services failing
**Solutions**:
- Verify `GEMINI_API_KEY` is valid and has quota
- Test API key directly with provider
- Check fallback to DeepSeek is working if configured

#### "Rate limiting too strict"
**Problem**: Getting 429 errors too frequently
**Solutions**:
- Verify your plan's rate limit in environment variables
- Check that rate limiter is correctly identifying your plan
- Increase limits in `.env.local` (for self-hosted)

## Project Structure

```
/app
  /api                    # All API endpoints
    /health               # Health check endpoint
    /auth                 # Authentication endpoints (signup, login, logout)
    /stripe               # Stripe integration
      /checkout           # Checkout session creation
      /portal             # Customer portal
      /webhook            # Webhook handler
    /projects/[id]        # Project-specific endpoints
      /feedback           # Feedback CRUD operations
      /cluster           # AI clustering endpoint
      /prioritize        # AI prioritization endpoint
      /roadmap           # Roadmap management
      /import            # Import functionality
        /web             # Web scraping (Pro plan only)
    /public               # Public endpoints
      /roadmap/[slug]    # Public roadmap view
    /admin                # Admin-only endpoints (require admin email)
      /users             # User management and statistics
      /subscriptions     # Subscription analytics
      /api-usage         # API usage monitoring
      /metrics           # Dashboard metrics
/lib
  /ai-services           # AI service wrappers
    gemini.ts           # Google Gemini integration
    deepseek.ts         # DeepSeek integration
    firecrawl.ts        # Firecrawl web scraping
  auth.ts               # Authentication helpers (requireAuth, requireAdmin)
  supabase.ts           # Supabase client configuration
  stripe.ts             # Stripe integration helpers
  validation.ts         # Zod validation schemas
  rate-limiter.ts       # Rate limiting per plan
  usage-logger.ts       # AI usage and cost tracking
  project-utils.ts      # Project helper functions
  errors.ts             # Error handling utilities
/types
  index.ts              # TypeScript type definitions
/supabase
  /migrations            # Database migration files
/middleware              # Next.js middleware (if any)
```

## Security Features

- **Row Level Security (RLS)**: Database-level access control on all tables
- **JWT Authentication**: Supabase Auth with secure HTTP-only cookies
- **Rate Limiting**: Per-user, per-plan rate limits (Free: 10/min, Starter: 30/min, Pro: 100/min)
- **Input Validation**: Zod schemas validate all incoming requests
- **Webhook Signature Verification**: Stripe webhooks are verified for authenticity
- **Admin Role Enforcement**: Email-based admin access control
- **Soft Deletes**: Data integrity preserved with deleted_at timestamps

## Rate Limits

Rate limits are enforced per plan and included in response headers:

- **Free Plan**: 10 requests/minute
- **Starter Plan**: 30 requests/minute
- **Pro Plan**: 100 requests/minute

Response headers include:
- `X-RateLimit-Limit`: Your plan's limit
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: When the rate limit window resets

When rate limited, the API returns HTTP 429 with a `Retry-After` header.

## Cost Estimates

The system logs estimated costs for all AI service usage:

- **Gemini**: ~$0.000001 per input token, ~$0.000002 per output token
- **DeepSeek**: ~$0.0000005 per token
- **Firecrawl**: ~$0.01 per credit

Configure accurate rates in environment variables for precise tracking. View costs in admin dashboard.

## Support & Contributing

### Getting Help
- Open an issue on GitHub for bugs or feature requests
- Check existing issues before creating new ones
- Provide detailed information: environment, steps to reproduce, expected vs actual behavior

### Contributing
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -m "Add feature"`
4. Push to the branch: `git push origin feature-name`
5. Open a Pull Request

### Code Style
- Follow existing TypeScript conventions
- Use strict mode and avoid `any` type
- Add meaningful variable and function names
- Include error handling for all async operations
- Validate all incoming data with Zod schemas

## License

MIT License

Copyright (c) 2026 Aureos-backend

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

Built with ❤️ by [Orionixlabs.com](https://orionixlabs.com)


---

> **Note**: This is a backend API-only project. There is no frontend UI included. All interactions happen through API endpoints documented in [API_DOCS.md](./API_DOCS.md).
