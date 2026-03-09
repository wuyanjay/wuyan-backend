import { z } from 'zod';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  API_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  
  DATABASE_URL: z.string().url().optional().default('postgresql://postgres:123456@localhost:5432/auth_db'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  
  // SMTP Configuration for email sending
  SMTP_HOST: z.string().optional().default('smtp.gmail.com'),
  SMTP_PORT: z.string().transform(Number).optional().default('587'),
  SMTP_USER: z.string().email().optional().default('your-email@gmail.com'),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().email().optional().default('noreply@example.com'),
  SMTP_FROM_NAME: z.string().optional().default('Auth System'),
  
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().email().optional(),
  SENDGRID_FROM_NAME: z.string().optional(),
  
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('900'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('5'),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Environment variable validation failed:');
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

export { env };
