import { useEffect, useState } from 'react';
import { Camera, Pencil, Plus, Power, Trash2, UserRound } from 'lucide-react';
import { useAdminCatalog } from '../../hooks/useAdminCatalog.ts';
import { useLocation, navigate } from '../../lib/router.tsx';
import { useToast } from '../../contexts/ToastContext.tsx';
import { deleteProfessional, saveProfessional, setProfessionalActive, type ProfessionalInput } from '../../services/professionals.ts';
import { uploadImage } from '../../services/storage.ts';
import { getWorkingHours } from '../../services/settings.ts';
import type { ProfessionalHour, ProfessionalWithDetails, ServiceWithProfessionals } from '../../types/index.ts';
import { WEEKDAYS } from '../../utils/datetime.ts';
import { formatPhone, maskPhoneInput } from '../../utils/phone.ts';
import { getErrorMessage } from '../../utils/errors.ts';
import { PageHeader } from '../../components/ui/PageHeader.tsx';
import { TimeSelect } from '../../components/ui/TimeSelect.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Badge, EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback.tsx';
import { Avatar, proColor } from '../../components/ui/Avatar.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { Checkbox, Field, Input, Toggle } from '../../components/ui/Field.tsx';

type HourRow = Omit<ProfessionalHour, 'professional_id'>;

