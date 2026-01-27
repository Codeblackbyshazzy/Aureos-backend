import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { isRedisAvailable } from '@/lib/rate-limiter';

export async function GET() {
  const adminClient = createAdminClient();
  const startTime = Date.now();

  let dbStatus = 'disconnected';
  let redisStatus: 'connected' | 'disconnected' = 'disconnected';

  try {
    // Database connectivity check (query users table with 5s timeout)
    const dbPromise = adminClient.from('users').select('id').limit(1);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database timeout')), 5000)
    );

    await Promise.race([dbPromise, timeoutPromise]);
    dbStatus = 'connected';
  } catch (err) {
    console.error('Database health check failed:', err);
  }

  try {
    const redisAvailable = await isRedisAvailable();
    redisStatus = redisAvailable ? 'connected' : 'disconnected';
  } catch (err) {
    console.error('Redis health check failed:', err);
    redisStatus = 'disconnected';
  }

  const overallStatus = dbStatus === 'connected' ? 'ok' : 'error';
  const statusCode = overallStatus === 'ok' ? 200 : 503;

  return NextResponse.json({
    success: overallStatus === 'ok',
    data: {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      database: dbStatus,
      redis: redisStatus,
      uptime_ms: Math.floor(process.uptime() * 1000)
    }
  }, { status: statusCode });
}
