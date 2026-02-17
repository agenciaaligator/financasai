import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify caller is admin/master
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Client with caller's token to verify identity
    const supabaseCaller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabaseCaller.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }
    const callerId = claimsData.claims.sub

    // Service role client for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if caller is master or admin
    const { data: isMaster } = await supabase.rpc('is_master_user', { _user_id: callerId })
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: callerId, _role: 'admin' })

    if (!isMaster && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin or master required' }), { status: 403, headers: corsHeaders })
    }

    const { user_id } = await req.json()
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), { status: 400, headers: corsHeaders })
    }

    // Prevent deleting yourself
    if (user_id === callerId) {
      return new Response(JSON.stringify({ error: 'Cannot delete yourself' }), { status: 400, headers: corsHeaders })
    }

    // Check if target is master (cannot delete master)
    const { data: targetIsMaster } = await supabase.rpc('is_master_user', { _user_id: user_id })
    if (targetIsMaster) {
      return new Response(JSON.stringify({ error: 'Cannot delete master user' }), { status: 400, headers: corsHeaders })
    }

    console.log(`[delete-user-admin] Deleting user ${user_id}...`)

    // Delete in correct order (respecting foreign keys)
    // 1. whatsapp_sessions
    await supabase.from('whatsapp_sessions').delete().eq('user_id', user_id)
    
    // 2. whatsapp_validation_codes
    await supabase.from('whatsapp_validation_codes').delete().eq('user_id', user_id)
    
    // 3. whatsapp_auth_codes
    await supabase.from('whatsapp_auth_codes').delete().eq('user_id', user_id)

    // 4. recurring_instances (via recurring_transactions)
    const { data: recurringTxs } = await supabase
      .from('recurring_transactions')
      .select('id')
      .eq('user_id', user_id)
    
    if (recurringTxs && recurringTxs.length > 0) {
      const rtIds = recurringTxs.map(rt => rt.id)
      await supabase.from('recurring_instances').delete().in('recurring_transaction_id', rtIds)
    }

    // 5. recurring_transactions
    await supabase.from('recurring_transactions').delete().eq('user_id', user_id)

    // 6. reminder_settings
    await supabase.from('reminder_settings').delete().eq('user_id', user_id)

    // 7. work_hours
    await supabase.from('work_hours').delete().eq('user_id', user_id)

    // 8. whatsapp_settings
    await supabase.from('whatsapp_settings').delete().eq('user_id', user_id)

    // 9. commitments
    await supabase.from('commitments').delete().eq('user_id', user_id)

    // 10. transactions
    await supabase.from('transactions').delete().eq('user_id', user_id)

    // 11. categories
    await supabase.from('categories').delete().eq('user_id', user_id)

    // 12. calendar_connections
    await supabase.from('calendar_connections').delete().eq('user_id', user_id)

    // 13. organization_members
    await supabase.from('organization_members').delete().eq('user_id', user_id)

    // 14. organization_invitations (by invited_by)
    await supabase.from('organization_invitations').delete().eq('invited_by', user_id)

    // 15. organizations (by owner_id)
    await supabase.from('organizations').delete().eq('owner_id', user_id)

    // 16. user_subscriptions
    await supabase.from('user_subscriptions').delete().eq('user_id', user_id)

    // 17. user_roles
    await supabase.from('user_roles').delete().eq('user_id', user_id)

    // 18. profiles
    await supabase.from('profiles').delete().eq('user_id', user_id)

    // 19. Delete from auth.users
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(user_id)
    if (deleteAuthError) {
      console.error(`[delete-user-admin] Error deleting auth user: ${deleteAuthError.message}`)
      return new Response(JSON.stringify({ error: `Failed to delete auth user: ${deleteAuthError.message}` }), { status: 500, headers: corsHeaders })
    }

    console.log(`[delete-user-admin] User ${user_id} deleted successfully`)

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error(`[delete-user-admin] Error: ${err.message}`)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
