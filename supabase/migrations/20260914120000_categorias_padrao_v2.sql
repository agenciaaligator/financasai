-- Categorias padrão v2
-- 1) Novas contas recebem 14 categorias de despesa e 5 de receita.
-- 2) Contas existentes recebem as categorias que faltarem e têm o histórico
--    reclassificado pelo mesmo dicionário usado pelo agente do WhatsApp.
-- Tudo roda numa única transação: se qualquer passo falhar, nada é alterado.
-- Rode antes o arquivo de prévia para conferir o que muda.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.dw_norm(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(translate(coalesce(t, ''),
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
    'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'))
$$;

-- 1) Categorias padrão para novas contas
CREATE OR REPLACE FUNCTION public.create_default_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.categories (user_id, name, type, color) VALUES
    (NEW.user_id, 'Mercado', 'expense', '#22C55E'),
    (NEW.user_id, 'Restaurantes e delivery', 'expense', '#EF4444'),
    (NEW.user_id, 'Moradia', 'expense', '#8B5CF6'),
    (NEW.user_id, 'Contas da casa', 'expense', '#EAB308'),
    (NEW.user_id, 'Transporte', 'expense', '#F59E0B'),
    (NEW.user_id, 'Combustível', 'expense', '#FB923C'),
    (NEW.user_id, 'Saúde', 'expense', '#10B981'),
    (NEW.user_id, 'Educação', 'expense', '#3B82F6'),
    (NEW.user_id, 'Lazer', 'expense', '#EC4899'),
    (NEW.user_id, 'Assinaturas', 'expense', '#6366F1'),
    (NEW.user_id, 'Compras', 'expense', '#F97316'),
    (NEW.user_id, 'Cuidados pessoais', 'expense', '#D946EF'),
    (NEW.user_id, 'Pets', 'expense', '#A16207'),
    (NEW.user_id, 'Outros', 'expense', '#6B7280'),
    (NEW.user_id, 'Salário', 'income', '#059669'),
    (NEW.user_id, 'Serviços e freelance', 'income', '#0D9488'),
    (NEW.user_id, 'Vendas', 'income', '#0891B2'),
    (NEW.user_id, 'Investimentos', 'income', '#2563EB'),
    (NEW.user_id, 'Outros', 'income', '#16A34A');
  RETURN NEW;
END;
$$;

CREATE TEMP TABLE dw_target (name text, type text, color text) ON COMMIT DROP;
INSERT INTO dw_target VALUES
  ('Mercado', 'expense', '#22C55E'),
  ('Restaurantes e delivery', 'expense', '#EF4444'),
  ('Moradia', 'expense', '#8B5CF6'),
  ('Contas da casa', 'expense', '#EAB308'),
  ('Transporte', 'expense', '#F59E0B'),
  ('Combustível', 'expense', '#FB923C'),
  ('Saúde', 'expense', '#10B981'),
  ('Educação', 'expense', '#3B82F6'),
  ('Lazer', 'expense', '#EC4899'),
  ('Assinaturas', 'expense', '#6366F1'),
  ('Compras', 'expense', '#F97316'),
  ('Cuidados pessoais', 'expense', '#D946EF'),
  ('Pets', 'expense', '#A16207'),
  ('Outros', 'expense', '#6B7280'),
  ('Salário', 'income', '#059669'),
  ('Serviços e freelance', 'income', '#0D9488'),
  ('Vendas', 'income', '#0891B2'),
  ('Investimentos', 'income', '#2563EB'),
  ('Outros', 'income', '#16A34A');

