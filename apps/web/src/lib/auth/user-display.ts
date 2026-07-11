import type { User } from "@supabase/supabase-js";
import type { MeResponse } from "@/lib/api";

export type DashboardUser = {
  name: string;
  email?: string;
  avatarUrl?: string | null;
  provider?: string | null;
};

function metaString(user: User, key: string): string | null {
  const value = user.user_metadata?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function authProviderLabel(provider?: string | null): string | null {
  if (!provider) return null;
  if (provider === "google") return "Google";
  if (provider === "email") return "Email";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function resolveDashboardUser(sessionUser: User, me?: MeResponse | null): DashboardUser {
  const email = me?.user.email ?? sessionUser.email ?? undefined;
  const name =
    me?.profile?.display_name ??
    metaString(sessionUser, "display_name") ??
    metaString(sessionUser, "full_name") ??
    metaString(sessionUser, "name") ??
    email?.split("@")[0] ??
    "Account";

  const avatarUrl =
    me?.profile?.avatar_url ??
    metaString(sessionUser, "avatar_url") ??
    metaString(sessionUser, "picture");

  const provider =
    sessionUser.identities?.[0]?.provider ??
    (typeof sessionUser.app_metadata?.provider === "string"
      ? sessionUser.app_metadata.provider
      : null);

  return { name, email, avatarUrl, provider };
}
