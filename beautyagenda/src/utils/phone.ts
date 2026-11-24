/**
 * Telefones brasileiros. Formato canônico no banco: 55 + DDD + número
 * (12 dígitos fixo, 13 dígitos celular). Espelha public.normalize_whatsapp.
 */
export function normalizeWhatsapp(value: string | null | undefined): string | null {
  let d = (value ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  if (!/^55[1-9]{2}\d{8,9}$/.test(d)) return null;
  if (d.length === 13 && d[4] !== '9') return null;
  return d;
}

/** '5511988887777' → '(11) 98888-7777' */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return '';
  let d = value.replace(/\D/g, '');
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value;
}

/** Máscara durante a digitação: (11) 98888-7777 */
export function maskPhoneInput(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