CREATE TEMP TABLE dw_keywords (keyword text, type text, target_name text) ON COMMIT DROP;
INSERT INTO dw_keywords VALUES
  ('mercado', 'expense', 'Mercado'),
  ('supermercado', 'expense', 'Mercado'),
  ('padaria', 'expense', 'Mercado'),
  ('feira', 'expense', 'Mercado'),
  ('acougue', 'expense', 'Mercado'),
  ('hortifruti', 'expense', 'Mercado'),
  ('sacolao', 'expense', 'Mercado'),
  ('quitanda', 'expense', 'Mercado'),
  ('atacadao', 'expense', 'Mercado'),
  ('assai', 'expense', 'Mercado'),
  ('carrefour', 'expense', 'Mercado'),
  ('pao de acucar', 'expense', 'Mercado'),
  ('ifood', 'expense', 'Restaurantes e delivery'),
  ('rappi', 'expense', 'Restaurantes e delivery'),
  ('delivery', 'expense', 'Restaurantes e delivery'),
  ('restaurante', 'expense', 'Restaurantes e delivery'),
  ('lanche', 'expense', 'Restaurantes e delivery'),
  ('lanchonete', 'expense', 'Restaurantes e delivery'),
  ('pizza', 'expense', 'Restaurantes e delivery'),
  ('pizzaria', 'expense', 'Restaurantes e delivery'),
  ('hamburguer', 'expense', 'Restaurantes e delivery'),
  ('burger', 'expense', 'Restaurantes e delivery'),
  ('almoco', 'expense', 'Restaurantes e delivery'),
  ('jantar', 'expense', 'Restaurantes e delivery'),
  ('cafe', 'expense', 'Restaurantes e delivery'),
  ('cafeteria', 'expense', 'Restaurantes e delivery'),
  ('bar', 'expense', 'Restaurantes e delivery'),
  ('boteco', 'expense', 'Restaurantes e delivery'),
  ('doceria', 'expense', 'Restaurantes e delivery'),
  ('sorvete', 'expense', 'Restaurantes e delivery'),
  ('sorveteria', 'expense', 'Restaurantes e delivery'),
  ('acai', 'expense', 'Restaurantes e delivery'),
  ('sushi', 'expense', 'Restaurantes e delivery'),
  ('churrasco', 'expense', 'Restaurantes e delivery'),
  ('marmita', 'expense', 'Restaurantes e delivery'),
  ('pastel', 'expense', 'Restaurantes e delivery'),
  ('salgado', 'expense', 'Restaurantes e delivery'),
  ('esfiha', 'expense', 'Restaurantes e delivery'),
  ('comida', 'expense', 'Restaurantes e delivery'),
  ('mcdonalds', 'expense', 'Restaurantes e delivery'),
  ('subway', 'expense', 'Restaurantes e delivery'),
  ('starbucks', 'expense', 'Restaurantes e delivery'),
  ('uber', 'expense', 'Transporte'),
  ('99', 'expense', 'Transporte'),
  ('taxi', 'expense', 'Transporte'),
  ('cabify', 'expense', 'Transporte'),
  ('indriver', 'expense', 'Transporte'),
  ('estacionamento', 'expense', 'Transporte'),
  ('pedagio', 'expense', 'Transporte'),
  ('onibus', 'expense', 'Transporte'),
  ('metro', 'expense', 'Transporte'),
  ('trem', 'expense', 'Transporte'),
  ('brt', 'expense', 'Transporte'),
  ('passagem', 'expense', 'Transporte'),
  ('bilhete unico', 'expense', 'Transporte'),
  ('mecanico', 'expense', 'Transporte'),
  ('oficina', 'expense', 'Transporte'),
  ('pneu', 'expense', 'Transporte'),
  ('ipva', 'expense', 'Transporte'),
  ('licenciamento', 'expense', 'Transporte'),
  ('lava rapido', 'expense', 'Transporte'),
  ('patinete', 'expense', 'Transporte'),
  ('combustivel', 'expense', 'Combustível'),
  ('gasolina', 'expense', 'Combustível'),
  ('etanol', 'expense', 'Combustível'),
  ('alcool', 'expense', 'Combustível'),
  ('diesel', 'expense', 'Combustível'),
  ('posto', 'expense', 'Combustível'),
  ('abastecimento', 'expense', 'Combustível'),
  ('aluguel', 'expense', 'Moradia'),
  ('condominio', 'expense', 'Moradia'),
  ('iptu', 'expense', 'Moradia'),
  ('faxina', 'expense', 'Moradia'),
  ('diarista', 'expense', 'Moradia'),
  ('reforma', 'expense', 'Moradia'),
  ('material de construcao', 'expense', 'Moradia'),
  ('manutencao', 'expense', 'Moradia'),
  ('luz', 'expense', 'Contas da casa'),
  ('energia', 'expense', 'Contas da casa'),
  ('enel', 'expense', 'Contas da casa'),
  ('cemig', 'expense', 'Contas da casa'),
  ('copel', 'expense', 'Contas da casa'),
  ('sabesp', 'expense', 'Contas da casa'),
  ('conta de agua', 'expense', 'Contas da casa'),
  ('gas', 'expense', 'Contas da casa'),
  ('internet', 'expense', 'Contas da casa'),
  ('wifi', 'expense', 'Contas da casa'),
  ('vivo', 'expense', 'Contas da casa'),
  ('claro', 'expense', 'Contas da casa'),
  ('tim', 'expense', 'Contas da casa'),
  ('telefone', 'expense', 'Contas da casa'),
  ('conta de celular', 'expense', 'Contas da casa'),
  ('plano de celular', 'expense', 'Contas da casa'),
  ('farmacia', 'expense', 'Saúde'),
  ('drogaria', 'expense', 'Saúde'),
  ('drogasil', 'expense', 'Saúde'),
  ('droga raia', 'expense', 'Saúde'),
  ('remedio', 'expense', 'Saúde'),
  ('medicamento', 'expense', 'Saúde'),
  ('medico', 'expense', 'Saúde'),
  ('consulta', 'expense', 'Saúde'),
  ('dentista', 'expense', 'Saúde'),
  ('exame', 'expense', 'Saúde'),
  ('laboratorio', 'expense', 'Saúde'),
  ('hospital', 'expense', 'Saúde'),
  ('clinica', 'expense', 'Saúde'),
  ('plano de saude', 'expense', 'Saúde'),
  ('unimed', 'expense', 'Saúde'),
  ('amil', 'expense', 'Saúde'),
  ('psicologo', 'expense', 'Saúde'),
  ('terapia', 'expense', 'Saúde'),
  ('fisioterapia', 'expense', 'Saúde'),
  ('vacina', 'expense', 'Saúde'),
  ('oculos', 'expense', 'Saúde'),
  ('lente', 'expense', 'Saúde'),
  ('nutricionista', 'expense', 'Saúde'),
  ('curso', 'expense', 'Educação'),
  ('faculdade', 'expense', 'Educação'),
  ('universidade', 'expense', 'Educação'),
  ('escola', 'expense', 'Educação'),
  ('colegio', 'expense', 'Educação'),
  ('mensalidade', 'expense', 'Educação'),
  ('livro', 'expense', 'Educação'),
  ('apostila', 'expense', 'Educação'),
  ('material escolar', 'expense', 'Educação'),
  ('udemy', 'expense', 'Educação'),
  ('alura', 'expense', 'Educação'),
  ('ingles', 'expense', 'Educação'),
  ('idioma', 'expense', 'Educação'),
  ('matricula', 'expense', 'Educação'),
  ('cinema', 'expense', 'Lazer'),
  ('show', 'expense', 'Lazer'),
  ('teatro', 'expense', 'Lazer'),
  ('festa', 'expense', 'Lazer'),
  ('balada', 'expense', 'Lazer'),
  ('viagem', 'expense', 'Lazer'),
  ('hotel', 'expense', 'Lazer'),
  ('airbnb', 'expense', 'Lazer'),
  ('passeio', 'expense', 'Lazer'),
  ('parque', 'expense', 'Lazer'),
  ('jogo', 'expense', 'Lazer'),
  ('game', 'expense', 'Lazer'),
  ('steam', 'expense', 'Lazer'),
  ('playstation', 'expense', 'Lazer'),
  ('xbox', 'expense', 'Lazer'),
  ('ingresso', 'expense', 'Lazer'),
  ('museu', 'expense', 'Lazer'),
  ('netflix', 'expense', 'Assinaturas'),
  ('spotify', 'expense', 'Assinaturas'),
  ('disney', 'expense', 'Assinaturas'),
  ('hbo', 'expense', 'Assinaturas'),
  ('prime video', 'expense', 'Assinaturas'),
  ('deezer', 'expense', 'Assinaturas'),
  ('globoplay', 'expense', 'Assinaturas'),
  ('youtube premium', 'expense', 'Assinaturas'),
  ('streaming', 'expense', 'Assinaturas'),
  ('assinatura', 'expense', 'Assinaturas'),
  ('icloud', 'expense', 'Assinaturas'),
  ('google one', 'expense', 'Assinaturas'),
  ('chatgpt', 'expense', 'Assinaturas'),
  ('roupa', 'expense', 'Compras'),
  ('camisa', 'expense', 'Compras'),
  ('camiseta', 'expense', 'Compras'),
  ('calca', 'expense', 'Compras'),
  ('sapato', 'expense', 'Compras'),
  ('tenis', 'expense', 'Compras'),
  ('sandalia', 'expense', 'Compras'),
  ('vestido', 'expense', 'Compras'),
  ('blusa', 'expense', 'Compras'),
  ('jaqueta', 'expense', 'Compras'),
  ('casaco', 'expense', 'Compras'),
  ('bolsa', 'expense', 'Compras'),
  ('mochila', 'expense', 'Compras'),
  ('renner', 'expense', 'Compras'),
  ('riachuelo', 'expense', 'Compras'),
  ('zara', 'expense', 'Compras'),
  ('shein', 'expense', 'Compras'),
  ('mercado livre', 'expense', 'Compras'),
  ('amazon', 'expense', 'Compras'),
  ('shopee', 'expense', 'Compras'),
  ('magalu', 'expense', 'Compras'),
  ('americanas', 'expense', 'Compras'),
  ('casas bahia', 'expense', 'Compras'),
  ('eletronico', 'expense', 'Compras'),
  ('eletrodomestico', 'expense', 'Compras'),
  ('moveis', 'expense', 'Compras'),
  ('presente', 'expense', 'Compras'),
  ('salao', 'expense', 'Cuidados pessoais'),
  ('cabeleireiro', 'expense', 'Cuidados pessoais'),
  ('barbearia', 'expense', 'Cuidados pessoais'),
  ('barbeiro', 'expense', 'Cuidados pessoais'),
  ('manicure', 'expense', 'Cuidados pessoais'),
  ('pedicure', 'expense', 'Cuidados pessoais'),
  ('estetica', 'expense', 'Cuidados pessoais'),
  ('cosmetico', 'expense', 'Cuidados pessoais'),
  ('maquiagem', 'expense', 'Cuidados pessoais'),
  ('perfume', 'expense', 'Cuidados pessoais'),
  ('depilacao', 'expense', 'Cuidados pessoais'),
  ('academia', 'expense', 'Cuidados pessoais'),
  ('smartfit', 'expense', 'Cuidados pessoais'),
  ('racao', 'expense', 'Pets'),
  ('pet shop', 'expense', 'Pets'),
  ('petshop', 'expense', 'Pets'),
  ('veterinario', 'expense', 'Pets'),
  ('banho e tosa', 'expense', 'Pets'),
  ('petz', 'expense', 'Pets'),
  ('cobasi', 'expense', 'Pets'),
  ('salario', 'income', 'Salário'),
  ('holerite', 'income', 'Salário'),
  ('decimo terceiro', 'income', 'Salário'),
  ('ferias', 'income', 'Salário'),
  ('adiantamento', 'income', 'Salário'),
  ('pro labore', 'income', 'Salário'),
  ('freela', 'income', 'Serviços e freelance'),
  ('freelance', 'income', 'Serviços e freelance'),
  ('freelancer', 'income', 'Serviços e freelance'),
  ('consultoria', 'income', 'Serviços e freelance'),
  ('projeto', 'income', 'Serviços e freelance'),
  ('bico', 'income', 'Serviços e freelance'),
  ('comissao', 'income', 'Serviços e freelance'),
  ('servico', 'income', 'Serviços e freelance'),
  ('cliente', 'income', 'Serviços e freelance'),
  ('honorario', 'income', 'Serviços e freelance'),
  ('job', 'income', 'Serviços e freelance'),
  ('venda', 'income', 'Vendas'),
  ('revenda', 'income', 'Vendas'),
  ('produto', 'income', 'Vendas'),
  ('dividendo', 'income', 'Investimentos'),
  ('rendimento', 'income', 'Investimentos'),
  ('juros', 'income', 'Investimentos'),
  ('cdb', 'income', 'Investimentos'),
  ('tesouro', 'income', 'Investimentos'),
  ('acoes', 'income', 'Investimentos'),
  ('fii', 'income', 'Investimentos'),
  ('cripto', 'income', 'Investimentos'),
  ('bitcoin', 'income', 'Investimentos'),
  ('resgate', 'income', 'Investimentos'),
  ('aplicacao', 'income', 'Investimentos'),
  ('poupanca', 'income', 'Investimentos');

