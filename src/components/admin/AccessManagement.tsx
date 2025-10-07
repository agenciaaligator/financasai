import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2 } from 'lucide-react';

interface UserCoupon {
  applied_at: string;
  discount_coupons: {
    code: string;
    type: string;
  };
}

interface ProfileWithCoupon {
  id: string;
  user_id: string;
  full_name: string | null;
  user_coupons: UserCoupon[];
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  user_coupons: UserCoupon[];
}

interface UserWithAccess {
  id: string;
  email: string;
  full_name: string | null;
  coupon_code: string | null;
  coupon_type: string | null;
  applied_at: string | null;
}

export function AccessManagement() {
  const [users, setUsers] = useState<UserWithAccess[]>([]);
  const [coupons, setCoupons] = useState<{ id: string; code: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [selectedCoupon, setSelectedCoupon] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log('[AccessManagement] Iniciando busca de dados...');
      
      // 1. Buscar profiles separadamente
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, email');

      if (profilesError) {
        console.error('[AccessManagement] Erro ao buscar profiles:', profilesError);
        throw new Error(profilesError.message || 'Erro ao buscar perfis');
      }
      
      console.log('[AccessManagement] Profiles encontrados:', profilesData?.length);
      
      if (!profilesData || profilesData.length === 0) {
        setUsers([]);
        setCoupons([]);
        return;
      }

      // 2. Buscar user_coupons para esses usuários
      const userIds = profilesData.map(p => p.user_id);
      const { data: userCouponsData, error: couponsError } = await supabase
        .from('user_coupons')
        .select(`
          user_id,
          applied_at,
          discount_coupons (
            code,
            type
          )
        `)
        .in('user_id', userIds);

      if (couponsError) {
        console.error('[AccessManagement] Erro ao buscar user_coupons:', couponsError);
        throw new Error(couponsError.message || 'Erro ao buscar cupons de usuários');
      }

      console.log('[AccessManagement] User coupons encontrados:', userCouponsData?.length);

      // 3. Mapear dados em memória
      const couponsByUser = new Map();
      userCouponsData?.forEach(uc => {
        couponsByUser.set(uc.user_id, uc);
      });

      const usersWithAccess = profilesData.map(profile => {
        const userCoupon = couponsByUser.get(profile.user_id);
        
        return {
          id: profile.user_id,
          email: profile.email || 'N/A',
          full_name: profile.full_name,
          coupon_code: userCoupon?.discount_coupons?.code || null,
          coupon_type: userCoupon?.discount_coupons?.type || null,
          applied_at: userCoupon?.applied_at || null
        };
      });

      setUsers(usersWithAccess.filter(u => u.coupon_code));

      // 4. Buscar cupons disponíveis
      const { data: availableCouponsData, error: availableCouponsError } = await supabase
        .from('discount_coupons')
        .select('id, code')
        .eq('is_active', true)
        .order('code');

      if (availableCouponsError) {
        console.error('[AccessManagement] Erro ao buscar cupons disponíveis:', availableCouponsError);
        throw new Error(availableCouponsError.message || 'Erro ao buscar cupons disponíveis');
      }
      
      setCoupons(availableCouponsData || []);
      console.log('[AccessManagement] Dados carregados com sucesso');
      
    } catch (error: any) {
      console.error('[AccessManagement] Erro detalhado:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: error.message || 'Não foi possível carregar os dados.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!selectedEmail || !selectedCoupon) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Selecione um usuário e um cupom.',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Buscar user_id pelo email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', selectedEmail)
        .single();
      
      if (profileError || !profile) {
        throw new Error('Usuário não encontrado');
      }

      // Verificar se já tem cupom
      const { data: existingCoupon } = await supabase
        .from('user_coupons')
        .select('id')
        .eq('user_id', profile.user_id)
        .maybeSingle();

      if (existingCoupon) {
        toast({
          title: 'Cupom já aplicado',
          description: 'Este usuário já possui um cupom. Remova o cupom atual antes de aplicar um novo.',
          variant: 'destructive'
        });
        return;
      }

      const { error } = await supabase.from('user_coupons').insert({
        user_id: profile.user_id,
        coupon_id: selectedCoupon
      });

      if (error) {
        console.error('[AccessManagement] Erro ao inserir cupom:', error);
        throw new Error(error.message || 'Erro ao aplicar cupom');
      }

      toast({
        title: 'Cupom aplicado',
        description: 'Cupom aplicado com sucesso ao usuário.'
      });

      setSelectedEmail('');
      setSelectedCoupon('');
      fetchData();
    } catch (error: any) {
      console.error('[AccessManagement] handleApplyCoupon error:', error);
      toast({
        title: 'Erro ao aplicar cupom',
        description: error.message || 'Erro desconhecido',
        variant: 'destructive'
      });
    }
  };

  const handleRemoveCoupon = async (userId: string) => {
    if (!confirm('Deseja realmente remover o cupom deste usuário?')) return;

    try {
      const { error } = await supabase
        .from('user_coupons')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'Cupom removido',
        description: 'Cupom removido do usuário com sucesso.'
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover cupom',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return <div>Carregando acessos...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Aplicar Cupom a Usuário</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="Email do usuário"
            value={selectedEmail}
            onChange={(e) => setSelectedEmail(e.target.value)}
          />
          <Select value={selectedCoupon} onValueChange={setSelectedCoupon}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um cupom" />
            </SelectTrigger>
            <SelectContent>
              {coupons.map(coupon => (
                <SelectItem key={coupon.id} value={coupon.id}>
                  {coupon.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleApplyCoupon}>
            <Plus className="w-4 h-4 mr-2" />
            Aplicar
          </Button>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Cupom</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Aplicado em</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.full_name || 'N/A'}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell className="font-mono font-semibold">{user.coupon_code}</TableCell>
                <TableCell>
                  <Badge variant={user.coupon_type === 'full_access' ? 'default' : 'secondary'}>
                    {user.coupon_type === 'full_access' && 'Acesso Total'}
                    {user.coupon_type === 'discount_percent' && 'Desconto %'}
                    {user.coupon_type === 'discount_fixed' && 'Desconto Fixo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.applied_at ? new Date(user.applied_at).toLocaleDateString('pt-BR') : '-'}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleRemoveCoupon(user.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
