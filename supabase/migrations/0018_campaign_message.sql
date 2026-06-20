-- Texto de disparo da campanha (usado quando não há fluxo, ou como override
-- da 1ª mensagem do fluxo de automação vinculado).
alter table campaigns
  add column if not exists message text;
