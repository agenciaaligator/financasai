-- Remover sessão WhatsApp órfã da MARINES (criada antes do bloqueio de assinatura)
-- Quando ela finalizar o pagamento, ela revalida normalmente via claim code.
DELETE FROM public.whatsapp_sessions
WHERE user_id = '772f5a68-72e2-467b-89d4-ea33396dc2f6';