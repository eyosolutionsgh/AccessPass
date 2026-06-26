import { createAuthClient } from 'better-auth/react';
import { adminClient, organizationClient } from 'better-auth/client/plugins';
import { ac, roles } from '@vms/shared';

/**
 * better-auth client. Shares the SAME access-control + roles as the server so permission
 * checks in the UI match server enforcement exactly (SRS FR-002).
 */
export const authClient = createAuthClient({
  plugins: [adminClient({ ac, roles }), organizationClient({ ac, roles })],
});

export const { signIn, signOut, useSession, resetPassword, requestPasswordReset } = authClient;
