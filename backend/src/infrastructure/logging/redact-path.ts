/** Invitation URLs are bearer credentials, including on unmatched/aborted routes. */
export function redactInvitationPaths(value: string) {
  return value.replace(
    /((?:\/|%2f)(?:workspace-invitations|invite)(?:\/|%2f))[^?\s"'<>]*/gi,
    '$1[REDACTED]',
  );
}

export function safeRequestPath(path: string) {
  // Decode route spelling as well as tokens; never log query strings/fragments.
  let decoded = path.split(/[?#]/, 1)[0];
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    /* retain raw path */
  }
  return redactInvitationPaths(decoded.split(/[?#]/, 1)[0]);
}
