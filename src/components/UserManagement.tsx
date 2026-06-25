import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, UserPlus, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ManagedUser {
  id: string;
  username: string;
  display_name: string;
  role: string;
  created_at: string;
}

export default function UserManagement() {
  const { isEditor, session } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'viewer' | 'editor'>('viewer');

  const callManageUsers = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('manage-users', { body });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const fetchUsers = async () => {
    if (!isEditor) return;
    setLoading(true);
    try {
      const data = await callManageUsers({ action: 'list' });
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error('Erro ao carregar usuários: ' + err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isEditor && session) fetchUsers();
  }, [isEditor, session]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword) return;
    setCreating(true);
    try {
      await callManageUsers({
        action: 'create',
        username: newUsername,
        password: newPassword,
        display_name: newName || newUsername,
        role: newRole,
      });
      toast.success('Usuário criado com sucesso');
      setNewUsername('');
      setNewPassword('');
      setNewName('');
      setNewRole('viewer');
      fetchUsers();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
    setCreating(false);
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await callManageUsers({ action: 'update_role', user_id: userId, role });
      toast.success('Permissão atualizada');
      fetchUsers();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    try {
      await callManageUsers({ action: 'delete', user_id: userId });
      toast.success('Usuário excluído');
      fetchUsers();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
  };

  if (!isEditor) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Controle de Usuários
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
          <div>
            <label className="text-xs text-muted-foreground">Nome</label>
            <Input className="h-8 text-xs" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Usuário</label>
            <Input className="h-8 text-xs" value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="nome.usuario" required />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Senha</label>
            <Input className="h-8 text-xs" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••" required minLength={6} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Permissão</label>
            <Select value={newRole} onValueChange={(v: 'viewer' | 'editor') => setNewRole(v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Visualização</SelectItem>
                <SelectItem value="editor">Edição</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" size="sm" className="h-8" disabled={creating}>
            {creating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <UserPlus className="h-3 w-3 mr-1" />}
            Criar
          </Button>
        </form>

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="max-h-[250px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Nome</TableHead>
                  <TableHead className="text-xs">Usuário</TableHead>
                  <TableHead className="text-xs">Permissão</TableHead>
                  <TableHead className="text-xs w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="text-xs">{u.display_name}</TableCell>
                    <TableCell className="text-xs">{u.username}</TableCell>
                    <TableCell>
                      <Select value={u.role} onValueChange={v => handleRoleChange(u.id, v)}>
                        <SelectTrigger className="h-7 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Visualização</SelectItem>
                          <SelectItem value="editor">Edição</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleDelete(u.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
