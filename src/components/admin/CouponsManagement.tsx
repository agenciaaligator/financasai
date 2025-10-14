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

interface Coupon {
  id: string;
  code: string;
  type: string;
  value: number | null;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  is_active: boolean;
  note: string | null;
  created_at: string;
}

export function CouponsManagement() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    type: 'discount_percent',
    value: '',
    max_uses: '',
    note: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchCoupons();
    // Auto-refresh a cada 30 segundos
    const interval = setInterval(fetchCoupons, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('discount_coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCoupons(data || []);
    } catch (error) {
      console.error('Error fetching coupons:', error);
      toast({
        title: 'Erro ao carregar cupons',
        description: 'Não foi possível carregar a lista de cupons.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCoupon = async () => {
    if (!newCoupon.code) {
      toast({
        title: 'Código obrigatório',
        description: 'Informe um código para o cupom.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { error } = await supabase.from('discount_coupons').insert({
        code: newCoupon.code.toUpperCase(),
        type: newCoupon.type,
        value: newCoupon.value ? parseFloat(newCoupon.value) : null,
        max_uses: newCoupon.max_uses ? parseInt(newCoupon.max_uses) : null,
        note: newCoupon.note || null
      });

      if (error) throw error;

      toast({
        title: 'Cupom criado',
        description: `Cupom ${newCoupon.code} criado com sucesso.`
      });

      setNewCoupon({ code: '', type: 'discount_percent', value: '', max_uses: '', note: '' });
      fetchCoupons();
    } catch (error: any) {
      toast({
        title: 'Erro ao criar cupom',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('discount_coupons')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Cupom atualizado',
        description: `Cupom ${!currentStatus ? 'ativado' : 'desativado'} com sucesso.`
      });

      fetchCoupons();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar cupom',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este cupom?')) return;

    try {
      const { error } = await supabase.from('discount_coupons').delete().eq('id', id);

      if (error) throw error;

      toast({
        title: 'Cupom excluído',
        description: 'Cupom removido com sucesso.'
      });

      fetchCoupons();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir cupom',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return <div>Carregando cupons...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Criar Novo Cupom</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Input
            placeholder="Código do cupom"
            value={newCoupon.code}
            onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value })}
          />
          <Select value={newCoupon.type} onValueChange={(value) => setNewCoupon({ ...newCoupon, type: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full_access">Acesso Total</SelectItem>
              <SelectItem value="discount_percent">Desconto %</SelectItem>
              <SelectItem value="discount_fixed">Desconto Fixo</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Valor"
            type="number"
            value={newCoupon.value}
            onChange={(e) => setNewCoupon({ ...newCoupon, value: e.target.value })}
          />
          <Input
            placeholder="Máx. usos"
            type="number"
            value={newCoupon.max_uses}
            onChange={(e) => setNewCoupon({ ...newCoupon, max_uses: e.target.value })}
          />
          <Button onClick={handleCreateCoupon}>
            <Plus className="w-4 h-4 mr-2" />
            Criar
          </Button>
        </div>
        <Input
          className="mt-4"
          placeholder="Observação"
          value={newCoupon.note}
          onChange={(e) => setNewCoupon({ ...newCoupon, note: e.target.value })}
        />
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Usos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.map((coupon) => (
              <TableRow key={coupon.id}>
                <TableCell className="font-mono font-semibold">{coupon.code}</TableCell>
                <TableCell>
                  {coupon.type === 'full_access' && 'Acesso Total'}
                  {coupon.type === 'discount_percent' && 'Desconto %'}
                  {coupon.type === 'discount_fixed' && 'Desconto Fixo'}
                </TableCell>
                <TableCell>{coupon.value || '-'}</TableCell>
                <TableCell>
                  {coupon.current_uses}/{coupon.max_uses || '∞'}
                </TableCell>
                <TableCell>
                  <Badge variant={coupon.is_active ? 'default' : 'secondary'}>
                    {coupon.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{coupon.note || '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={coupon.is_active ? 'outline' : 'default'}
                      onClick={() => handleToggleActive(coupon.id, coupon.is_active)}
                    >
                      {coupon.is_active ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(coupon.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