CREATE TEMP TABLE dw_legacy (old_name text, type text, default_target text) ON COMMIT DROP;
INSERT INTO dw_legacy VALUES
  ('Alimentação', 'expense', 'Mercado'),
  ('Transporte', 'expense', 'Transporte'),
  ('Combustível', 'expense', 'Combustível'),
  ('Moradia', 'expense', 'Moradia'),
  ('Saúde', 'expense', 'Saúde'),
  ('Entretenimento', 'expense', 'Lazer'),
  ('Lazer', 'expense', 'Lazer'),
  ('Lazer e Entretenimento', 'expense', 'Lazer'),
  ('Educação', 'expense', 'Educação'),
  ('Vestuário', 'expense', 'Compras'),
  ('Outros', 'expense', 'Outros'),
  ('Salário', 'income', 'Salário'),
  ('Freelance', 'income', 'Serviços e freelance'),
  ('Projetos', 'income', 'Serviços e freelance'),
  ('Investimentos', 'income', 'Investimentos'),
  ('Outros', 'income', 'Outros');

CREATE TEMP TABLE dw_retired (name text, type text) ON COMMIT DROP;
INSERT INTO dw_retired VALUES
  ('Alimentação', 'expense'),
  ('Entretenimento', 'expense'),
  ('Lazer e Entretenimento', 'expense'),
  ('Vestuário', 'expense'),
  ('Freelance', 'income'),
  ('Projetos', 'income');

