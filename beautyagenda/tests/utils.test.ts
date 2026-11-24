// Testes das regras puras (rodar com: npm test — requer Node 22.18+)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  zonedToDate, toDateKey, toTimeLabel, addDays, startOfWeek, monthGrid, weekdayOf, endOfMonth,
} from '../src/utils/datetime.ts';
import { formatCurrency, formatDateKey, formatDuration, parseMoney } from '../src/utils/format.ts';
import { normalizeWhatsapp, formatPhone, maskPhoneInput } from '../src/utils/phone.ts';
import { buildWhatsappLink, buildClientConfirmationMessage } from '../src/utils/whatsapp.ts';
import { toCsv } from '../src/utils/csv.ts';
import { getErrorMessage } from '../src/utils/errors.ts';

test('fuso America/Sao_Paulo independe do fuso do aparelho', () => {
  const d = zonedToDate('2026-11-19', '09:00');
  assert.equal(d.toISOString(), '2026-11-19T12:00:00.000Z');
  assert.equal(toTimeLabel(d), '09:00');
  assert.equal(toDateKey('2026-11-20T02:30:00Z'), '2026-11-19'); // 23:30 em SP
});

test('aritmética de datas', () => {
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(weekdayOf('2026-11-17'), 2); // terça
  assert.equal(startOfWeek('2026-11-22'), '2026-11-16'); // domingo → segunda anterior
  assert.equal(endOfMonth('2026-02-10'), '2026-02-28');
  const grid = monthGrid('2026-11-01');
  assert.equal(grid[0][0], '2026-10-26');
  assert.ok(grid.flat().includes('2026-11-30'));
});

test('formatação brasileira', () => {
  assert.equal(formatCurrency(1234.5).replace(/\s/g, ' '), 'R$ 1.234,50');
  assert.equal(formatDateKey('2026-11-19'), '19/11/2026');
  assert.equal(formatDuration(90), '1h30');
  assert.equal(formatDuration(45), '45 min');
  assert.equal(parseMoney('1.234,56'), 1234.56);
  assert.equal(parseMoney('45'), 45);
  assert.equal(parseMoney('45,5'), 45.5);
});

test('WhatsApp com DDI 55', () => {
  assert.equal(normalizeWhatsapp('(11) 98888-7777'), '5511988887777');
  assert.equal(normalizeWhatsapp('+55 (21) 3333-4444'), '552133334444');
  assert.equal(normalizeWhatsapp('011 98888-7777'), '5511988887777');
  assert.equal(normalizeWhatsapp('98888-7777'), null);
  assert.equal(normalizeWhatsapp('(11) 88888-7777'), null);
  assert.equal(formatPhone('5511988887777'), '(11) 98888-7777');
  assert.equal(maskPhoneInput('11988887777'), '(11) 98888-7777');
  assert.equal(buildWhatsappLink('(11) 98888-7777', 'Olá!'), 'https://wa.me/5511988887777?text=Ol%C3%A1!');
  assert.equal(buildWhatsappLink('123'), null);
});

test('mensagem de confirmação', () => {
  const msg = buildClientConfirmationMessage({
    service: 'Corte', professional: 'João', date: '19/11/2026', time: '09:00', price: 'R$ 45,00',
  });
  assert.match(msg, /^Olá! Gostaria de confirmar meu agendamento\./);
  assert.match(msg, /Horário: 09:00/);
  assert.match(msg, /Obrigado!$/);
});

test('CSV para Excel pt-BR', () => {
  const csv = toCsv([{ a: 'x;y', b: 10.5 }], [
    { header: 'A', value: (r) => r.a },
    { header: 'B', value: (r) => r.b },
  ]);
  assert.equal(csv, '﻿A;B\r\n"x;y";10,5');
});

test('mensagens de erro em português', () => {
  assert.equal(getErrorMessage({ code: 'P0001', message: 'Este horário não está mais disponível.' }),
    'Este horário não está mais disponível.');
  assert.match(getErrorMessage({ code: '23503', message: 'fk' }), /desativá-lo/);
  assert.equal(getErrorMessage({ message: 'Invalid login credentials' }), 'E-mail ou senha incorretos.');
});
