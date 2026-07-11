const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export async function apiFetch<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export type MeResponse = {
  user: { id: string; email?: string };
  profile: {
    display_name: string | null;
    avatar_url: string | null;
    default_workspace_id: string | null;
  } | null;
  workspaces: Array<{
    id: string;
    name: string;
    slug: string | null;
    type: string;
    description: string | null;
    role: string;
  }>;
};

export type OrgTree = {
  workspace: { id: string; name: string; slug: string | null; type: string };
  role: string;
  collections: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    projects: Array<{ id: string; name: string; slug: string; environment: string; budget: number | null }>;
  }>;
  ungrouped_projects: Array<{ id: string; name: string; slug: string; environment: string; budget: number | null }>;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    children: Array<{ id: string; name: string; slug: string }>;
  }>;
  vendors: Array<{ id: string; name: string; slug: string; category?: string | null }>;
  budgets: Array<{ id: string; name: string; amount: number; period: string }>;
};
