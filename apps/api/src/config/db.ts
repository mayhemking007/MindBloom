import pg from "pg";

import { createAppSchemaSql } from "../db/schema.js";
import { env } from "./env.js";

const { Pool } = pg;

export const dbPool = new Pool({
  connectionString: env.DATABASE_URL,
});

export async function query<Row extends pg.QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<pg.QueryResult<Row>> {
  return dbPool.query<Row>(text, values);
}

export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function initializeDb(): Promise<void> {
  await dbPool.query(createAppSchemaSql);
}

export async function closeDb(): Promise<void> {
  await dbPool.end();
}
