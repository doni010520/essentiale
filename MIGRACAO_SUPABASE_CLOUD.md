# Migrar Supabase Self-Hosted para Supabase Cloud

## Por que migrar?

O Supabase self-hosted no Easypanel tem dado problemas:
- Realtime retornando 503 constantemente
- Gerenciamento manual de containers (PostgREST, Realtime, Auth, Storage)
- Sem backups automáticos, sem dashboard, sem observability
- Supabase Cloud resolve tudo isso: managed, com dashboard, backups, Realtime estavel

---

## O que EU (Claude) preciso de VOCE

Preencha cada item abaixo. Depois cole de volta na conversa.

### 1. Projeto Supabase Cloud

Crie um projeto em https://supabase.com/dashboard (plano Free ou Pro).

```
PROJETO_REF (ex: abcdefghijkl):
REGIAO (ex: sa-east-1):
NEXT_PUBLIC_SUPABASE_URL (ex: https://abcdefghijkl.supabase.co):
NEXT_PUBLIC_SUPABASE_ANON_KEY:
SUPABASE_SERVICE_ROLE_KEY:
DATABASE_URL (Settings > Database > Connection string - URI):
```

> Dica: va em Settings > API para pegar URL + keys.
> Dica: va em Settings > Database para pegar a connection string.

### 2. Senha do banco

```
POSTGRES_PASSWORD (a que voce definiu ao criar o projeto):
```

### 3. Link do projeto ao MCP Supabase (opcional mas recomendado)

Se voce tiver o Supabase MCP conectado no Claude, eu consigo rodar as migrations
direto. Caso contrario, eu gero os comandos SQL e voce roda no SQL Editor do dashboard.

```
Supabase MCP conectado? (sim/nao):
```

---

## O que EU vou fazer (automaticamente)

### Etapa 1 — Schema (migrations)

Rodar as 16 migrations em ordem no banco cloud:

| # | Migration | Descricao |
|---|-----------|-----------|
| 0001 | init | Tabelas base (organizations, profiles, channels, contacts, conversations, messages, ai_agents, etc.) |
| 0002 | rls | Politicas RLS multi-tenant |
| 0003 | realtime | Habilitar Realtime nas tabelas |
| 0004 | views | View conversation_overview |
| 0005 | avatars_bucket | Bucket Storage para avatares |
| 0006 | groups_mute | Campos grupos + mute |
| 0007 | media_bucket | Bucket Storage para midias |
| 0008 | message_interactions | Reacoes, edicao, encaminhamento |
| 0009 | bot_state | bot_automation_id + bot_node_id |
| 0010 | author_phone | Campo author_phone em messages |
| 0011 | group_jid_lid | Campos JID/LID para grupos |
| 0012 | avatar_src | Campo avatar_src |
| 0013 | protocol_close | Protocolo + motivo encerramento |
| 0014 | full_parity | Paridade completa Chatmix |
| 0015 | conversation_ai | Toggle ai_enabled por conversa |
| 0016 | ai_allowlist | Tabela ai_allowed_numbers |

### Etapa 2 — Dados (se houver)

Migrar dados existentes do banco self-hosted para o cloud:
- Organizations, profiles (usuarios)
- Channels configurados
- Contacts, conversations, messages (historico)
- Automations, ai_agents, ai_allowed_numbers
- Tags, departments, quick_replies, etc.

Para isso preciso de acesso ao banco antigo. Opcoes:
- **A)** Voce me da a connection string do Postgres self-hosted (Easypanel)
- **B)** Voce exporta um dump (`pg_dump`) e me passa o arquivo
- **C)** Comecar do zero (sem historico)

```
Opcao de dados (A / B / C):
Se A, connection string do banco antigo:
Se B, caminho do arquivo de dump:
```

### Etapa 3 — Auth (usuarios)

Os usuarios (auth.users) do Supabase self-hosted NAO migram automaticamente.
Opcoes:
- **Resetar senhas** — usuarios fazem "Esqueci minha senha" no primeiro login
- **Recriar manualmente** — eu recrio via admin API (sem senha original)
- **Comecar do zero** — so existe 1-2 usuarios, mais facil recadastrar

```
Opcao de auth (resetar / recriar / zero):
```

### Etapa 4 — Storage (buckets)

Buckets `avatars` e `media` precisam ser recriados.
Se houver arquivos (fotos de contato, midias enviadas), precisa migrar.

```
Tem midias/avatares que precisam ser preservados? (sim/nao):
```

### Etapa 5 — Env vars da aplicacao

Eu atualizo automaticamente:

| Variavel | Atual (self-hosted) | Nova (cloud) |
|----------|-------------------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://liriel-mvf-sb.zsvt2k.easypanel.host` | `https://SEU-PROJETO.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...Z00` (JWT HS256 self-hosted) | Nova key do projeto cloud |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...xM` (JWT HS256 self-hosted) | Nova key do projeto cloud |

Essas vars tambem precisam ser atualizadas no **Easypanel** (servico `mvf-app`):

```
Voce atualiza no Easypanel ou eu gero o comando tRPC?:
```

### Etapa 6 — Outras env vars (manter como estao)

Estas NAO mudam — so precisam existir no Easypanel:

| Variavel | Descricao | Status |
|----------|-----------|--------|
| `OPENAI_API_KEY` | Chave OpenAI para agente IA | Manter |
| `SGP_ENCRYPTION_KEY` | Chave AES-GCM para criptografar config SGP | Manter |
| `UAZAPI_HOST` | URL do painel UAZAPI | Manter |
| `UAZAPI_ADMIN_TOKEN` | Token admin UAZAPI | Manter |
| `UAZAPI_WEBHOOK_TOKEN` | Token de autenticacao do webhook UAZAPI | Manter |
| `APP_BASE_URL` | URL publica do app (para webhooks) | Manter |
| `META_APP_ID` | ID do app Meta | Manter |
| `META_APP_SECRET` | Secret do app Meta | Manter |
| `META_VERIFY_TOKEN` | Token de verificacao webhook Meta | Manter |
| `META_GRAPH_VERSION` | Versao da Graph API | Manter |
| `NEXT_PUBLIC_META_APP_ID` | ID Meta (client-side) | Manter |
| `NEXT_PUBLIC_META_CONFIG_ID` | Config ID Meta (client-side) | Manter |
| `CRON_SECRET` | Autenticacao do cron job | Manter |

### Etapa 7 — Webhooks

Os webhooks do UAZAPI/Meta apontam para `APP_BASE_URL/api/webhooks/...`.
Como o app continua no mesmo dominio, **nada muda** nos webhooks.

### Etapa 8 — Realtime

No Supabase Cloud, Realtime ja vem funcionando.
So preciso habilitar nas tabelas certas (migration 0003 faz isso).

### Etapa 9 — Deploy + teste

Apos tudo:
1. Atualizar `.env.local` com as novas keys
2. Atualizar env vars no Easypanel
3. Rebuild + deploy do app
4. Testar: login, listar conversas, enviar mensagem, receber webhook

---

## Checklist rapido

- [ ] Criar projeto no Supabase Cloud
- [ ] Preencher os dados acima e colar na conversa
- [ ] Eu rodo as migrations
- [ ] Eu migro os dados (se aplicavel)
- [ ] Eu atualizo as env vars
- [ ] Deploy + teste

---

**Cole os dados preenchidos na conversa e eu faco tudo.**
