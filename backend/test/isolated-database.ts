import type { Pool } from 'pg';

// pg Pool.end() can settle before server-side sockets disappear. Never force
// terminate them while late driver callbacks still belong to the test runner.
export async function dropIsolatedDatabase(pool: Pool, name: string) {
  if (!/^core_assist_[a-z_]+_test_[a-f0-9]{12}$/.test(name)) {
    throw new Error('Refusing to drop a database outside the test namespace.');
  }
  const deadline = Date.now() + 5000;
  while (true) {
    const result = await pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = $1',
      [name],
    );
    if (result.rows[0].count === 0) break;
    if (Date.now() >= deadline)
      throw new Error(
        'Test database still has open connections after cleanup.',
      );
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  await pool.query(`DROP DATABASE "${name}"`);
}
