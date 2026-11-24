import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowLeft, CalendarDays, Check, CircleCheck, ChevronRight, Clock, MapPin, MessageCircle, Phone, Scissors, Sparkles, UserRound, Users,
} from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.ts';
import { navigate, useLocation } from '../../lib/router.tsx';
import { bookAppointment, getAvailableSlots, getBookingCatalog } from '../../services/booking.ts';
import type { AvailableSlot, BookingCatalog, BookingResult, PublicProfessional, PublicService } from '../../types/index.ts';
import { formatCurrency, formatDayLong, formatDate, formatDateKey, formatDuration } from '../../utils/format.ts';
import { toDateKey, toTimeLabel } from '../../utils/datetime.ts';
import { formatPhone, maskPhoneInput, normalizeWhatsapp } from '../../utils/phone.ts';
import { buildClientConfirmationMessage, buildWhatsappLink } from '../../utils/whatsapp.ts';
import { errorHint, getErrorMessage } from '../../utils/errors.ts';
import { Button } from '../../components/ui/Button.tsx';
import { ErrorState, Spinner } from '../../components/ui/Feedback.tsx';
import { Avatar } from '../../components/ui/Avatar.tsx';
import { Logo } from '../../components/ui/Logo.tsx';
import { BookingCalendar } from '../../components/booking/BookingCalendar.tsx';

const STEPS = ['Serviço', 'Profissional', 'Data', 'Horário', 'Seus dados', 'Confirmação'];
const ANY = 'any';

export function BookingPage() {
  const { data: catalog, error, loading, reload } = useAsync(getBookingCatalog, []);

  useEffect(() => {
    if (catalog?.settings.name) document.title = `Agendar — ${catalog.settings.name}`;
  }, [catalog?.settings.name]);

  if (loading && !catalog) return <Shell><Spinner label="Carregando serviços..." /></Shell>;
  if (error || !catalog) {
    return <Shell><div className="p-5"><ErrorState message={error ?? 'Não foi possível carregar.'} onRetry={reload} /></div></Shell>;
  }
  return <Wizard catalog={catalog} />;
}

