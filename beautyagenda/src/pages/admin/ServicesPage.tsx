import { useEffect, useState } from 'react';
import { Clock, Pencil, Plus, Power, Scissors, Trash2 } from 'lucide-react';
import { useAdminCatalog } from '../../hooks/useAdminCatalog.ts';
import { navigate, useLocation } from '../../lib/router.tsx';
import { useToast } from '../../contexts/ToastContext.tsx';
import { deleteService, saveService, setServiceActive } from '../../services/catalog.ts';
import type { ProfessionalWithDetails, ServiceWithProfessionals } from '../../types/index.ts';
import { formatCurrency, formatDuration, parseMoney } from '../../utils/format.ts';
import { getErrorMessage } from '../../utils/errors.ts';
import { PageHeader } from '../../components/ui/PageHeader.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Badge, EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { Checkbox, Field, Input, Textarea, Toggle } from '../../components/ui/Field.tsx';

export default function ServicesPage() {
  const { data, error, loading, reload } = useAdminCatalog();
  const { search } = useLocation();
  const toast = useToast();
  const [editing, setEditing] = useState<ServiceWithProfessionals | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<ServiceWithProfessionals | null>(null);

  useEffect(() => {
    if (search.get('novo') === '1') {
      setEditing('new');
      navigate('/admin/servicos', { replace: true });
    }
  }, [search]);

  const toggle = async (s: ServiceWithProfessionals) => {
    try {
      await setServiceActive(s.id, !s.active);
      toast.success(s.active ? 'Serviço desativado.' : 'Serviço ativado.');
      reload();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const categories = [...new Set((data?.services ?? []).map((s) => s.category))];

  return (
    <>
      <PageHeader title="Serviços" description="Preços, durações e quem realiza cada serviço."
        actions={<Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Cadastrar serviço</Button>} />

      {loading && !data ? <Spinner /> : error || !data ? <ErrorState message={error ?? ''} onRetry={reload} /> :
        data.services.length === 0 ? (
          <EmptyState icon={<Scissors className="size-6" />} title="Nenhum serviço cadastrado"
            action={<Button onClick={() => setEditing('new')}>Cadastrar serviço</Button>} />
        ) : (
          <div className="space-y-6">
            {categories.map((cat) => (
              <section key={cat} className="card overflow-hidden">
                <h2 className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3 text-sm font-semibold tracking-wide text-zinc-700 uppercase">{cat}</h2>
                <ul className="divide-y divide-zinc-100">
                  {data.services.filter((s) => s.category === cat).map((s) => {
                    const pros = data.professionals.filter((p) => s.professional_ids.includes(p.id));
                    return (
                      <li key={s.id} className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center ${s.active ? '' : 'bg-zinc-50/50'}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`font-medium ${s.active ? 'text-zinc-900' : 'text-zinc-400 line-through'}`}>{s.name}</p>
                            {!s.active && <Badge tone="red">Inativo</Badge>}
                          </div>
                          {s.description && <p className="mt-0.5 line-clamp-1 text-sm text-zinc-500">{s.description}</p>}
                          <p className="mt-1 text-xs text-zinc-500">
                            {pros.length ? pros.map((p) => p.name).join(', ') : <span className="text-amber-700">Nenhum profissional — não aparece no agendamento</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1 text-sm text-zinc-500"><Clock className="size-4" />{formatDuration(s.duration_minutes)}</span>
                          <span className="w-24 text-right font-semibold">{formatCurrency(s.price)}</span>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" aria-label="Editar" icon={<Pencil className="size-4" />} onClick={() => setEditing(s)} />
                            <Button size="sm" variant="ghost" aria-label={s.active ? 'Desativar' : 'Ativar'} icon={<Power className="size-4" />} onClick={() => toggle(s)} />
                            <Button size="sm" variant="ghost" aria-label="Excluir" className="text-red-600 hover:bg-red-50" icon={<Trash2 className="size-4" />} onClick={() => setToDelete(s)} />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

      {editing && data && (
        <ServiceForm service={editing === 'new' ? null : editing} professionals={data.professionals}
          categories={categories} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      )}
      <ConfirmDialog open={Boolean(toDelete)} onClose={() => setToDelete(null)} danger confirmLabel="Excluir"
        title={`Excluir "${toDelete?.name}"?`}
        message="Serviços com agendamentos não podem ser excluídos (para manter o histórico). Nesse caso, desative o serviço."
        onConfirm={async () => {
          try {
            await deleteService(toDelete!.id);
            toast.success('Serviço excluído.');
            reload();
          } catch (e) {
            toast.error(getErrorMessage(e));
          }
        }} />
    </>
  );
}

function ServiceForm({ service, professionals, categories, onClose, onSaved }: {
  service: ServiceWithProfessionals | null; professionals: ProfessionalWithDetails[]; categories: string[];
  onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(service?.name ?? '');
  const [category, setCategory] = useState(service?.category ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [price, setPrice] = useState(service ? String(service.price).replace('.', ',') : '');
  const [duration, setDuration] = useState(String(service?.duration_minutes ?? 30));
  const [active, setActive] = useState(service?.active ?? true);
  const [sortOrder, setSortOrder] = useState(String(service?.sort_order ?? 0));
  const [proIds, setProIds] = useState<string[]>(service?.professional_ids ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const p = parseMoney(price);
    const d = Number(duration);
    if (name.trim().length < 2) return setError('Informe o nome do serviço.');
    if (category.trim().length < 2) return setError('Informe a categoria.');
    if (!Number.isFinite(p) || p < 0) return setError('Preço inválido.');
    if (!Number.isInteger(d) || d < 5 || d > 600) return setError('Duração deve ser entre 5 e 600 minutos.');
    setError(null);
    setBusy(true);
    try {
      await saveService(service?.id ?? null, {
        name, category, description, price: p, duration_minutes: d, active,
        sort_order: Number(sortOrder) || 0, professional_ids: proIds,
      });
      toast.success(service ? 'Serviço atualizado.' : 'Serviço cadastrado.');
      onSaved();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={service ? 'Editar serviço' : 'Cadastrar serviço'} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={save} loading={busy}>Salvar</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do serviço"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ex.: Corte masculino" /></Field>
          <Field label="Categoria" hint="Escolha uma existente ou digite uma nova.">
            <Input value={category} onChange={(e) => setCategory(e.target.value)} list="service-categories" maxLength={40} placeholder="Ex.: Barbearia" />
            <datalist id="service-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
        </div>
        <Field label="Descrição (opcional)">
          <Textarea value={description ?? ''} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Preço (R$)"><Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="45,00" /></Field>
          <Field label="Duração (min)"><Input type="number" min={5} max={600} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} /></Field>
          <Field label="Ordem"><Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></Field>
        </div>
        <Toggle checked={active} onChange={setActive} label="Ativo (aparece no agendamento online)" />
        <div>
          <span className="label">Profissionais que realizam</span>
          {professionals.length === 0 ? <p className="text-sm text-zinc-500">Nenhum profissional cadastrado.</p> : (
            <div className="grid gap-2 sm:grid-cols-2">
              {professionals.map((p) => (
                <Checkbox key={p.id} label={p.name} description={p.active ? p.specialties ?? undefined : 'Inativo'}
                  checked={proIds.includes(p.id)} onChange={(c) => setProIds(c ? [...proIds, p.id] : proIds.filter((x) => x !== p.id))} />
              ))}
            </div>
          )}
        </div>
        {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
