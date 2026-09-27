export function validateProductionConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== 'production') return;
  const deployment = env.DEPLOYMENT_ENV || 'production';
  if (!['production', 'staging'].includes(deployment)) {
    throw new Error('DEPLOYMENT_ENV must be production or staging.');
  }
  for (const key of ['CATALOG_CONNECTOR_MODE', 'QUESTION_CONNECTOR_MODE']) {
    if (env[key] !== 'live')
      throw new Error(`${key} must explicitly be live in production builds.`);
  }
  if (env.BILLING_TEST_LIMITS_ENABLED?.toLowerCase() === 'true') {
    throw new Error(
      'BILLING_TEST_LIMITS_ENABLED is forbidden in production builds.',
    );
  }
  if (deployment === 'production' && env.PADDLE_ENV !== 'production') {
    throw new Error('PADDLE_ENV must be production for customer deployments.');
  }
  if (!['sandbox', 'production'].includes(env.PADDLE_ENV || '')) {
    throw new Error('PADDLE_ENV must explicitly be sandbox or production.');
  }
  for (const key of [
    'DATABASE_URL',
    'REDIS_URL',
    'BETTER_AUTH_SECRET',
    'INTEGRATION_CREDENTIALS_KEY',
  ]) {
    if (!env[key]?.trim()) throw new Error(`${key} is required.`);
  }
  if ((env.BETTER_AUTH_SECRET?.length || 0) < 32) {
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters.');
  }
  // Staging can exercise bootstrap with fake credentials and an empty DB.
  if (deployment === 'production') {
    for (const key of [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GEMINI_API_KEY',
      'RESEND_API_KEY',
      'RESEND_WEBHOOK_SECRET',
      'NOTIFICATION_EMAIL_FROM',
      'PADDLE_API_KEY',
      'PADDLE_WEBHOOK_SECRET',
      ...['STARTER', 'GROWTH', 'BUSINESS'].flatMap((plan) =>
        ['MONTHLY', 'ANNUAL'].map((cycle) => `PADDLE_PRICE_${plan}_${cycle}`),
      ),
    ]) {
      if (!env[key]?.trim())
        throw new Error(`${key} is required for customer deployments.`);
    }
  }
}
