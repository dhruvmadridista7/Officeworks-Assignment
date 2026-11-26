import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
    .default('info'),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  FAKESTORE_BASE_URL: z.string().url().default('https://fakestoreapi.com'),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(1).default(5000),
  UPSTREAM_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  CACHE_TTL_SECONDS: z.coerce.number().int().min(1).default(300),
  FEATURED_PRODUCT_IDS: z.string().optional(),
});

export type AppConfig = Readonly<{
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';
  webOrigin: string;
  fakeStoreBaseUrl: string;
  upstreamTimeoutMs: number;
  upstreamRetries: number;
  cacheTtlSeconds: number;
  featuredProductIds?: string;
}>;

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = environmentSchema.safeParse(environment);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');

    throw new ConfigValidationError(`Invalid environment configuration: ${issues}`);
  }

  return {
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    logLevel: result.data.LOG_LEVEL,
    webOrigin: result.data.WEB_ORIGIN,
    fakeStoreBaseUrl: result.data.FAKESTORE_BASE_URL,
    upstreamTimeoutMs: result.data.UPSTREAM_TIMEOUT_MS,
    upstreamRetries: result.data.UPSTREAM_RETRIES,
    cacheTtlSeconds: result.data.CACHE_TTL_SECONDS,
    featuredProductIds: result.data.FEATURED_PRODUCT_IDS,
  };
}
