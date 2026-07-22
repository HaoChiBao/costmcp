import {
  exchangePublicToken,
  messageFromPlaidError,
  statusFromPlaidError,
} from "@/lib/plaid/service";
import { authenticateWorkspaceAccess } from "@/lib/workspace-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const auth = await authenticateWorkspaceAccess(request, slug);
  if (auth instanceof Response) return auth;

  let body: {
    public_token?: string;
    institution?: { institution_id?: string; name?: string } | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.public_token?.trim()) {
    return Response.json({ error: "public_token is required" }, { status: 400 });
  }

  try {
    const result = await exchangePublicToken({
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      publicToken: body.public_token.trim(),
      institution: body.institution ?? null,
    });
    return Response.json(result, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: messageFromPlaidError(err) },
      { status: statusFromPlaidError(err) },
    );
  }
}
