import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

interface SubItem { title: string; }
interface TaskInput { title: string; }
interface CreateTasksRequest {
  tasks: TaskInput[];
  projectId: string;
  subtasks: SubItem[];
}
interface TickTaskItem {
  title: string;
  status: number;
  isAllDay: boolean;
  sortOrder: number;
}
interface TickTaskBody {
  title: string;
  projectId: string;
  items: TickTaskItem[];
}

export async function POST(req: NextRequest): Promise<Response> {
  const cookieStore = await cookies();
  const token = cookieStore.get("tt_token")?.value;
  if (!token) {
    return new Response(JSON.stringify({ error: "not_connected" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: CreateTasksRequest;
  try {
    body = (await req.json()) as CreateTasksRequest;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { tasks, projectId, subtasks } = body;
  if (!tasks?.length || !projectId) {
    return new Response(JSON.stringify({ error: "tasks and projectId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const items: TickTaskItem[] = (subtasks ?? []).map((s, i) => ({
    title: s.title,
    status: 0,
    isAllDay: false,
    sortOrder: i,
  }));

  const results: { title: string; ok: boolean; error?: string }[] = [];

  for (const task of tasks) {
    const taskBody: TickTaskBody = {
      title: task.title,
      projectId,
      items,
    };

    const res = await fetch("https://api.ticktick.com/open/v1/task", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(taskBody),
    });

    if (res.ok) {
      results.push({ title: task.title, ok: true });
    } else {
      const err = await res.text();
      results.push({ title: task.title, ok: false, error: err });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { "Content-Type": "application/json" },
  });
}
