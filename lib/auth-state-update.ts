export function shouldReloadProfile(args: {
  incomingUserId: string | null;
  currentUserId: string | null;
  hasProfile: boolean;
}): boolean {
  if (!args.incomingUserId) return false;
  if (!args.hasProfile) return true;
  return args.incomingUserId !== args.currentUserId;
}

export function shouldReplaceSession(
  incomingAccessToken: string | null | undefined,
  currentAccessToken: string | null | undefined,
): boolean {
  return incomingAccessToken !== currentAccessToken;
}
