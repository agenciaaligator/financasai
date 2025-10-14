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
    const hasClientId = !!Deno.env.get('GOOGLE_CLIENT_ID');
    const hasClientSecret = !!Deno.env.get('GOOGLE_CLIENT_SECRET');
    const hasRedirectUri = !!Deno.env.get('GOOGLE_CALENDAR_REDIRECT_URI');
    const redirectUri = Deno.env.get('GOOGLE_CALENDAR_REDIRECT_URI') || '';

    const diagnostics = {
      hasClientId,
      hasClientSecret,
      hasRedirectUri,
      redirectUri: hasRedirectUri ? redirectUri : 'Not configured',
      status: hasClientId && hasClientSecret && hasRedirectUri ? 'ready' : 'incomplete',
    };

    console.log('[GOOGLE-CALENDAR-DIAGNOSTICS] Configuration check:', {
      hasClientId,
      hasClientSecret,
      hasRedirectUri,
    });

    return new Response(
      JSON.stringify(diagnostics),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('[GOOGLE-CALENDAR-DIAGNOSTICS] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
