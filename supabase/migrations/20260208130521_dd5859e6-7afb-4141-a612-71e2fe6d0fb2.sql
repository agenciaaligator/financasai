-- Desconectar temporariamente Google Calendar (marcar como inativo)
UPDATE calendar_connections 
SET is_active = false, updated_at = now()
WHERE id = 'c83e5a3a-2390-441d-8991-e86861d6d0a1';