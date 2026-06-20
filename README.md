# MVF Chat — clone do Chatmix

SaaS multi-tenant de multiatendimento e automação via WhatsApp.
Stack: **Next.js 16 (App Router) + TypeScript + Tailwind v4 + Supabase**.
Integrações WhatsApp: **UAZAPI** (QR) e **Meta Cloud API** (oficial).

## Rodar em desenvolvimento

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

Sem `.env.local`, o app sobe em **modo preview** (dados de exemplo, sem login).

## Conectar o Supabase (dados reais + login)

1. Crie um projeto em https://supabase.com.
2. Copie `.env.local.example` para `.env.local` e preencha:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `UAZAPI_HOST`, `UAZAPI_ADMIN_TOKEN` (canal não oficial)
   - `META_VERIFY_TOKEN` (webhook da Meta — depois)
3. Aplique as migrations do diretório `supabase/migrations/` no banco
   (SQL Editor do Supabase, na ordem 0001 → 0002 → 0003).
4. Reinicie o `npm run dev`. Acesse `/cadastro` → crie conta → crie a organização.

## Webhooks (precisam de URL pública do seu VPS)

- UAZAPI: `POST  https://SEU-DOMINIO/api/webhooks/uazapi`
- Meta:   `GET/POST https://SEU-DOMINIO/api/webhooks/meta`

## Estrutura

```
src/app/(app)/*      telas autenticadas (dashboard, canais, atendimento, ...)
src/app/login        login / cadastro / onboarding
src/app/api/webhooks rotas de webhook (uazapi, meta)
src/lib/supabase     clientes (browser/server) + proxy de sessão
src/lib/whatsapp     adapters ChannelProvider (uazapi.ts, meta.ts) + inbound
supabase/migrations  schema + RLS + realtime
```

Plano de arquitetura completo: `../PLANO.md`.
