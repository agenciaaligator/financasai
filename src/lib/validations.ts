import { z } from 'zod';

// Validação de transações
export const transactionSchema = z.object({
  title: z.string()
    .trim()
    .min(1, "Título é obrigatório")
    .max(100, "Título deve ter no máximo 100 caracteres")
    .regex(/^[a-zA-Z0-9\sÀ-ÿ\-,.!?()]+$/, "Título contém caracteres inválidos"),
  amount: z.number()
    .positive("Valor deve ser positivo")
    .max(999999999, "Valor muito alto"),
  type: z.enum(['income', 'expense']),
  description: z.string()
    .max(500, "Descrição deve ter no máximo 500 caracteres")
    .optional()
    .transform(val => val?.trim()),
  date: z.string().min(1, "Data é obrigatória"),
  category_id: z.string().uuid().optional(),
});

// Validação de compromissos
export const commitmentSchema = z.object({
  title: z.string()
    .trim()
    .min(1, "Título é obrigatório")
    .max(100, "Título deve ter no máximo 100 caracteres"),
  description: z.string()
    .max(1000, "Descrição deve ter no máximo 1000 caracteres")
    .optional()
    .transform(val => val?.trim()),
  location: z.string()
    .max(200, "Local deve ter no máximo 200 caracteres")
    .optional()
    .transform(val => val?.trim()),
  notes: z.string()
    .max(2000, "Notas devem ter no máximo 2000 caracteres")
    .optional()
    .transform(val => val?.trim()),
  participants: z.string()
    .max(500, "Participantes deve ter no máximo 500 caracteres")
    .optional()
    .transform(val => val?.trim()),
  scheduled_at: z.string().min(1, "Data e hora são obrigatórias"),
  category: z.enum(['payment', 'meeting', 'appointment', 'other']),
  duration_minutes: z.number()
    .positive("Duração deve ser positiva")
    .max(1440, "Duração deve ser no máximo 24 horas")
    .optional(),
});

// Validação de categorias
export const categorySchema = z.object({
  name: z.string()
    .trim()
    .min(1, "Nome é obrigatório")
    .max(50, "Nome deve ter no máximo 50 caracteres")
    .regex(/^[a-zA-Z0-9\sÀ-ÿ\-&]+$/, "Nome contém caracteres inválidos"),
  type: z.enum(['income', 'expense']),
  color: z.string()
    .regex(/^#[0-9A-F]{6}$/i, "Cor deve ser um código hexadecimal válido"),
});

// Validação de perfil
export const profileSchema = z.object({
  full_name: z.string()
    .trim()
    .min(1, "Nome é obrigatório")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, "Nome deve conter apenas letras"),
  phone_number: z.string()
    .regex(/^\+?[0-9]{10,15}$/, "Telefone deve estar no formato internacional (ex: +5511999999999)")
    .optional()
    .or(z.literal('')),
});

// Validação de senha
export const passwordSchema = z.object({
  password: z.string()
    .min(6, "Senha deve ter no menos 6 caracteres")
    .max(100, "Senha deve ter no máximo 100 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});
