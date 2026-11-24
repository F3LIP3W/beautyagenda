# BeautyAgenda

Sistema de agendamento online para **uma barbearia / salão de beleza** com vários profissionais.

- **Clientes** agendam pelo link público `/agendar` — sem criar conta, só nome e WhatsApp.
- **Administrador** gerencia tudo em `/admin`: agenda, profissionais, serviços, clientes, horários, relatórios e configurações.

Tecnologias: React + TypeScript + Vite + Tailwind CSS · Supabase (PostgreSQL, Auth, Storage) · Lucide · Vercel.
Custo inicial: **R$ 0** (planos gratuitos do Supabase e da Vercel).

---

## Sumário

1. [O que o sistema faz](#1-o-que-o-sistema-faz)
2. [Configurar o Supabase (gratuito)](#2-configurar-o-supabase-gratuito)
3. [Criar o primeiro administrador](#3-criar-o-primeiro-administrador)
4. [Rodar no seu computador (Windows)](#4-rodar-no-seu-computador-windows)
5. [Publicar na Vercel](#5-publicar-na-vercel)
6. [Primeiros passos no painel](#6-primeiros-passos-no-painel)
7. [Testes](#7-testes)
8. [Segurança](#8-segurança)
9. [Estrutura do projeto](#9-estrutura-do-projeto)
10. [Limites do plano gratuito e cuidados](#10-limites-do-plano-gratuito-e-cuidados)

---

## 1. O que o sistema faz

| Área | Recursos |
|---|---|
| Agendamento público | 6 etapas (serviço → profissional ou "qualquer disponível" → data → horário → dados → confirmação), só horários realmente livres, código único (ex.: `BA7K3QX2`), botão **CONFIRMAR PELO WHATSAPP** com mensagem pronta |
| Dashboard | Agendamentos de hoje (total, confirmados, pendentes, cancelados), faturamento previsto, clientes, próximos atendimentos, serviços mais realizados, atalhos |
| Agenda | Visão diária (uma coluna por profissional), semanal e mensal; filtro por profissional; horários livres, fora do expediente e bloqueados; clique num horário livre para agendar; detalhes, confirmar, concluir, não compareceu, cancelar, reagendar, WhatsApp do cliente |
| Profissionais | Cadastro, edição, foto, telefone, especialidades, serviços que realiza, jornada semanal com almoço, folgas semanais, ativar/desativar, excluir |
| Serviços | Nome, categoria, descrição, preço, duração, profissionais, ativo/inativo (13 serviços iniciais editáveis) |
| Clientes | Cadastro automático no agendamento, busca por nome ou telefone, histórico, último atendimento, quantidade, total gasto |
| Horários e folgas | Funcionamento do estabelecimento, bloqueios (folga em data, compromisso, feriado — de um profissional ou de todos), exceções de horário |
| Relatórios | Faturamento diário/semanal/mensal, realizado (só **concluídos**) × previsto, serviços, profissionais e clientes mais frequentes, período livre, exportação **CSV** (abre no Excel) |
| Configurações | Nome, logo, telefone, WhatsApp, endereço, mensagem de boas-vindas, antecedência mínima, limite de dias, intervalo entre horários, confirmação automática ou manual |
| PWA | Instala na tela inicial com ícone próprio (sem agendamento offline, de propósito) |

Formato brasileiro em tudo: R$, DD/MM/AAAA, 24 horas e fuso **America/Sao_Paulo** (mesmo se o cliente estiver com o celular em outro fuso).

---

## 2. Configurar o Supabase (gratuito)

### 2.1 Criar o projeto
1. Acesse **https://supabase.com** → **Start your project** → entre com GitHub ou e-mail (não pede cartão).
2. Clique em **New project**.
3. Preencha: **Name** `beautyagenda` · **Database Password**: crie uma senha forte e **guarde-a** · **Region**: `South America (São Paulo)`.
4. Clique em **Create new project** e aguarde ~2 minutos.

### 2.2 Criar o banco (tabelas, funções e segurança) — um único passo
1. No menu lateral, clique em **SQL Editor** → **New query**.
2. Abra o arquivo **`supabase/SETUP_COMPLETO.sql`** deste projeto (Bloco de Notas ou VS Code), selecione tudo (**Ctrl+A**), copie (**Ctrl+C**).
3. Cole no SQL Editor (**Ctrl+V**) e clique em **Run** (ou **Ctrl+Enter**).
4. **Como verificar:** deve aparecer *"Success. No rows returned"*. Em **Table Editor** você verá as tabelas `appointments`, `clients`, `professionals`, `services` etc., e a tabela `services` terá 13 serviços.

> Se o Supabase avisar sobre "operação destrutiva" ou pedir confirmação, pode confirmar: o script só cria o que ainda não existe.

### 2.3 (Opcional) Profissionais de demonstração
Para testar rapidamente, rode também **`supabase/seed_demo.sql`** (mesmo procedimento). Ele cria João (barbeiro), Maria (cabeleireira) e Ana (manicure) com jornada de segunda a sábado. Depois edite ou desative pelo painel. Não cria clientes nem agendamentos falsos.

### 2.4 Desligar o cadastro público de usuários
1. Menu **Authentication** → **Sign In / Providers** (ou **Providers**).
2. Em **User Signups**, desligue **Allow new users to sign up** → **Save**.

> Mesmo que fique ligado, quem se cadastrar **não acessa nada**: só quem está na tabela `profiles` como `admin` entra no painel (testado).

### 2.5 Copiar a URL e a chave pública
1. Clique no botão **Connect** no topo do projeto (ou **Project Settings → API Keys**).
2. Copie a **Project URL** (ex.: `https://abcdxyz.supabase.co`).
3. Copie a **Publishable key** (começa com `sb_publishable_...`).
   - Projetos antigos podem mostrar a chave legada **anon public** (começa com `eyJ...`) na aba *Legacy API Keys*; ela também funciona, mas o Supabase está descontinuando as chaves legadas no fim de 2026 — prefira a publishable.
4. **Nunca** use a *secret key* / *service_role* no site.

Você vai colar esses dois valores no `.env` (passo 4) e na Vercel (passo 5).

---

## 3. Criar o primeiro administrador

1. Menu **Authentication** → **Users** → **Add user** → **Create new user**.
2. Informe seu e-mail e uma senha forte, marque **Auto Confirm User** → **Create user**.
3. Vá em **SQL Editor** → **New query**, cole o conteúdo de **`supabase/criar_admin.sql`**, **troque o e-mail** na linha indicada e clique em **Run**.
4. **Como verificar:** o resultado mostra uma linha com seu e-mail e `admin`.

Para trocar a senha depois: **Painel → Configurações → Alterar minha senha**. Esqueceu a senha? Crie outro usuário no Supabase e repita este passo com o novo e-mail.

---

## 4. Rodar no seu computador (Windows)

Pré-requisito: **Node.js 22 LTS** — baixe em https://nodejs.org (botão LTS) e instale com as opções padrão.

1. Extraia a pasta do projeto, por exemplo em `C:\BeautyAgenda`.
2. Na pasta, copie o arquivo `.env.example` e renomeie a cópia para `.env`. Abra no Bloco de Notas e cole:
   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxx
   ```
   (a variável se chama `ANON_KEY`, mas recebe a publishable key — é a mesma função.)
3. Abra o **PowerShell** dentro da pasta (no Explorer: clique na barra de endereço, digite `powershell` e Enter) e rode:
   ```powershell
   npm install
   npm run dev
   ```
4. Abra **http://localhost:5173/agendar** (página do cliente) e **http://localhost:5173/admin** (painel).

Outros comandos úteis:
```powershell
npm run build      # gera a versão de produção em dist/
npm run check      # verificação completa de tipos + build
npm test           # testes das regras de formatação/telefone/CSV
```

---

## 5. Publicar na Vercel

### Opção A — pelo GitHub (recomendado, atualiza sozinho)
1. Crie uma conta em **https://github.com** e um repositório novo, privado, chamado `beautyagenda` (**New repository** → **Create repository**).
2. Na página do repositório, clique em **uploading an existing file** e arraste **todo o conteúdo da pasta do projeto, exceto** `node_modules`, `dist` e o arquivo `.env`. Clique em **Commit changes**.
3. Acesse **https://vercel.com** → **Sign Up** com a conta do GitHub (plano **Hobby**, gratuito).
4. **Add New… → Project** → ao lado de `beautyagenda`, clique em **Import**.
5. A Vercel detecta **Vite** sozinha. Abra **Environment Variables** e adicione:
   - `VITE_SUPABASE_URL` = sua Project URL
   - `VITE_SUPABASE_ANON_KEY` = sua publishable key
6. Clique em **Deploy** e aguarde ~1 minuto.
7. **Como verificar:** abra o endereço gerado (ex.: `https://beautyagenda.vercel.app/agendar`) — os serviços devem aparecer. Entre em `/admin` com o administrador do passo 3.

### Opção B — pela linha de comando
```powershell
npx vercel           # responda às perguntas (aceite os padrões)
npx vercel env add VITE_SUPABASE_URL
npx vercel env add VITE_SUPABASE_ANON_KEY
npx vercel --prod
```

### Depois de publicar
- No Supabase: **Authentication → URL Configuration → Site URL** = seu endereço da Vercel.
- Divulgue o link `https://SEU-ENDERECO/agendar` (há botão **Copiar link** e **Compartilhar no WhatsApp** em *Configurações*).
- Domínio próprio (opcional, pago à parte): Vercel → Project → **Settings → Domains**.

### Instalar como aplicativo (PWA)
- **Android (Chrome):** abra o site → menu ⋮ → **Instalar app** / **Adicionar à tela inicial**.
- **iPhone (Safari):** botão Compartilhar → **Adicionar à Tela de Início**.

---

## 6. Primeiros passos no painel

1. **Configurações:** nome, logo, **WhatsApp** (recebe as confirmações dos clientes), endereço e regras (antecedência mínima, até quantos dias à frente, intervalo entre horários).
2. **Horários e folgas:** confira o funcionamento (padrão: seg–sáb 09:00–19:00).
3. **Serviços:** ajuste preços e durações dos 13 serviços iniciais.
4. **Profissionais:** cadastre a equipe, marque os serviços de cada um e a jornada (com almoço). Um profissional sem serviços não aparece no agendamento.
5. Abra `/agendar` e faça um agendamento de teste.

**Status dos agendamentos:** Pendente (só se a confirmação automática estiver desligada) · Confirmado · Concluído · Cancelado · Não compareceu. Cancelado e "não compareceu" liberam o horário na hora. O histórico nunca é apagado.

**Faturamento:** *realizado* soma só atendimentos **Concluídos**; *previsto* soma pendentes + confirmados. Marque os atendimentos como concluídos no fim do dia para os relatórios ficarem corretos.

**WhatsApp:** o sistema abre o WhatsApp com a mensagem pronta (links `wa.me`, sem API paga). **O envio só acontece quando a pessoa toca em Enviar** — nada é enviado automaticamente.

---

## 7. Testes

### Testes do banco (dentro do Supabase)
Em **SQL Editor**, cole e rode **`supabase/tests/booking_tests.sql`** (depois de criar o administrador). Ele roda ~20 verificações dentro de uma transação e **desfaz tudo no final** — nada fica gravado. Deve terminar com `=== TODOS OS TESTES PASSARAM ===` nas mensagens.

Cobre: horários respeitando jornada, almoço e duração completa do serviço; conflito para o mesmo profissional; duplicidade do mesmo cliente; "qualquer profissional"; validações; bloqueios; exceções; cancelamento liberando horário; restrição do banco contra sobreposição; reagendamento; encaixe; relatórios; histórico; e permissões (visitante não lê clientes/agendamentos nem chama funções administrativas; usuário logado sem perfil admin não vê nada).

### Testes das regras do frontend
```powershell
npm test
```

### O que já foi testado no desenvolvimento
- Migrações aplicadas em PostgreSQL 16 com papéis equivalentes aos do Supabase (`anon`/`authenticated`) e RLS ativo.
- **Concorrência real:** 20 clientes tentando o mesmo horário ao mesmo tempo → exatamente 1 agendamento; os demais recebem "Este horário não está mais disponível".
- Teste ponta a ponta no navegador (Chromium) contra o banco real, nos 18 itens obrigatórios: login, proteção do painel, profissionais, serviços, associação, horários, bloqueio, agendamento público (profissional específico e qualquer disponível), duplicidade, cancelamento e liberação, histórico, link do WhatsApp, relatórios/CSV, responsividade em 390 px — sem erros no console.

---

## 8. Segurança

- **Row Level Security** em todas as tabelas. O visitante só lê configurações públicas, horário de funcionamento e serviços ativos.
- O agendamento público acontece **somente** pela função `book_appointment` (`SECURITY DEFINER`, `search_path` fixo), que valida nome, WhatsApp, serviço, profissional, antecedência e limite de dias, cria/atualiza o cliente e o agendamento **numa única transação**.
- **Conflitos impossíveis no banco:** restrição `EXCLUDE` (btree_gist) impede dois atendimentos ativos sobrepostos para o mesmo profissional, mesmo com requisições simultâneas; travas por profissional e por cliente evitam corrida e clique duplo.
- Limite anti-abuso: no máximo 3 agendamentos futuros por WhatsApp pelo link público (o admin pode criar mais).
- Funções internas não são executáveis pela API; funções do painel verificam `is_admin()`.
- Só a chave **pública** vai para o navegador. A *secret / service_role* não é usada em lugar nenhum.
- O painel exige login **e** perfil admin; acessar `/admin` pela URL sem isso redireciona para o login — e, mesmo burlando a tela, o banco não entrega dados.
- Upload de imagens: bucket `public-assets`, só admin envia; PNG/JPG/WEBP até 2 MB.

---

## 9. Estrutura do projeto

```
beautyagenda/
├─ supabase/
│  ├─ migrations/            # 001 tabelas · 002 funções · 003 segurança · 004 storage · 005 dados iniciais
│  ├─ SETUP_COMPLETO.sql     # todas as migrações num arquivo só (para colar no SQL Editor)
│  ├─ criar_admin.sql        # promove um usuário a administrador
│  ├─ seed_demo.sql          # profissionais de demonstração (opcional)
│  └─ tests/booking_tests.sql
├─ public/                   # manifest PWA, service worker, ícones
├─ src/
│  ├─ components/ui/         # botões, campos, modal, avisos, data/hora (reutilizáveis)
│  ├─ components/admin/      # novo agendamento, detalhes/reagendar, grade de horários
│  ├─ components/booking/    # calendário público
│  ├─ pages/public/          # /agendar
│  ├─ pages/admin/           # login, dashboard, agenda, profissionais, serviços, clientes, horários, relatórios, configurações
│  ├─ layouts/               # menu lateral do painel
│  ├─ services/              # consultas ao Supabase (uma por assunto)
│  ├─ contexts/              # autenticação e avisos
│  ├─ hooks/                 # carregamento de dados
│  ├─ lib/                   # cliente Supabase e roteador
│  ├─ types/                 # tipos TypeScript
│  └─ utils/                 # datas/fuso, moeda, telefone, WhatsApp, CSV, erros
├─ tests/                    # testes das regras (node --test)
├─ vercel.json               # rotas da SPA, cache e cabeçalhos
└─ .env.example
```

### Tabelas
`profiles` (admins) · `business_settings` · `working_hours` (estabelecimento) · `professionals` · `services` · `professional_services` · `professional_working_hours` · `time_blocks` (bloqueios/folgas) · `schedule_exceptions` (horário especial numa data) · `clients` · `appointments`.
Views do painel: `appointment_details`, `client_overview`.

### Funções principais (RPC)
| Função | Quem chama | O que faz |
|---|---|---|
| `get_booking_catalog()` | público | serviços, profissionais (sem telefone) e configurações públicas |
| `get_available_dates(...)` | público | dias com horário livre |
| `get_available_slots(...)` | público/admin | horários livres e quais profissionais atendem |
| `book_appointment(...)` | público | agenda com validação e trava |
| `admin_create_appointment(...)` | admin | agendamento manual / encaixe |
| `admin_reschedule_appointment(...)` | admin | reagenda |
| `dashboard_stats(...)`, `report_data(...)` | admin | indicadores e relatórios |

---

## 10. Limites do plano gratuito e cuidados

- **Pausa por inatividade:** o Supabase pausa projetos gratuitos após 7 dias com pouca atividade. Com agendamentos e acesso ao painel diários isso não acontece; se pausar, entre no Supabase e clique em **Resume project** (os dados são mantidos). O plano Pro (pago) elimina a pausa.
- **Backup:** o plano gratuito não inclui backups automáticos. Exporte os agendamentos em **Relatórios → Exportar agendamentos** periodicamente.
- Limites do plano gratuito (500 MB de banco, 1 GB de arquivos) são muito superiores ao uso de um salão.
- Datas e horários são sempre do fuso de São Paulo; o banco grava em UTC internamente.

### Solução de problemas
| Sintoma | Causa provável / solução |
|---|---|
| Tela "Configuração pendente" | `.env` ou variáveis da Vercel ausentes. Na Vercel, após adicionar, faça **Redeploy**. |
| "Este usuário não tem permissão de administrador" | Falta rodar `criar_admin.sql` com o e-mail correto. |
| "E-mail ou senha incorretos" | Confira o usuário em Authentication → Users (precisa estar confirmado). |
| Nenhum serviço aparece em `/agendar` | O serviço precisa estar ativo e ter ao menos um profissional ativo vinculado. |
| Nenhum dia disponível | Confira jornada do profissional, funcionamento do estabelecimento e "agendar até X dias". |
| Página em branco ao recarregar na Vercel | O `vercel.json` precisa estar na raiz do projeto enviado. |
