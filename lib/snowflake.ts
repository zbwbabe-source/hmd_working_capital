import snowflake from 'snowflake-sdk';

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function createConnection() {
  return snowflake.createConnection({
    account: getRequiredEnv('SNOWFLAKE_ACCOUNT'),
    username: getRequiredEnv('SNOWFLAKE_USERNAME'),
    password: getRequiredEnv('SNOWFLAKE_PASSWORD'),
    warehouse: getRequiredEnv('SNOWFLAKE_WAREHOUSE'),
    database: getRequiredEnv('SNOWFLAKE_DATABASE'),
    schema: getRequiredEnv('SNOWFLAKE_SCHEMA'),
  });
}

export async function executeSnowflakeQuery<T = Record<string, unknown>>(sqlText: string): Promise<T[]> {
  const connection = createConnection();

  await new Promise<void>((resolve, reject) => {
    connection.connect((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  try {
    return await new Promise<T[]>((resolve, reject) => {
      connection.execute({
        sqlText,
        complete: (err, _stmt, rows) => {
          if (err) reject(err);
          else resolve((rows ?? []) as T[]);
        },
      });
    });
  } finally {
    await new Promise<void>((resolve) => {
      connection.destroy(() => resolve());
    });
  }
}
