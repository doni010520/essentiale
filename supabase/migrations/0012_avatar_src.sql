-- Impressão digital da foto-fonte (caminho da URL do WhatsApp, sem query de expiração).
-- Quando muda, sabemos que a pessoa trocou a foto e re-hospedamos a nova.
alter table contacts add column if not exists avatar_src text;
