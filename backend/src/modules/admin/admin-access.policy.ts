type AdminIdentity = {
  email: string;
  emailVerified: boolean;
};

export function configuredAdminEmails(value = process.env.ADMIN_EMAILS) {
  return new Set(
    (value ?? '').split(',').map(normalizeEmailAddress).filter(Boolean),
  );
}

export function isConfiguredAdminIdentity(
  user: AdminIdentity,
  allowedEmails = configuredAdminEmails(),
) {
  return (
    user.emailVerified && allowedEmails.has(normalizeEmailAddress(user.email))
  );
}

export function normalizeEmailAddress(value: string) {
  return value.trim().toLocaleLowerCase('en-US');
}
