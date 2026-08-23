import { z } from 'zod'

export const emailSchema = z.string().email('Invalid email address')

export const collegeEmailSchema = z
  .string()
  .email('Invalid email address')
  .refine((email) => email.endsWith('@citchennai.net'), {
    message: 'Only @citchennai.net email addresses are allowed',
  })

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')

export const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name must be at most 50 characters')

export const phoneSchema = z
  .string()
  .regex(/^[+]?[0-9]{10,15}$/, 'Invalid phone number')

export const competitionSearchSchema = z.object({
  query: z.string().min(2).max(100),
})

export const loginSchema = z.object({
  email: collegeEmailSchema,
  password: passwordSchema,
})

export const registrationSchema = z.object({
  competitionId: z.string().uuid(),
  verificationMethod: z.enum(['screenshot', 'email']),
  confirmationScreenshot: z.string().optional(),
  confirmationEmail: z.string().email().optional(),
})

export type LoginFormData = z.infer<typeof loginSchema>
export type RegistrationFormData = z.infer<typeof registrationSchema>