-- 2) Cria nas contas existentes as categorias padrão que ainda não existem
INSERT INTO public.categories (user_id, organization_id, name, type, color)
SELECT p.user_id, org.organization_id, t.name, t.type, t.color
FROM public.profiles p
LEFT JOIN LATERAL (
  SELECT c.organization_id FROM public.categories c
  WHERE c.user_id = p.user_id AND c.organization_id IS NOT NULL
  LIMIT 1
) org ON true
CROSS JOIN dw_target t
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c
  WHERE c.user_id = p.user_id AND c.type = t.type
    AND pg_temp.dw_norm(c.name) = pg_temp.dw_norm(t.name)
);

-- Uma categoria por (usuário, tipo, nome). Se houver duplicada, usa a mais antiga.
CREATE TEMP TABLE dw_catid ON COMMIT DROP AS
SELECT DISTINCT ON (user_id, type, pg_temp.dw_norm(name))
  user_id, type, pg_temp.dw_norm(name) AS norm_name, id
FROM public.categories
ORDER BY user_id, type, pg_temp.dw_norm(name), created_at;

-- 3) Reclassifica lançamentos
CREATE TEMP TABLE dw_tx_moves ON COMMIT DROP AS
  SELECT x.id AS row_id, x.user_id, x.type, oc.name AS old_name, x.title,
         COALESCE(kw.target_name, lg.default_target, 'Outros') AS new_name
  FROM public.transactions x
  LEFT JOIN public.categories oc ON oc.id = x.category_id
  LEFT JOIN dw_legacy lg ON lg.type = x.type AND pg_temp.dw_norm(lg.old_name) = pg_temp.dw_norm(oc.name)
  LEFT JOIN LATERAL (
    SELECT k.target_name FROM dw_keywords k
    WHERE k.type = x.type AND pg_temp.dw_norm(x.title) ~ ('\m' || k.keyword || 's?\M')
    ORDER BY length(k.keyword) DESC
    LIMIT 1
  ) kw ON true
  WHERE x.category_id IS NULL OR lg.old_name IS NOT NULL;

