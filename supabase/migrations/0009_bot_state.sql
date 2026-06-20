-- Estado do chatbot por conversa (qual automação e em que nó parou aguardando resposta).
alter table conversations add column if not exists bot_automation_id uuid references automations (id) on delete set null;
alter table conversations add column if not exists bot_node_id text;
