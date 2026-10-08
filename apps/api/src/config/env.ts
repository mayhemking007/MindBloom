import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  MEMO_GRAFTER_EMBEDDING_MODEL: z.string().min(1).optional(),
  MEMO_GRAFTER_LLM_MODEL: z.string().min(1).optional(),
  NOTION_TOKEN: z.string().min(1).optional(),
  API_PORT: z.coerce.number().int().positive().default(4000),
  NOTION_API_PORT: z.coerce.number().int().positive().default(4100),
  PORT: z.coerce.number().int().positive().optional(),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  NOTION_CORS_ORIGIN: z.string().min(1).default("http://localhost:5174"),
});

export const env = envSchema.parse(process.env);

export const apiPort = env.PORT ?? env.API_PORT;
export const notionApiPort = env.PORT ?? env.NOTION_API_PORT;
