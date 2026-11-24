import { normalizeWhatsapp } from './phone.ts';

/**
 * Links wa.me (sem API paga). O link apenas ABRE o WhatsApp com a mensagem
 * preenchida — o envio só acontece quando a pessoa toca em "Enviar".
 */
export function buildWhatsappLink(phone: string | null | undefined, message?: string): string | null {
  const number = normalizeWhatsapp(phone);
  if (!number) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${number}${text}`;
}

export interface ConfirmationData {
  service: string;
  professional: string;
  date: string; // DD/MM/AAAA
  time: string; // HH:MM
  price: string; // R$ 0,00
  code?: string;
  clientName?: string;
}

/** Mensagem do cliente para o estabelecimento após agendar. */
export function buildClientConfirmationMessage(d: ConfirmationData): string {
  return [
    'Olá! Gostaria de confirmar meu agendamento.',
    '',
    `Serviço: ${d.service}`,
    `Profissional: ${d.professional}`,
    `Data: ${d.date}`,
    `Horário: ${d.time}`,
    `Valor: ${d.price}`,
    ...(d.code ? [`Código: ${d.code}`] : []),
    ...(d.clientName ? [`Nome: ${d.clientName}`] : []),
    '',
    'Obrigado!',
  ].join('\n');
}

/** Mensagem do estabelecimento para o cliente (aberta pelo painel). */
export function buildAdminReminderMessage(d: ConfirmationData & { businessName: string }): string {
  const first = d.clientName ? d.clientName.split(' ')[0] : '';
  return [
    `Olá${first ? `, ${first}` : ''}! Aqui é do ${d.businessName}.`,
    '',
    'Passando para lembrar do seu agendamento:',
    `Serviço: ${d.service}`,
    `Profissional: ${d.professional}`,
    `Data: ${d.date}`,
    `Horário: ${d.time}`,
    `Valor: ${d.price}`,
    '',
    'Podemos confirmar?',
  ].join('\n');
}
