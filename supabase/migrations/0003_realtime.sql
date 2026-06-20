-- Habilita Realtime (broadcast de mudanças) para o chat ao vivo e o board Kanban.
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;
