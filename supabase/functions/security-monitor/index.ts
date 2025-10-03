import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SecurityEvent {
  event_type: 'auth_failed' | 'admin_action' | 'comment_spam' | 'suspicious_activity';
  user_id?: string;
  metadata?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const event: SecurityEvent = await req.json();

    // Log security event
    await supabase.from('logs').insert({
      scope: 'security',
      level: event.severity === 'critical' ? 'error' : event.severity === 'high' ? 'warn' : 'info',
      message: `Security event: ${event.event_type}`,
      meta_json: {
        event_type: event.event_type,
        user_id: event.user_id,
        timestamp: new Date().toISOString(),
        ...event.metadata
      }
    });

    // Check for suspicious patterns
    if (event.event_type === 'auth_failed') {
      // Check for multiple failed attempts from same IP/user
      const { count } = await supabase
        .from('logs')
        .select('*', { count: 'exact', head: true })
        .eq('scope', 'security')
        .contains('meta_json', { event_type: 'auth_failed' })
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

      if (count && count > 5) {
        // Log critical alert for potential brute force
        await supabase.from('logs').insert({
          scope: 'security',
          level: 'error',
          message: 'ALERT: Potential brute force attack detected',
          meta_json: {
            failed_attempts: count,
            time_window: '5 minutes',
            ...event.metadata
          }
        });
      }
    }

    if (event.event_type === 'comment_spam') {
      // Check for rapid comment submissions
      const { count } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', event.user_id)
        .gte('created_at', new Date(Date.now() - 60 * 1000).toISOString());

      if (count && count > 5) {
        await supabase.from('logs').insert({
          scope: 'security',
          level: 'warn',
          message: 'ALERT: Potential comment spam detected',
          meta_json: {
            user_id: event.user_id,
            comments_in_minute: count,
            ...event.metadata
          }
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Security event logged' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Security monitor error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
