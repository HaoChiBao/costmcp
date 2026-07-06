export async function GET() {
  return Response.json({
    ok: true,
    service: "costmcp-api",
    version: "0.0.1",
  });
}
