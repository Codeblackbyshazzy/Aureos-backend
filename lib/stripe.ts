import Stripe from 'stripe';
import { createAdminClient } from './supabase';
import { Subscription } from '@/types';
import { env } from './env';

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
});

export async function getOrCreateCustomer(userId: string, email: string): Promise<string> {
  const adminClient = createAdminClient();

  // Check if user already has a subscription with a customer ID
  const { data: existingSubscription } = await adminClient
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (existingSubscription?.stripe_customer_id) {
    return existingSubscription.stripe_customer_id;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    metadata: {
      user_id: userId,
    },
  });

  return customer.id;
}

export async function getSubscriptionInfo(userId: string): Promise<Subscription | null> {
  const adminClient = createAdminClient();

  const { data: subscription } = await adminClient
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  return subscription;
}

export async function checkSubscriptionStatus(userId: string): Promise<boolean> {
  const subscription = await getSubscriptionInfo(userId);
  return subscription !== null && subscription.status === 'active';
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  plan: 'starter' | 'pro',
  interval: 'monthly' | 'yearly'
): Promise<string> {
  const customerId = await getOrCreateCustomer(userId, email);

  const priceIds = {
    starter: {
      monthly: env.STRIPE_PRICE_STARTER_MONTHLY,
      yearly: env.STRIPE_PRICE_STARTER_YEARLY,
    },
    pro: {
      monthly: env.STRIPE_PRICE_PRO_MONTHLY,
      yearly: env.STRIPE_PRICE_PRO_YEARLY,
    },
  };

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceIds[plan][interval],
        quantity: 1,
      },
    ],
    success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/pricing`,
    metadata: {
      user_id: userId,
      plan,
      interval,
    },
  });

  return session.id;
}

export async function createPortalSession(customerId: string): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard`,
  });

  return session.url;
}

export { stripe };