export default function ProfessionalsPage() {
  const { data, error, loading, reload } = useAdminCatalog();
  const { search } = useLocation();
  const toast = useToast();
  const [editing, setEditing] = useState<ProfessionalWithDetails | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<ProfessionalWithDetails | null>(null);

  useEffect(() => {
    if (search.get('novo') === '1') {
      setEditing('new');
      navigate('/admin/profissionais', { replace: true });
    }
  }, [search]);

  const toggleActive = async (p: ProfessionalWithDetails) => {
    try {
      await setProfessionalActive(p.id, !p.active);
      toast.success(p.active ? `${p.name} foi desativado(a) e não aparece mais no agendamento.` : `${p.name} foi reativado(a).`);
      reload();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <>
      <PageHeader title="Profissionais" description="Equipe, serviços realizados e jornada de trabalho."
        actions={<Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Cadastrar profissional</Button>} />

      {loading && !data ? <Spinner /> : error || !data ? <ErrorState message={error ?? ''} onRetry={reload} /> :
        data.professionals.length === 0 ? (
          <EmptyState icon={<UserRound className="size-6" />} title="Nenhum profissional cadastrado"
            description="Cadastre a equipe para liberar o agendamento online."
            action={<Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Cadastrar profissional</Button>} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.professionals.map((p, i) => {
              const services = data.services.filter((s) => p.service_ids.includes(s.id));
              const workDays = p.hours.filter((h) => h.is_working).map((h) => WEEKDAYS[h.weekday].slice(0, 3));
              return (
                <div key={p.id} className={`card flex flex-col p-5 ${p.active ? '' : 'opacity-60'}`}>
                  <div className="flex items-start gap-3">
                    <Avatar name={p.name} src={p.photo_url} size={52} color={proColor(i)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-semibold">{p.name}</h3>
                        {!p.active && <Badge tone="red">Inativo</Badge>}
                      </div>
                      <p className="truncate text-sm text-zinc-500">{p.specialties || 'Sem especialidade informada'}</p>
                      {p.phone && <p className="text-sm text-zinc-500">{formatPhone(p.phone)}</p>}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {services.slice(0, 5).map((s) => <Badge key={s.id}>{s.name}</Badge>)}
                    {services.length > 5 && <Badge tone="gold">+{services.length - 5}</Badge>}
                    {services.length === 0 && <span className="text-xs text-amber-700">Nenhum serviço vinculado — não aparece no agendamento.</span>}
                  </div>
                  <p className="mt-3 text-xs text-zinc-500">
                    {workDays.length ? `Trabalha: ${workDays.join(', ')}` : 'Sem dias de trabalho definidos'}
                  </p>
                  <div className="mt-4 flex gap-2 border-t border-zinc-100 pt-4">
                    <Button size="sm" variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditing(p)}>Editar</Button>
                    <Button size="sm" variant="ghost" icon={<Power className="size-4" />} onClick={() => toggleActive(p)}>
                      {p.active ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button size="sm" variant="ghost" className="ml-auto text-red-600 hover:bg-red-50" aria-label="Excluir"
                      icon={<Trash2 className="size-4" />} onClick={() => setToDelete(p)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {editing && data && (
        <ProfessionalForm professional={editing === 'new' ? null : editing} services={data.services}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      )}
      <ConfirmDialog open={Boolean(toDelete)} onClose={() => setToDelete(null)} danger confirmLabel="Excluir"
        title={`Excluir ${toDelete?.name}?`}
        message="Se este profissional já tiver agendamentos, a exclusão será bloqueada para preservar o histórico — nesse caso, use Desativar."
        onConfirm={async () => {
          try {
            await deleteProfessional(toDelete!.id);
            toast.success('Profissional excluído.');
            reload();
          } catch (e) {
            toast.error(getErrorMessage(e));
          }
        }} />
    </>
  );
}

function defaultHours(): HourRow[] {
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday, is_working: weekday !== 0, start_time: '09:00', end_time: '18:00', break_start: '12:00', break_end: '13:00',
  }));
}

function ProfessionalForm({ professional, services, onClose, onSaved }: {
  professional: ProfessionalWithDetails | null; services: ServiceWithProfessionals[]; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<'dados' | 'servicos' | 'horarios'>('dados');
  const [form, setForm] = useState<ProfessionalInput>(() => ({
    name: professional?.name ?? '',
    phone: professional?.phone ? formatPhone(professional.phone) : '',
    specialties: professional?.specialties ?? '',
    photo_url: professional?.photo_url ?? null,
    active: professional?.active ?? true,
    service_ids: professional?.service_ids ?? [],
    hours: [],
  }));
  const [hours, setHours] = useState<HourRow[]>(() => {
    const base = defaultHours();
    if (!professional) return base;
    return base.map((d) => {
      const h = professional.hours.find((x) => x.weekday === d.weekday);
      return h
        ? { weekday: h.weekday, is_working: h.is_working, start_time: h.start_time.slice(0, 5), end_time: h.end_time.slice(0, 5),
            break_start: h.break_start?.slice(0, 5) ?? null, break_end: h.break_end?.slice(0, 5) ?? null }
        : { ...d, is_working: false };
    });
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Novo profissional: usa o horário do estabelecimento como sugestão
  useEffect(() => {
    if (professional) return;
    getWorkingHours().then((wh) => setHours((prev) => prev.map((d) => {
      const w = wh.find((x) => x.weekday === d.weekday);
      return w ? { ...d, is_working: w.is_open, start_time: w.open_time.slice(0, 5), end_time: w.close_time.slice(0, 5) } : d;
    }))).catch(() => {});
  }, [professional]);

  const set = <K extends keyof ProfessionalInput>(k: K, v: ProfessionalInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setHour = (weekday: number, patch: Partial<HourRow>) =>
    setHours((hs) => hs.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)));

  const onPhoto = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      set('photo_url', await uploadImage(file, 'professionals'));
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const validate = (): string | null => {
    if (form.name.trim().length < 2) return 'Informe o nome do profissional.';
    for (const h of hours.filter((x) => x.is_working)) {
      const day = WEEKDAYS[h.weekday];
      if (!h.start_time || !h.end_time || h.end_time <= h.start_time) return `${day}: o fim do expediente deve ser depois do início.`;
      if (Boolean(h.break_start) !== Boolean(h.break_end)) return `${day}: preencha início e fim do intervalo (ou deixe ambos vazios).`;
      if (h.break_start && h.break_end && (h.break_start < h.start_time || h.break_end > h.end_time || h.break_end <= h.break_start)) {
        return `${day}: o intervalo deve estar dentro do expediente.`;
      }
    }
    return null;
  };

  const save = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await saveProfessional(professional?.id ?? null, {
        ...form,
        phone: form.phone ? form.phone.replace(/\D/g, '') : null,
        hours: hours.map((h) => ({ ...h, break_start: h.break_start || null, break_end: h.break_end || null })),
      });
      toast.success(professional ? 'Profissional atualizado.' : 'Profissional cadastrado.');
      onSaved();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const categories = [...new Set(services.map((s) => s.category))];

  return (
    <Modal open onClose={onClose} size="lg" title={professional ? `Editar ${professional.name}` : 'Cadastrar profissional'}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} loading={busy} disabled={uploading}>Salvar</Button>
      </>}>
      <div className="mb-5 flex gap-1 rounded-xl bg-zinc-100 p-1">
        {([['dados', 'Dados'], ['servicos', `Serviços (${form.service_ids.length})`], ['horarios', 'Horários e folgas']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 rounded-lg px-2 py-2 text-sm font-medium ${tab === k ? 'bg-white shadow-sm' : 'text-zinc-600'}`}>{l}</button>
        ))}
      </div>

      {tab === 'dados' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar name={form.name || '?'} src={form.photo_url} size={72} />
            <div className="flex flex-col gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50">
                <Camera className="size-4" /> {uploading ? 'Enviando...' : form.photo_url ? 'Trocar foto' : 'Adicionar foto'}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploading}
                  onChange={(e) => onPhoto(e.target.files?.[0])} />
              </label>
              {form.photo_url && <button className="text-left text-xs text-red-600" onClick={() => set('photo_url', null)}>Remover foto</button>}
              <span className="text-xs text-zinc-500">PNG, JPG ou WEBP até 2 MB.</span>
            </div>
          </div>
          <Field label="Nome"><Input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} placeholder="Ex.: João" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telefone (opcional)">
              <Input value={form.phone ?? ''} inputMode="tel" onChange={(e) => set('phone', maskPhoneInput(e.target.value))} placeholder="(11) 98888-7777" />
            </Field>
            <Field label="Especialidades"><Input value={form.specialties ?? ''} onChange={(e) => set('specialties', e.target.value)} maxLength={200} placeholder="Ex.: Barbeiro" /></Field>
          </div>
          <Toggle checked={form.active} onChange={(v) => set('active', v)} label="Ativo (aparece no agendamento online)" />
        </div>
      )}

      {tab === 'servicos' && (
        <div className="space-y-5">
          {services.length === 0 && <p className="text-sm text-zinc-500">Cadastre serviços primeiro.</p>}
          {categories.map((cat) => (
            <div key={cat}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-700">{cat}</p>
                <button className="text-xs font-medium text-gold-600" onClick={() => {
                  const ids = services.filter((s) => s.category === cat).map((s) => s.id);
                  const all = ids.every((id) => form.service_ids.includes(id));
                  set('service_ids', all ? form.service_ids.filter((id) => !ids.includes(id)) : [...new Set([...form.service_ids, ...ids])]);
                }}>Marcar/desmarcar todos</button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {services.filter((s) => s.category === cat).map((s) => (
                  <Checkbox key={s.id} label={s.name} description={s.active ? undefined : 'Serviço inativo'}
                    checked={form.service_ids.includes(s.id)}
                    onChange={(c) => set('service_ids', c ? [...form.service_ids, s.id] : form.service_ids.filter((x) => x !== s.id))} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'horarios' && (
        <div className="space-y-2">
          <p className="mb-3 text-sm text-zinc-500">
            Desmarque os dias de folga semanal. Folgas em datas específicas e bloqueios ficam em <b>Horários e folgas</b>.
          </p>
          {hours.map((h) => (
            <div key={h.weekday} className={`rounded-xl border p-3 ${h.is_working ? 'border-zinc-200' : 'border-dashed border-zinc-200 bg-zinc-50'}`}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <div className="w-32"><Toggle checked={h.is_working} onChange={(v) => setHour(h.weekday, { is_working: v })} label={WEEKDAYS[h.weekday]} /></div>
                {h.is_working ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <TimeSelect value={h.start_time} onChange={(v) => setHour(h.weekday, { start_time: v ?? '09:00' })} aria-label="Início" />
                    <span className="text-zinc-400">às</span>
                    <TimeSelect value={h.end_time} onChange={(v) => setHour(h.weekday, { end_time: v ?? '09:00' })} aria-label="Fim" />
                    <span className="ml-2 text-zinc-500">Almoço</span>
                    <TimeSelect value={h.break_start ?? ''} onChange={(v) => setHour(h.weekday, { break_start: v })} aria-label="Início do intervalo" allowEmpty />
                    <span className="text-zinc-400">às</span>
                    <TimeSelect value={h.break_end ?? ''} onChange={(v) => setHour(h.weekday, { break_end: v })} aria-label="Fim do intervalo" allowEmpty />
                  </div>
                ) : <span className="text-sm text-zinc-500">Folga</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">{error}</p>}
    </Modal>
  );
}
