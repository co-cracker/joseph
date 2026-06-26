import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<Response> {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return Response.redirect(`${req.nextUrl.origin}/ticktick?error=no_code`);
  }

  const clientId = process.env.TICKTICK_CLIENT_ID;
  const clientSecret = process.env.TICKTICK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.redirect(`${req.nextUrl.origin}/ticktick?error=no_config`);
  }

  const redirectUri = `${req.nextUrl.origin}/api/ticktick/callback`;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const tokenRes = await fetch("https://ticktick.com/oauth/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    return Response.redirect(`${req.nextUrl.origin}/ticktick?error=token_failed`);
  }

  const data = (await tokenRes.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    return Response.redirect(`${req.nextUrl.origin}/ticktick?error=no_token`);
  }

  const cookieStore = await cookies();
  cookieStore.set("tt_token", data.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: data.expires_in ?? 86400 * 30,
    path: "/",
    sameSite: "lax",
  });

  return Response.redirect(`${req.nextUrl.origin}/ticktick?connected=1`);
}
