-- Telefone do afiliado, para poder avisar via WhatsApp quando uma venda converter.
ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS phone_number TEXT;
