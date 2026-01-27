import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  const adminClient = createAdminClient();
  const startTime = Date.now();
  
  try {
    // Database connectivity check (query users table with 5s timeout)
    const dbPromise = adminClient.from('users').select('id').limit(1);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database timeout')), 5000)
    );

    await Promise.race([dbPromise, timeoutPromise]);

    return NextResponse.json({
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
        uptime_ms: Math.floor(process.uptime() * 1000)
      }
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      data: {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        uptime_ms: Math.floor(process.uptime() * 1000)
      }
    }, { status: 503 });
  }
}
