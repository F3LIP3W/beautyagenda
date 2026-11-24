import { useEffect, useState } from 'react';
import { ChevronRight, MessageCircle, Search, Users } from 'lucide-react';
import { useDebounced } from '../../hooks/useAsync.ts';
import { useToast } from '../../contexts/ToastContext.tsx';
import { CLIENTS_PAGE_SIZE, listClients, updateClient } from '../../services/clients.ts';
import { listClientAppointments } from '../../services/appointments.ts';
import type { AppointmentDetail, ClientOverview } from '../../types/index.ts';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format.ts';
import { formatPhone } from '../../utils/phone.ts';
import { buildWhatsappLink } from '../../utils/whatsapp.ts';
import { getErrorMessage } from '../../utils/errors.ts';
import { PageHeader } from '../../components/ui/PageHeader.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { EmptyState, ErrorState, Spinner, StatusBadge } from '../../components/ui/Feedback.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { Field, Input, Textarea } from '../../components/ui/Field.tsx';
import { AppointmentDetailsModal } from '../../components/admin/AppointmentDetailsModal.tsx';

export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const term = useDebounced(search, 300);
  const [clients, setClients] = useState<ClientOverview[] | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<ClientOverview | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setClients(null);
    setError(null);
    setPage(0);
    listClients(term, 0)
      .then((rows) => {
        if (!alive) return;
        setClients(rows);
        setHasMore(rows.length === CLIENTS_PAGE_SIZE);
      })
      .catch((e) => alive && setError(getErrorMessage(e)));
    return () => {
      alive = false;
    };
  }, [term, reloadKey]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const rows = await listClients(term, page + 1);
      setClients((c) => [...(c ?? []), ...rows]);
      setPage(page + 1);
      setHasMore(rows.length === CLIENTS_PAGE_SIZE);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <>
      <PageHeader title="Clientes" description="Cadastrados automaticamente a cada agendamento." />
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400" />
        <input className="input pl-10" placeholder="Buscar por nome ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {error ? <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} /> : !clients ? <Spinner /> :
        clients.length === 0 ? (
          <EmptyState icon={<Users className="size-6" />} title={term ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda'}
            description={term ? 'Tente outro nome ou telefone.' : 'Os clientes aparecem aqui após o primeiro agendamento.'} />
        ) : (
          <div className="card overflow-hidden">
            <div className="hidden grid-cols-12 gap-4 border-b border-zinc-100 bg-zinc-50/60 px-5 py-3 text-xs font-medium tracking-wide text-zinc-500 uppercase md:grid">
              <span className="col-span-4">Cliente</span><span className="col-span-2">Atendimentos</span>
              <span className="col-span-2">Último atendimento</span><span className="col-span-2">Próximo</span><span className="col-span-2 text-right">Total gasto</span>
            </div>
            <ul className="divide-y divide-zinc-100">
              {clients.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setSelected(c)} className="grid w-full grid-cols-12 items-center gap-2 px-5 py-3.5 text-left hover:bg-zinc-50 md:gap-4">
                    <span className="col-span-10 min-w-0 md:col-span-4">
                      <span className="block truncate font-medium text-zinc-900">{c.name}</span>
                      <span className="block text-sm text-zinc-500">{formatPhone(c.whatsapp)}</span>
                    </span>
                    <ChevronRight className="col-span-2 ml-auto size-5 text-zinc-400 md:hidden" />
                    <span className="col-span-12 flex flex-wrap gap-x-4 text-xs text-zinc-500 md:hidden">
                      <span>{c.completed_appointments} atendimento(s)</span>
                      {c.last_visit && <span>Último: {formatDate(c.last_visit)}</span>}
                    </span>
                    <span className="hidden text-sm md:col-span-2 md:block">{c.completed_appointments} <span className="text-zinc-400">/ {c.total_appointments}</span></span>
                    <span className="hidden text-sm text-zinc-600 md:col-span-2 md:block">{c.last_visit ? formatDate(c.last_visit) : '—'}</span>
                    <span className="hidden text-sm text-zinc-600 md:col-span-2 md:block">{c.next_appointment ? formatDate(c.next_appointment) : '—'}</span>
                    <span className="hidden text-right text-sm font-medium md:col-span-2 md:block">{formatCurrency(c.total_spent)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {hasMore && (
              <div className="border-t border-zinc-100 p-3 text-center">
                <Button variant="ghost" onClick={loadMore} loading={loadingMore}>Carregar mais</Button>
              </div>
            )}
          </div>
        )}

      {selected && <ClientDrawer client={selected} onClose={() => setSelected(null)} onChanged={() => setReloadKey((k) => k + 1)} />}
    </>
  );
}

function ClientDrawer({ client, onClose, onChanged }: { client: ClientOverview; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [history, setHistory] = useState<AppointmentDetail[] | null>(null);
  const [name, setName] = useState(client.name);
  const [notes, setNotes] = useState(client.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    listClientAppointments(client.id).then(setHistory).catch((e) => toast.error(getErrorMessage(e)));
  }, [client.id, historyKey, toast]);

  const save = async () => {
    if (name.trim().length < 2) return toast.error('Informe o nome.');
    setBusy(true);
    try {
      await updateClient(client.id, { name, notes });
      toast.success('Cliente atualizado.');
      onChanged();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const wa = buildWhatsappLink(client.whatsapp, `Olá, ${client.name.split(' ')[0]}!`);

  return (
    <>
      <Modal open onClose={onClose} title={client.name} subtitle={formatPhone(client.whatsapp)} size="lg">
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-zinc-50 p-3"><p className="text-xl font-semibold">{client.completed_appointments}</p><p className="text-xs text-zinc-500">Atendimentos</p></div>
            <div className="rounded-xl bg-zinc-50 p-3"><p className="text-sm font-semibold sm:text-xl">{client.last_visit ? formatDate(client.last_visit) : '—'}</p><p className="text-xs text-zinc-500">Último</p></div>
            <div className="rounded-xl bg-zinc-50 p-3"><p className="text-sm font-semibold sm:text-xl">{formatCurrency(client.total_spent)}</p><p className="text-xs text-zinc-500">Total gasto</p></div>
          </div>
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer"
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 font-medium text-white hover:bg-emerald-700">
              <MessageCircle className="size-5" /> Abrir conversa no WhatsApp
            </a>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Observações"><Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></Field>
          </div>
          <div className="flex justify-end"><Button size="sm" variant="secondary" onClick={save} loading={busy}>Salvar dados</Button></div>

          <div>
            <h3 className="mb-2 font-semibold">Histórico de agendamentos</h3>
            {!history ? <Spinner /> : history.length === 0 ? <p className="text-sm text-zinc-500">Sem agendamentos.</p> : (
              <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                {history.map((a) => (
                  <li key={a.id}>
                    <button onClick={() => setOpenId(a.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.service_name} · {a.professional_name}</p>
                        <p className="text-xs text-zinc-500">{formatDateTime(a.starts_at)} · {formatCurrency(a.price)}</p>
                      </div>
                      <StatusBadge status={a.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>
      <AppointmentDetailsModal appointmentId={openId} onClose={() => setOpenId(null)}
        onChanged={() => { setHistoryKey((k) => k + 1); onChanged(); }} />
    </>
  );
}
