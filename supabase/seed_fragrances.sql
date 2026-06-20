INSERT INTO fragrances (organization_id,nome,perfil,indicar_para,notas,confirmada) VALUES
('aaaaaaaa-0000-0000-0000-000000000001','Felicità','','','{}'::jsonb,true),
('aaaaaaaa-0000-0000-0000-000000000001','Poésie','','','{}'::jsonb,true),
('aaaaaaaa-0000-0000-0000-000000000001','Avelinè','','','{}'::jsonb,true),
('aaaaaaaa-0000-0000-0000-000000000001','Delicata','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Explosie','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Iluminatè','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Luxus','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Uniquè','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Vivace','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Serène','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Vollutà','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Vivaqua','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Speziata','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Solarie','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Voluttà','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Mièlle','','','{}',false),
('aaaaaaaa-0000-0000-0000-000000000001','Dolcè','','','{}',false)
ON CONFLICT (organization_id,nome) DO UPDATE SET
  perfil=EXCLUDED.perfil, indicar_para=EXCLUDED.indicar_para,
  notas=EXCLUDED.notas, confirmada=EXCLUDED.confirmada;