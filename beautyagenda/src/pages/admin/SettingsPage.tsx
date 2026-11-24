import { useEffect, useState } from 'react';
import { Camera, Copy, ExternalLink, KeyRound, MessageCircle, Save } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.ts';
import { useToast } from '../../contexts/ToastContext.tsx';
import { getSettings, updateSettings } from '../../services/settings.ts';
import { uploadImage } from '../../services/storage.ts';
import { changePassword } from '../../services/auth.ts';
import type { BusinessSettings } from '../../types/index.ts';
import { formatPhone, maskPhoneInput, normalizeWhatsapp } from '../../utils/phone.ts';
import { buildWhatsappLink } from '../../utils/whatsapp.ts';
import { getErrorMessage } from '../../utils/errors.ts';
import { PageHeader } from '../../components/ui/PageHeader.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { ErrorState, Spinner } from '../../components/ui/Feedback.tsx';
import { Field, Input, Select, Textarea, Toggle } from '../../components/ui/Field.tsx';

export default function SettingsPage() {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(getSettings, []);
  const [form, setForm] = useState<BusinessSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const publicUrl = `${window.location.origin}/agendar`;

  useEffect(() => {
    if (data) setForm({ ...data, whatsapp: data.whatsapp ? formatPhone(data.whatsapp) : '' });
  }, [data]);

  if (loading && !form) return <Spinner />;
  if (error || !form) return <ErrorState message={error ?? 'Erro'} onRetry={reload} />;

  const set = <K extends keyof BusinessSettings>(k: K, v: BusinessSettings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const onLogo = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      set('logo_url', await uploadImage(file, 'logo'));
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (form.name.trim().length < 2) return toast.error('Informe o nome do estabelecimento.');
    const wa = form.whatsapp ? normalizeWhatsapp(form.whatsapp) : null;
    if (form.whatsapp && !wa) return toast.error('WhatsApp inválido. Informe DDD + número.');
    setBusy(true);
    try {
      await updateSettings({
        logo_url: form.logo_url,
        min_advance_minutes: form.min_advance_minutes,
        max_advance_days: form.max_advance_days,
        slot_interval_minutes: form.slot_interval_minutes,
        auto_confirm: form.auto_confirm,
        name: form.name.trim(),
        whatsapp: wa,
        phone: form.phone?.trim() || null,
        address: form.address?.trim() || null,
        welcome_message: form.welcome_message?.trim() || null,
      });
      toast.success('Configurações salvas.');
      reload();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Link copiado!');
    } catch {
      toast.info(publicUrl);
    }
  };

  const shareText = `Agende seu horário no ${form.name}: ${publicUrl}`;

  return (
    <>
      <PageHeader title="Configurações" description="Dados exibidos na página pública e regras de agendamento."
        actions={<Button icon={<Save className="size-4" />} onClick={save} loading={busy} disabled={uploading}>Salvar</Button>} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card space-y-4 p-5">
            <h2 className="font-semibold">Estabelecimento</h2>
            <div className="flex items-center gap-4">
              <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
                {form.logo_url ? <img src={form.logo_url} alt="Logo" className="size-full object-contain" /> : <span className="text-xs text-zinc-400">Sem logo</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50">
                  <Camera className="size-4" />{uploading ? 'Enviando...' : 'Enviar logo'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
                </label>
                {form.logo_url && <button className="text-left text-xs text-red-600" onClick={() => set('logo_url', null)}>Remover logo</button>}
              </div>
            </div>
            <Field label="Nome da barbearia / salão"><Input value={form.name} maxLength={80} onChange={(e) => set('name', e.target.value)} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="WhatsApp" hint="Recebe as mensagens de confirmação dos clientes.">
                <Input value={form.whatsapp ?? ''} inputMode="tel" onChange={(e) => set('whatsapp', maskPhoneInput(e.target.value))} placeholder="(11) 98888-7777" />
              </Field>
              <Field label="Telefone"><Input value={form.phone ?? ''} maxLength={30} onChange={(e) => set('phone', e.target.value)} placeholder="(11) 3333-4444" /></Field>
            </div>
            <Field label="Endereço"><Input value={form.address ?? ''} maxLength={200} onChange={(e) => set('address', e.target.value)} placeholder="Rua, número — bairro, cidade" /></Field>
            <Field label="Mensagem de boas-vindas"><Textarea value={form.welcome_message ?? ''} maxLength={300} rows={2} onChange={(e) => set('welcome_message', e.target.value)} /></Field>
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="font-semibold">Regras do agendamento online</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Antecedência mínima">
                <Select value={form.min_advance_minutes} onChange={(e) => set('min_advance_minutes', Number(e.target.value))}>
                  {[[0, 'Sem antecedência'], [30, '30 minutos'], [60, '1 hora'], [120, '2 horas'], [180, '3 horas'], [360, '6 horas'], [720, '12 horas'], [1440, '1 dia'], [2880, '2 dias']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </Field>
              <Field label="Agendar até">
                <Select value={form.max_advance_days} onChange={(e) => set('max_advance_days', Number(e.target.value))}>
                  {[7, 14, 30, 45, 60, 90, 120, 180].map((d) => <option key={d} value={d}>{d} dias à frente</option>)}
                </Select>
              </Field>
              <Field label="Intervalo entre horários">
                <Select value={form.slot_interval_minutes} onChange={(e) => set('slot_interval_minutes', Number(e.target.value))}>
                  {[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>A cada {m} min</option>)}
                </Select>
              </Field>
            </div>
            <Toggle checked={form.auto_confirm} onChange={(v) => set('auto_confirm', v)}
              label="Confirmar automaticamente os agendamentos online (desligado: entram como Pendente)" />
            <p className="text-xs text-zinc-500">Os horários de funcionamento ficam em <b>Horários e folgas</b>.</p>
          </section>
        </div>

        <section className="card h-fit space-y-4 p-5">
          <h2 className="font-semibold">Link de agendamento</h2>
          <p className="text-sm text-zinc-500">Compartilhe no WhatsApp, Instagram e Google.</p>
          <div className="rounded-xl bg-zinc-50 px-3 py-2.5 text-sm break-all text-zinc-800">{publicUrl}</div>
          <div className="grid gap-2">
            <Button variant="secondary" icon={<Copy className="size-4" />} onClick={copyLink}>Copiar link</Button>
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[15px] font-medium text-white hover:bg-emerald-700">
              <MessageCircle className="size-4" /> Compartilhar no WhatsApp
            </a>
            <a href="/agendar" target="_blank" rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl text-[15px] font-medium text-zinc-700 hover:bg-zinc-100">
              <ExternalLink className="size-4" /> Abrir página
            </a>
          </div>
          {form.whatsapp && buildWhatsappLink(form.whatsapp) && (
            <p className="text-xs text-zinc-500">Clientes confirmarão para {formatPhone(normalizeWhatsapp(form.whatsapp))}.</p>
          )}
        </section>
        <PasswordCard />
      </div>
    </>
  );
}

function PasswordCard() {
  const toast = useToast();
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (pwd.length < 8) return toast.error('A senha deve ter pelo menos 8 caracteres.');
    if (pwd !== confirm) return toast.error('As senhas não conferem.');
    setBusy(true);
    try {
      await changePassword(pwd);
      setPwd('');
      setConfirm('');
      toast.success('Senha alterada.');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card h-fit space-y-4 p-5 lg:col-start-3">
      <h2 className="flex items-center gap-2 font-semibold"><KeyRound className="size-4 text-gold-600" />Alterar minha senha</h2>
      <Field label="Nova senha"><Input type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} /></Field>
      <Field label="Repita a nova senha"><Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
      <Button variant="secondary" block onClick={save} loading={busy}>Salvar nova senha</Button>
    </section>
  );
}
