import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Try different header sources for client IP
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const cfConnectingIp = req.headers.get('cf-connecting-ip');
    
    // Extract IP from x-forwarded-for (first IP in the chain)
    let clientIp = forwardedFor?.split(',')[0].trim() 
      || realIp 
      || cfConnectingIp 
      || 'unknown';

    console.log('Client IP detection:', {
      forwardedFor,
      realIp,
      cfConnectingIp,
      resolvedIp: clientIp
    });

    return new Response(
      JSON.stringify({ ip: clientIp }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('Error getting client IP:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to get client IP',
        ip: 'unknown'
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
