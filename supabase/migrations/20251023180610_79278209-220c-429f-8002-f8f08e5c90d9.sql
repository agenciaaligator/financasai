-- Criar tabela de convites
create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  invited_by uuid references auth.users(id) on delete cascade not null,
  email text not null,
  role text not null default 'member',
  permissions jsonb default '{"view": true, "create": true, "edit": true, "delete": true, "view_own": true, "view_others": false, "edit_own": true, "edit_others": false, "delete_own": true, "delete_others": false, "view_reports": false, "manage_members": false}'::jsonb,
  token uuid unique default gen_random_uuid(),
  status text not null default 'pending',
  expires_at timestamptz default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint valid_status check (status in ('pending', 'accepted', 'expired', 'cancelled'))
);

alter table public.organization_invitations enable row level security;

-- Função helper para verificar manager (owner ou admin)
create or replace function is_org_manager(p_user_id uuid, p_org_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1 from organization_members
    where organization_id = p_org_id
      and user_id = p_user_id
      and role in ('owner', 'admin')
  );
end;
$$;

-- RLS policies
create policy "Managers can create invites"
  on organization_invitations for insert
  with check (is_org_manager(auth.uid(), organization_id));

create policy "Managers can view invites"
  on organization_invitations for select
  using (is_org_manager(auth.uid(), organization_id));

create policy "Managers can update invites"
  on organization_invitations for update
  using (is_org_manager(auth.uid(), organization_id));

-- Índices
create index if not exists idx_invitations_token on organization_invitations(token);
create index if not exists idx_invitations_email on organization_invitations(email);
create index if not exists idx_invitations_status on organization_invitations(status);
create index if not exists idx_invitations_org on organization_invitations(organization_id);

-- RPC: Aceitar convite
create or replace function accept_organization_invite(p_token uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_invitation record;
  v_user_email text;
begin
  select * into v_invitation from organization_invitations
  where token = p_token and status = 'pending' and expires_at > now();

  if not found then
    return jsonb_build_object('success', false, 'error', 'Convite inválido ou expirado');
  end if;

  select email into v_user_email from profiles where user_id = p_user_id;

  if v_user_email != v_invitation.email then
    return jsonb_build_object('success', false, 'error', 'Este convite não é para o seu email');
  end if;

  if exists (select 1 from organization_members where organization_id = v_invitation.organization_id and user_id = p_user_id) then
    update organization_invitations set status = 'accepted', accepted_at = now() where id = v_invitation.id;
    return jsonb_build_object('success', true, 'message', 'Você já é membro desta organização');
  end if;

  insert into organization_members (organization_id, user_id, role, permissions)
  values (v_invitation.organization_id, p_user_id, v_invitation.role, v_invitation.permissions);

  update organization_invitations set status = 'accepted', accepted_at = now() where id = v_invitation.id;

  return jsonb_build_object('success', true, 'message', 'Convite aceito com sucesso!');
end;
$$;

-- Trigger para updated_at
create or replace function update_invitations_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trigger_update_invitations_updated_at
  before update on organization_invitations
  for each row execute function update_invitations_updated_at();