-- ─────────────────────────────────────────────────────────────────────────────
-- Seed Essentiale — organização + agente Caroline.
-- Rodar DEPOIS das migrations (0001..0021). Idempotente.
-- Os produtos e fragrâncias estão em seed_products.sql e seed_fragrances.sql.
-- ─────────────────────────────────────────────────────────────────────────────

-- Organização Essentiale (single-tenant nesta instalação).
insert into organizations (id, name, document)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Essentiale Fragrance', null)
on conflict (id) do nothing;

-- Agente Caroline (OpenAI gpt-4.1-mini). Só cria se ainda não existir um para a org.
insert into ai_agents (organization_id, channel_id, name, prompt, model, config, active)
select
  'aaaaaaaa-0000-0000-0000-000000000001',
  null,
  'Caroline',
  '',
  'gpt-4.1-mini',
  '{
    "temperature": 0.4,
    "use_emojis": true,
    "single_message": false,
    "execute_actions": true,
    "restrict_to_allowlist": false,
    "tone": "Calorosa, consultiva e próxima — voz recifense da Essentiale",
    "greeting": "Olá! Tudo bem? Meu nome eh Caroline 🌷 Como posso ajudar você hoje?"
  }'::jsonb,
  true
where not exists (
  select 1 from ai_agents where organization_id = 'aaaaaaaa-0000-0000-0000-000000000001'
);
