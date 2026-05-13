import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, env } from 'prisma/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFilePath = path.resolve(__dirname, '.env');

process.env.DATABASE_URL ??= env('DATABASE_URL', {
  from: envFilePath,
});

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL', {
      from: envFilePath,
    }),
  },
});