UPDATE public.transactions x
SET category_id = ci.id
FROM dw_tx_moves m
JOIN dw_catid ci ON ci.user_id = m.user_id AND ci.type = m.type AND ci.norm_name = pg_temp.dw_norm(m.new_name)
WHERE x.id = m.row_id AND x.category_id IS DISTINCT FROM ci.id;

-- 4) Reclassifica contas fixas
CREATE TEMP TABLE dw_rec_moves ON COMMIT DROP AS
  SELECT x.id AS row_id, x.user_id, x.type, oc.name AS old_name, x.title,
         COALESCE(kw.target_name, lg.default_target, 'Outros') AS new_name
  FROM public.recurring_transactions x
  LEFT JOIN public.categories oc ON oc.id = x.category_id
  LEFT JOIN dw_legacy lg ON lg.type = x.type AND pg_temp.dw_norm(lg.old_name) = pg_temp.dw_norm(oc.name)
  LEFT JOIN LATERAL (
    SELECT k.target_name FROM dw_keywords k
    WHERE k.type = x.type AND pg_temp.dw_norm(x.title) ~ ('\m' || k.keyword || 's?\M')
    ORDER BY length(k.keyword) DESC
    LIMIT 1
  ) kw ON true
  WHERE x.category_id IS NULL OR lg.old_name IS NOT NULL;