/* ----------------------------------------------------------------- Layout */
function Shell({ catalog, children }: { catalog?: BookingCatalog; children: ReactNode }) {
  const s = catalog?.settings;
  return (
    <div className="min-h-dvh bg-zinc-50">
      <header className="bg-ink-950 px-4 pt-6 pb-20 text-white sm:pt-8">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          {s?.logo_url
            ? <img src={s.logo_url} alt={s.name} className="mb-3 size-16 rounded-2xl bg-white object-contain p-1" />
            : <div className="mb-3"><Logo dark compact /></div>}
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{s?.name ?? 'BeautyAgenda'}</h1>
          {s?.welcome_message && <p className="mt-1.5 max-w-md text-sm text-zinc-400">{s.welcome_message}</p>}
          {(s?.address || s?.phone) && (
            <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-zinc-400">
              {s.address && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{s.address}</span>}
              {s.phone && <span className="flex items-center gap-1"><Phone className="size-3.5" />{s.phone}</span>}
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto -mt-14 max-w-xl px-3 pb-10 sm:px-4">
        <div className="card overflow-hidden shadow-lg shadow-zinc-900/5">{children}</div>
        <p className="mt-6 text-center text-xs text-zinc-400">
          Agendamento online por <span className="font-display font-semibold text-zinc-500">Beauty<span className="text-gold-600">Agenda</span></span>
        </p>
      </main>
    </div>
  );
}

/* ----------------------------------------------------------------- Wizard */
function Wizard({ catalog }: { catalog: BookingCatalog }) {
  const { search } = useLocation();
  const [service, setService] = useState<PublicService | null>(null);
  const [professional, setProfessional] = useState<string | null>(null); // id ou ANY
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<AvailableSlot | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<BookingResult | null>(null);

  // Etapa na URL (?etapa=N) → o botão "voltar" do celular volta uma etapa
  const requested = Number(search.get('etapa') ?? '1');
  const maxReachable = !service ? 1 : !professional ? 2 : !date ? 3 : !slot ? 4 : !normalizeWhatsapp(phone) || name.trim().length < 2 ? 5 : 6;
  const step = Math.min(Math.max(1, requested || 1), maxReachable);
  useEffect(() => {
    if (!result && requested !== step) navigate(step === 1 ? '/agendar' : `/agendar?etapa=${step}`, { replace: true });
  }, [requested, step, result]);

  const go = (n: number) => navigate(n === 1 ? '/agendar' : `/agendar?etapa=${n}`);
  const back = () => (step > 1 ? window.history.back() : undefined);

  const professionals = useMemo(
    () => (service ? catalog.professionals.filter((p) => p.service_ids?.includes(service.id)) : []),
    [catalog.professionals, service],
  );
  const proById = (id: string | null) => catalog.professionals.find((p) => p.id === id);
  const professionalId = professional === ANY ? null : professional;

  const restart = () => {
    setService(null); setProfessional(null); setDate(null); setSlot(null); setResult(null);
    navigate('/agendar', { replace: true });
  };

  if (result) {
    return <Shell catalog={catalog}><Success result={result} catalog={catalog} onRestart={restart} /></Shell>;
  }

  return (
    <Shell catalog={catalog}>
      {/* Progresso */}
      <div className="border-b border-zinc-100 px-5 pt-4 pb-3">
        <div className="flex items-center gap-3">
          {step > 1 ? (
            <button onClick={back} className="-ml-2 rounded-lg p-2 text-zinc-600 hover:bg-zinc-100" aria-label="Voltar">
              <ArrowLeft className="size-5" />
            </button>
          ) : <span className="size-9" />}
          <div className="flex-1 text-center">
            <p className="text-xs font-medium tracking-wide text-gold-600 uppercase">Etapa {step} de 6</p>
            <p className="font-semibold text-zinc-900">{STEPS[step - 1]}</p>
          </div>
          <span className="size-9" />
        </div>
        <div className="mt-3 flex gap-1">
          {STEPS.map((_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < step ? 'bg-gold-500' : 'bg-zinc-200'}`} />)}
        </div>
      </div>

      {/* Resumo das escolhas */}
      {step > 1 && service && (
        <div className="flex flex-wrap gap-1.5 border-b border-zinc-100 bg-zinc-50/70 px-5 py-2.5 text-xs">
          <Chip icon={<Scissors className="size-3" />} onClick={() => go(1)}>{service.name}</Chip>
          {step > 2 && professional && <Chip icon={<UserRound className="size-3" />} onClick={() => go(2)}>
            {professional === ANY ? 'Qualquer profissional' : proById(professional)?.name}</Chip>}
          {step > 3 && date && <Chip icon={<CalendarDays className="size-3" />} onClick={() => go(3)}>{formatDateKey(date)}</Chip>}
          {step > 4 && slot && <Chip icon={<Clock className="size-3" />} onClick={() => go(4)}>{slot.slot_label}</Chip>}
        </div>
      )}

      <div className="p-4 sm:p-5">
        {step === 1 && (
          <ServiceStep services={catalog.services} selected={service?.id ?? null} onSelect={(s) => {
            if (s.id !== service?.id) { setProfessional(null); setDate(null); setSlot(null); }
            setService(s);
            go(2);
          }} />
        )}
        {step === 2 && service && (
          <ProfessionalStep professionals={professionals} selected={professional} onSelect={(p) => {
            if (p !== professional) { setDate(null); setSlot(null); }
            setProfessional(p);
            go(3);
          }} />
        )}
        {step === 3 && service && (
          <BookingCalendar serviceId={service.id} professionalId={professionalId} maxAdvanceDays={catalog.settings.max_advance_days}
            value={date} onSelect={(d) => { if (d !== date) setSlot(null); setDate(d); go(4); }} />
        )}
        {step === 4 && service && date && (
          <TimeStep serviceId={service.id} professionalId={professionalId} date={date} selected={slot}
            onSelect={(s) => { setSlot(s); go(5); }} onChangeDate={() => go(3)} />
        )}
        {step === 5 && (
          <ClientStep name={name} phone={phone} onChange={(n, p) => { setName(n); setPhone(p); }}
            onSubmit={(n, p) => { setName(n); setPhone(p); setTimeout(() => go(6), 0); }} />
        )}
        {step === 6 && service && slot && date && (
          <ConfirmStep service={service} professionalLabel={professional === ANY ? 'Qualquer profissional disponível' : proById(professional)?.name ?? ''}
            date={date} slot={slot} name={name} phone={phone}
            onConfirm={async () => {
              const res = await bookAppointment({
                serviceId: service.id, startsAt: slot.slot_start, professionalId, clientName: name, clientWhatsapp: phone,
              });
              setResult(res);
              window.scrollTo({ top: 0 });
            }}
            onSlotTaken={() => { setSlot(null); go(4); }} />
        )}
      </div>
    </Shell>
  );
}

function Chip({ children, icon, onClick }: { children: ReactNode; icon: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-medium text-zinc-700 ring-1 ring-zinc-200 hover:ring-gold-400">
      {icon}{children}
    </button>
  );
}

/* ------------------------------------------------------------- Etapa 1 */
function ServiceStep({ services, selected, onSelect }: { services: PublicService[]; selected: string | null; onSelect: (s: PublicService) => void }) {
  if (services.length === 0) {
    return <p className="py-8 text-center text-zinc-500">Nenhum serviço disponível para agendamento online no momento.</p>;
  }
  const categories = [...new Set(services.map((s) => s.category))];
  return (
    <div className="space-y-6">
      {categories.map((cat) => (
        <section key={cat}>
          <h2 className="mb-2.5 px-1 text-xs font-semibold tracking-wider text-zinc-500 uppercase">{cat}</h2>
          <div className="space-y-2">
            {services.filter((s) => s.category === cat).map((s) => (
              <button key={s.id} onClick={() => onSelect(s)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition active:scale-[0.99]
                  ${selected === s.id ? 'border-gold-500 bg-gold-50 ring-1 ring-gold-500' : 'border-zinc-200 bg-white hover:border-gold-300'}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-zinc-900">{s.name}</p>
                  {s.description && <p className="mt-0.5 line-clamp-2 text-sm text-zinc-500">{s.description}</p>}
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-zinc-500"><Clock className="size-3.5" />{formatDuration(s.duration_minutes)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold whitespace-nowrap text-zinc-900">{formatCurrency(s.price)}</span>
                  <ChevronRight className="size-5 text-zinc-300" />
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- Etapa 2 */
function ProfessionalStep({ professionals, selected, onSelect }: {
  professionals: PublicProfessional[]; selected: string | null; onSelect: (id: string) => void;
}) {
  const option = (key: string, title: string, subtitle: string, avatar: ReactNode) => (
    <button key={key} onClick={() => onSelect(key)}
      className={`flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition active:scale-[0.99]
        ${selected === key ? 'border-gold-500 bg-gold-50 ring-1 ring-gold-500' : 'border-zinc-200 bg-white hover:border-gold-300'}`}>
      {avatar}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-zinc-900">{title}</p>
        <p className="text-sm text-zinc-500">{subtitle}</p>
      </div>
      <ChevronRight className="size-5 text-zinc-300" />
    </button>
  );
  return (
    <div className="space-y-2">
      {option(ANY, 'Qualquer profissional disponível', 'Mostramos todos os horários livres da equipe',
        <span className="flex size-12 items-center justify-center rounded-full bg-ink-950 text-gold-400"><Users className="size-5" /></span>)}
      {professionals.map((p) => option(p.id, p.name, p.specialties ?? 'Profissional', <Avatar name={p.name} src={p.photo_url} size={48} />))}
    </div>
  );
}

/* ------------------------------------------------------------- Etapa 4 */
function TimeStep({ serviceId, professionalId, date, selected, onSelect, onChangeDate }: {
  serviceId: string; professionalId: string | null; date: string; selected: AvailableSlot | null;
  onSelect: (s: AvailableSlot) => void; onChangeDate: () => void;
}) {
  const { data: slots, error, loading, reload } = useAsync(
    () => getAvailableSlots(serviceId, date, professionalId), [serviceId, date, professionalId],
  );
  if (loading && !slots) return <Spinner label="Buscando horários livres..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const groups = [
    { label: 'Manhã', items: (slots ?? []).filter((s) => s.slot_label < '12:00') },
    { label: 'Tarde', items: (slots ?? []).filter((s) => s.slot_label >= '12:00' && s.slot_label < '18:00') },
    { label: 'Noite', items: (slots ?? []).filter((s) => s.slot_label >= '18:00') },
  ].filter((g) => g.items.length);
  return (
    <div>
      <p className="mb-4 text-center text-sm text-zinc-600">{formatDayLong(date)}</p>
      {groups.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-zinc-600">Os horários deste dia acabaram de ser preenchidos.</p>
          <Button variant="secondary" className="mt-4" onClick={onChangeDate}>Escolher outra data</Button>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.label}>
              <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">{g.label}</h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {g.items.map((s) => (
                  <button key={s.slot_start} onClick={() => onSelect(s)}
                    className={`h-12 rounded-xl border text-base font-semibold transition active:scale-95
                      ${selected?.slot_start === s.slot_start ? 'border-ink-950 bg-ink-950 text-white' : 'border-zinc-200 bg-white text-zinc-900 hover:border-gold-400 hover:bg-gold-50'}`}>
                    {s.slot_label}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Etapa 5 */
function ClientStep({ name, phone, onChange, onSubmit }: {
  name: string; phone: string; onChange: (n: string, p: string) => void; onSubmit: (n: string, p: string) => void;
}) {
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (name.trim().length < 3) errs.name = 'Informe seu nome completo.';
    if (!normalizeWhatsapp(phone)) errs.phone = 'Número inválido. Informe DDD + número, ex.: (11) 98888-7777.';
    setErrors(errs);
    if (!Object.keys(errs).length) onSubmit(name.trim(), phone);
  };
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="text-sm text-zinc-500">Não é preciso criar conta. Usamos seu WhatsApp apenas para falar sobre o agendamento.</p>
      <label className="block">
        <span className="label">Nome completo</span>
        <input className="input h-12 text-base" autoComplete="name" value={name} onChange={(e) => onChange(e.target.value, phone)}
          placeholder="Seu nome e sobrenome" maxLength={120} />
        {errors.name && <span className="mt-1 block text-sm text-red-600">{errors.name}</span>}
      </label>
      <label className="block">
        <span className="label">WhatsApp</span>
        <input className="input h-12 text-base" type="tel" inputMode="tel" autoComplete="tel-national" value={phone}
          onChange={(e) => onChange(name, maskPhoneInput(e.target.value))} placeholder="(11) 98888-7777" />
        {errors.phone && <span className="mt-1 block text-sm text-red-600">{errors.phone}</span>}
      </label>
      <Button type="submit" size="lg" block>Continuar</Button>
    </form>
  );
}

/* ------------------------------------------------------------- Etapa 6 */
function ConfirmStep({ service, professionalLabel, date, slot, name, phone, onConfirm, onSlotTaken }: {
  service: PublicService; professionalLabel: string; date: string; slot: AvailableSlot; name: string; phone: string;
  onConfirm: () => Promise<void>; onSlotTaken: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; slotTaken: boolean } | null>(null);
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      const hint = errorHint(e);
      setError({ message: getErrorMessage(e), slotTaken: hint === 'SLOT_UNAVAILABLE' || hint === 'TOO_SOON' });
      setBusy(false);
    }
  };
  const rows: [string, string][] = [
    ['Serviço', service.name],
    ['Profissional', professionalLabel],
    ['Data', formatDayLong(date)],
    ['Horário', slot.slot_label],
    ['Duração', formatDuration(service.duration_minutes)],
    ['Valor', formatCurrency(service.price)],
    ['Nome', name],
    ['WhatsApp', formatPhone(normalizeWhatsapp(phone))],
  ];
  return (
    <div>
      <dl className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-zinc-500">{k}</dt>
            <dd className={`text-right font-medium ${k === 'Valor' ? 'text-lg text-zinc-900' : 'text-zinc-800'}`}>{v}</dd>
          </div>
        ))}
      </dl>
      {error && (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error.message}
          {error.slotTaken && (
            <button onClick={onSlotTaken} className="mt-2 block font-semibold underline">Escolher outro horário</button>
          )}
        </div>
      )}
      <Button size="lg" block className="mt-5 tracking-wide uppercase" loading={busy} onClick={confirm} icon={<Check className="size-5" />}>
        Confirmar agendamento
      </Button>
      <p className="mt-3 text-center text-xs text-zinc-500">Ao confirmar, o horário fica reservado para você.</p>
    </div>
  );
}

/* --------------------------------------------------------------- Sucesso */
function Success({ result, catalog, onRestart }: { result: BookingResult; catalog: BookingCatalog; onRestart: () => void }) {
  const pending = result.status === 'pending';
  const message = buildClientConfirmationMessage({
    service: result.service_name,
    professional: result.professional_name,
    date: formatDate(result.starts_at),
    time: toTimeLabel(result.starts_at),
    price: formatCurrency(result.price),
    code: result.code,
    clientName: result.client_name,
  });
  const wa = buildWhatsappLink(catalog.settings.whatsapp, message);
  return (
    <div className="px-5 py-8 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-50">
        <CircleCheck className="size-9 text-emerald-600" />
      </div>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight">{pending ? 'Agendamento recebido!' : 'Agendamento confirmado!'}</h2>
      <p className="mt-1 text-sm text-zinc-500">
        {pending ? 'O estabelecimento vai confirmar seu horário em breve.' : 'Seu horário está reservado.'}
      </p>
      <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-1.5 text-sm">
        Código <b className="font-mono tracking-wider">{result.code}</b>
      </p>

      <div className="mt-6 space-y-2.5 rounded-2xl border border-zinc-200 p-4 text-left text-sm">
        <p className="flex items-center gap-2.5"><Scissors className="size-4 text-gold-600" /><b>{result.service_name}</b> · {formatCurrency(result.price)}</p>
        <p className="flex items-center gap-2.5"><UserRound className="size-4 text-gold-600" />{result.professional_name}</p>
        <p className="flex items-center gap-2.5"><CalendarDays className="size-4 text-gold-600" />{formatDayLong(toDateKey(result.starts_at))}</p>
        <p className="flex items-center gap-2.5"><Clock className="size-4 text-gold-600" />{toTimeLabel(result.starts_at)} às {toTimeLabel(result.ends_at)} ({formatDuration(result.duration_minutes)})</p>
      </div>

      {wa ? (
        <>
          <a href={wa} target="_blank" rel="noreferrer"
            className="mt-6 flex h-13 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-semibold tracking-wide text-white uppercase shadow-sm hover:bg-emerald-700">
            <MessageCircle className="size-5" /> Confirmar pelo WhatsApp
          </a>
          <p className="mt-2 text-xs text-zinc-500">O WhatsApp abrirá com a mensagem pronta. Toque em <b>Enviar</b> para concluir o envio.</p>
        </>
      ) : (
        <p className="mt-6 rounded-xl bg-gold-50 px-4 py-3 text-sm text-gold-700">Guarde o código acima caso precise falar com o estabelecimento.</p>
      )}

      <button onClick={onRestart} className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900">
        <Sparkles className="size-4" /> Fazer outro agendamento
      </button>
    </div>
  );
}
