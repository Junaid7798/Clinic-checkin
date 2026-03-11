import { z } from 'zod';

// ==============================================
// Server-only environment variables schema
// ==============================================
const serverEnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Vonage
  VONAGE_API_KEY: z.string().min(1, 'VONAGE_API_KEY is required'),
  VONAGE_API_SECRET: z.string().min(1, 'VONAGE_API_SECRET is required'),
  VONAGE_FROM_NUMBER: z.string().min(1, 'VONAGE_FROM_NUMBER is required'),

  // Square
  SQUARE_ACCESS_TOKEN: z.string().min(1, 'SQUARE_ACCESS_TOKEN is required'),
  SQUARE_APPLICATION_ID: z.string().min(1, 'SQUARE_APPLICATION_ID is required'),
  SQUARE_LOCATION_ID: z.string().min(1, 'SQUARE_LOCATION_ID is required'),
  SQUARE_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),

  // Google
  GOOGLE_CLIENT_EMAIL: z.string().email(),
  GOOGLE_PRIVATE_KEY: z.string().min(1, 'GOOGLE_PRIVATE_KEY is required'),
  GOOGLE_CALENDAR_ID: z.string().min(1, 'GOOGLE_CALENDAR_ID is required'),
  GOOGLE_SHEET_ID: z.string().min(1, 'GOOGLE_SHEET_ID is required'),

  // Email
  SENDGRID_API_KEY: z.string().optional(),

  // Clinic Config
  CLINIC_NAME: z.string().default('Clinic'),
  CLINIC_EMAIL: z.string().email().default('clinic@example.com'),
  CLINIC_PHONE: z.string().default('+15551234567'),
  CLINIC_ADDRESS: z.string().default('123 Vision Street, Your City, ST 12345'),
  CLINIC_OPEN_HOUR: z.coerce.number().min(0).max(23).default(9),
  CLINIC_CLOSE_HOUR: z.coerce.number().min(0).max(23).default(17),
  APPOINTMENT_DURATION_MINUTES: z.coerce.number().min(10).max(120).default(30),
  COPAY_AMOUNT_CENTS: z.coerce.number().min(0).default(5000),

  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// ==============================================
// Client-side (NEXT_PUBLIC_) environment variables schema
// ==============================================
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_SQUARE_APPLICATION_ID: z.string().min(1, 'NEXT_PUBLIC_SQUARE_APPLICATION_ID is required'),
  NEXT_PUBLIC_SQUARE_LOCATION_ID: z.string().min(1, 'NEXT_PUBLIC_SQUARE_LOCATION_ID is required'),
});

// ==============================================
// Lazy accessors — avoid hard failing at import time
// ==============================================

let cachedServerConfig: z.infer<typeof serverEnvSchema> | null = null;
let cachedClientConfig: z.infer<typeof clientEnvSchema> | null = null;

export function getServerConfig() {
  if (cachedServerConfig) return cachedServerConfig;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const errorMessages = Object.entries(errors)
      .map(([key, messages]) => `  ❌ ${key}: ${messages?.join(', ')}`)
      .join('\n');
    throw new Error(
      `\n🚨 Missing or invalid server environment variables:\n${errorMessages}\n\n` +
      `Copy .env.local.example to .env.local and fill in all required values.\n`
    );
  }

  cachedServerConfig = parsed.data;
  return cachedServerConfig;
}

export function getClientConfig() {
  if (cachedClientConfig) return cachedClientConfig;

  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SQUARE_APPLICATION_ID: process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID,
    NEXT_PUBLIC_SQUARE_LOCATION_ID: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID,
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const errorMessages = Object.entries(errors)
      .map(([key, messages]) => `  ❌ ${key}: ${messages?.join(', ')}`)
      .join('\n');
    throw new Error(
      `\n🚨 Missing or invalid client environment variables:\n${errorMessages}\n`
    );
  }

  cachedClientConfig = parsed.data;
  return cachedClientConfig;
}

// Convenience helpers
export const config = () => ({
  ...getServerConfig(),
  ...getClientConfig(),
});

export type ServerConfig = z.infer<typeof serverEnvSchema>;
export type ClientConfig = z.infer<typeof clientEnvSchema>;