UPDATE public.recurring_transactions x
SET category_id = ci.id
FROM dw_rec_moves m
JOIN dw_catid ci ON ci.user_id = m.user_id AND ci.type = m.type AND ci.norm_name = pg_temp.dw_norm(m.new_name)
WHERE x.id = m.row_id AND x.category_id IS DISTINCT FROM ci.id;

-- 5) Metas mensais de categorias aposentadas vão para a categoria destino.
--    Se o destino já tiver meta, os valores são somados.
CREATE TEMP TABLE dw_goal_moves ON COMMIT DROP AS
SELECT g.id AS goal_id, g.user_id, g.amount, ci.id AS new_category_id
FROM public.monthly_goals g
JOIN public.categories oc ON oc.id = g.category_id
JOIN dw_retired r ON r.type = oc.type AND pg_temp.dw_norm(r.name) = pg_temp.dw_norm(oc.name)
JOIN dw_legacy lg ON lg.type = oc.type AND pg_temp.dw_norm(lg.old_name) = pg_temp.dw_norm(oc.name)
JOIN dw_catid ci ON ci.user_id = g.user_id AND ci.type = oc.type AND ci.norm_name = pg_temp.dw_norm(lg.default_target);

UPDATE public.monthly_goals tg
SET amount = tg.amount + s.total, updated_at = now()
FROM (SELECT user_id, new_category_id, sum(amount) AS total FROM dw_goal_moves GROUP BY user_id, new_category_id) s
WHERE tg.user_id = s.user_id AND tg.category_id = s.new_category_id
  AND tg.id NOT IN (SELECT goal_id FROM dw_goal_moves);

DELETE FROM public.monthly_goals g
USING dw_goal_moves m
WHERE g.id = m.goal_id
  AND EXISTS (SELECT 1 FROM public.monthly_goals tg WHERE tg.user_id = m.user_id AND tg.category_id = m.new_category_id AND tg.id <> m.goal_id);

UPDATE public.monthly_goals g
SET category_id = m.new_category_id, updated_at = now()
FROM dw_goal_moves m
WHERE g.id = m.goal_id;

-- 6) Apaga categorias aposentadas que ficaram sem uso.
--    Nunca apaga categoria ainda referenciada: isso zeraria a categoria do lançamento.
DELETE FROM public.categories c
USING dw_retired r
WHERE r.type = c.type AND pg_temp.dw_norm(r.name) = pg_temp.dw_norm(c.name)
  AND NOT EXISTS (SELECT 1 FROM public.transactions x WHERE x.category_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.recurring_transactions x WHERE x.category_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.monthly_goals x WHERE x.category_id = c.id);

COMMIT;
