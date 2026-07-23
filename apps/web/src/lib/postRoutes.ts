/**
 * Staffed post screens (check-in, check-out, checkpoint, front desk) have their own urls, but they
 * do NOT have their own sign-in: there is exactly one login screen, at `/`. A post reached without
 * a session bounces there carrying `?next=`, and the app returns the user to the post once they're
 * in. Users assigned to a post are sent to it automatically — see `lookups.myLandingPost`.
 */
const POST_ROUTES = ['/check-in', '/check-out', '/checkpoint', '/front-desk'] as const;

/** The sign-in url to bounce to from `path`, preserving where to come back to. */
export function signInUrlFor(path: string): string {
  return `/?next=${encodeURIComponent(path)}`;
}

/**
 * The post path held in `?next=`, or null. Only known post routes are honoured, so a crafted link
 * can't turn the sign-in page into an open redirect.
 */
export function nextPostPath(search: string): string | null {
  const next = new URLSearchParams(search).get('next');
  if (!next) return null;
  return POST_ROUTES.some((r) => next === r || next.startsWith(`${r}/`)) ? next : null;
}
