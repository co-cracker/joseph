import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<Response> {
  const clientId = process.env.TICKTICK_CLIENT_ID;
  if (!clientId) {
    return new Response("TICKTICK_CLIENT_ID 환경변수가 설정되지 않았어.", { status: 500 });
  }

  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/ticktick/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    scope: "tasks:write tasks:read",
    redirect_uri: redirectUri,
    response_type: "code",
    state: "ticktick_import",
  });

  return Response.redirect(
    `https://ticktick.com/oauth/authorize?${params.toString()}`
  );
}
