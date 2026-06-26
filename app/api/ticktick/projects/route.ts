import { cookies } from "next/headers";

export const runtime = "nodejs";

interface TProject {
  id: string;
  name: string;
}

export async function GET(): Promise<Response> {
  const cookieStore = await cookies();
  const token = cookieStore.get("tt_token")?.value;
  if (!token) {
    return new Response(JSON.stringify({ error: "not_connected" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const res = await fetch("https://api.ticktick.com/open/v1/project", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return new Response(JSON.stringify({ error: "api_error", status: res.status }), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const projects = (await res.json()) as TProject[];
  return new Response(JSON.stringify(projects), {
    headers: { "Content-Type": "application/json" },
  });
}
