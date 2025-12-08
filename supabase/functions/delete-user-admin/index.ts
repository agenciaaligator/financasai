import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verificar autenticação do caller
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('[DELETE USER] Missing authorization header')
      throw new Error('Missing authorization header')
    }

    // Criar Supabase Admin Client (com service role)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Criar client normal para validar caller
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verificar se caller está autenticado
    const { data: { user: caller }, error: callerError } = await supabase.auth.getUser()
    if (callerError || !caller) {
      console.error('[DELETE USER] Caller não autenticado:', callerError)
      throw new Error('Unauthorized')
    }

    // Verificar se caller é admin ou master
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: caller.id,
      _role: 'admin'
    })
    const { data: isMaster } = await supabase.rpc('is_master_user', {
      _user_id: caller.id
    })

    if (!isAdmin && !isMaster) {
      console.error('[DELETE USER] Caller não é admin:', caller.email)
      throw new Error('Forbidden: Only admins can delete users')
    }

    // Extrair user_id do body
    const { user_id } = await req.json()
    if (!user_id) {
      throw new Error('Missing user_id parameter')
    }

    console.log(`[DELETE USER] Admin ${caller.email} deletando usuário ${user_id}`)

    // Verificar se target não é master
    const { data: targetIsMaster } = await supabase.rpc('is_master_user', {
      _user_id: user_id
    })
    if (targetIsMaster) {
      console.error('[DELETE USER] Tentativa de deletar master user')
      throw new Error('Cannot delete master user')
    }

    // Log início da deleção no audit trail
    await supabaseAdmin.from('audit_logs').insert({
      event_type: 'USER_DELETION_INITIATED',
      actor_id: caller.id,
      target_id: user_id,
      details: {
        actor_email: caller.email,
        actor_role: isAdmin ? 'admin' : 'master',
        timestamp: new Date().toISOString()
      },
      ip_address: req.headers.get('x-forwarded-for'),
      user_agent: req.headers.get('user-agent')
    })

    // Buscar phone_number do usuário para limpar validation codes
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('phone_number')
      .eq('user_id', user_id)
      .single()
    
    const userPhone = profile?.phone_number

    // CASCATA DE EXCLUSÃO (usando admin client)

    // a) Calendar Connections
    console.log('[DELETE] Removendo calendar connections...')
    await supabaseAdmin.from('calendar_connections').delete().eq('user_id', user_id)

    // b) WhatsApp Sessions
    console.log('[DELETE] Removendo whatsapp sessions...')
    await supabaseAdmin.from('whatsapp_sessions').delete().eq('user_id', user_id)

    // c) WhatsApp Auth Codes
    console.log('[DELETE] Removendo whatsapp auth codes...')
    await supabaseAdmin.from('whatsapp_auth_codes').delete().eq('user_id', user_id)

    // d) WhatsApp Validation Codes (by user_id AND phone_number)
    console.log('[DELETE] Removendo whatsapp validation codes...')
    await supabaseAdmin.from('whatsapp_validation_codes').delete().eq('user_id', user_id)
    if (userPhone) {
      await supabaseAdmin.from('whatsapp_validation_codes').delete().eq('phone_number', userPhone)
    }

    // e) Organization Members (remove from all orgs)
    console.log('[DELETE] Removendo de organizações...')
    await supabaseAdmin.from('organization_members').delete().eq('user_id', user_id)

    // f) Organizations owned by user (IMPORTANT: delete orgs where user is owner)
    console.log('[DELETE] Removendo organizações do owner...')
    await supabaseAdmin.from('organizations').delete().eq('owner_id', user_id)

    // g) Commitments
    console.log('[DELETE] Removendo commitments...')
    await supabaseAdmin.from('commitments').delete().eq('user_id', user_id)

    // h) Recurring Instances (via recurring_transactions)
    console.log('[DELETE] Removendo recurring instances...')
    const { data: recurringTxs } = await supabaseAdmin
      .from('recurring_transactions')
      .select('id')
      .eq('user_id', user_id)
    if (recurringTxs && recurringTxs.length > 0) {
      const recurringIds = recurringTxs.map(r => r.id)
      await supabaseAdmin.from('recurring_instances').delete().in('recurring_transaction_id', recurringIds)
    }

    // i) Recurring Transactions
    console.log('[DELETE] Removendo recurring transactions...')
    await supabaseAdmin.from('recurring_transactions').delete().eq('user_id', user_id)

    // j) Transactions
    console.log('[DELETE] Removendo transactions...')
    await supabaseAdmin.from('transactions').delete().eq('user_id', user_id)

    // k) Categories
    console.log('[DELETE] Removendo categories...')
    await supabaseAdmin.from('categories').delete().eq('user_id', user_id)

    // l) User Subscriptions
    console.log('[DELETE] Removendo subscriptions...')
    await supabaseAdmin.from('user_subscriptions').delete().eq('user_id', user_id)

    // m) User Roles
    console.log('[DELETE] Removendo user roles...')
    await supabaseAdmin.from('user_roles').delete().eq('user_id', user_id)

    // n) Reminder Settings
    console.log('[DELETE] Removendo reminder settings...')
    await supabaseAdmin.from('reminder_settings').delete().eq('user_id', user_id)

    // o) Work Hours
    console.log('[DELETE] Removendo work hours...')
    await supabaseAdmin.from('work_hours').delete().eq('user_id', user_id)

    // p) WhatsApp Settings
    console.log('[DELETE] Removendo whatsapp settings...')
    await supabaseAdmin.from('whatsapp_settings').delete().eq('user_id', user_id)

    // q) Profile (LAST before auth)
    console.log('[DELETE] Removendo profile...')
    await supabaseAdmin.from('profiles').delete().eq('user_id', user_id)

    // m) FINALMENTE: Auth User (COM SERVICE ROLE KEY)
    console.log('[DELETE] Removendo auth user...')
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id)
    
    if (authDeleteError) {
      console.error('[DELETE] Erro ao remover auth user:', authDeleteError)
      throw new Error(`Failed to delete auth user: ${authDeleteError.message}`)
    }

    console.log(`[DELETE USER] ✅ Usuário ${user_id} excluído com sucesso!`)

    // Log conclusão da deleção no audit trail
    await supabaseAdmin.from('audit_logs').insert({
      event_type: 'USER_DELETION_COMPLETED',
      actor_id: caller.id,
      target_id: user_id,
      details: {
        success: true,
        actor_email: caller.email,
        deleted_records: {
          calendar_connections: true,
          whatsapp_sessions: true,
          whatsapp_auth_codes: true,
          whatsapp_validation_codes: true,
          whatsapp_settings: true,
          organization_members: true,
          organizations_owned: true,
          commitments: true,
          recurring_instances: true,
          recurring_transactions: true,
          transactions: true,
          categories: true,
          user_subscriptions: true,
          user_roles: true,
          reminder_settings: true,
          work_hours: true,
          profile: true,
          auth_user: true
        },
        timestamp: new Date().toISOString()
      },
      ip_address: req.headers.get('x-forwarded-for'),
      user_agent: req.headers.get('user-agent')
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User deleted successfully',
        deleted_user_id: user_id
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: any) {
    console.error('[DELETE USER] Erro:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.message.includes('Unauthorized') ? 401 :
                error.message.includes('Forbidden') ? 403 : 500
      }
    )
  }
})
