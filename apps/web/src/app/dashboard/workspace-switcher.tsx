"use client";

import Link from "next/link";

type Workspace = {
  slug: string | null;
  name: string;
  type: string;
};

export function WorkspaceSwitcher({
  workspaces,
  currentSlug,
}: {
  workspaces: Workspace[];
  currentSlug: string;
}) {
  return (
    <nav>
      <p style={{ color: "#7b8da8", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Cost accounts
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0" }}>
        {workspaces.map((ws) =>
          ws.slug ? (
            <li key={ws.slug} style={{ marginBottom: 6 }}>
              <Link
                href={`/dashboard/${ws.slug}`}
                style={{
                  color: ws.slug === currentSlug ? "#e8edf5" : "#7b8da8",
                  textDecoration: "none",
                  fontWeight: ws.slug === currentSlug ? 600 : 400,
                  fontSize: 14,
                }}
              >
                {ws.name}
              </Link>
            </li>
          ) : null,
        )}
      </ul>
    </nav>
  );
}
