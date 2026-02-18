-- Allow authenticated users to read their own WhatsApp sessions
CREATE POLICY "Users can read their own sessions"
ON public.whatsapp_sessions
FOR SELECT
USING (auth.uid() = user_id);

-- Allow authenticated users to upsert their own WhatsApp sessions (used in Welcome.tsx)
CREATE POLICY "Users can insert their own sessions"
ON public.whatsapp_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own WhatsApp sessions
CREATE POLICY "Users can update their own sessions"
ON public.whatsapp_sessions
FOR UPDATE
USING (auth.uid() = user_id);