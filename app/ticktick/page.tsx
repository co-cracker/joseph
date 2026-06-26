"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Project { id: string; name: string; }
interface SubItem { id: string; title: string; }
interface PhotoTask { id: string; title: string; }
type Status = "idle" | "loading" | "done" | "error";

const STORAGE_KEY = "tt_subtasks";
const PROJECT_KEY = "tt_project";

function stripExtension(name: string): string {
  return name.replace(/\.[^/.]+$/, "");
}
function uid(): string {
  return Math.random().toString(36).slice(2);
}

export default function TickTickImportPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [subtasks, setSubtasks] = useState<SubItem[]>([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [tasks, setTasks] = useState<PhotoTask[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<{ title: string; ok: boolean }[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { try { setSubtasks(JSON.parse(saved) as SubItem[]); } catch {} }
    const savedProject = localStorage.getItem(PROJECT_KEY);
    if (savedProject) setSelectedProject(savedProject);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) setErrorMsg(`TickTick 연결 실패: ${params.get("error")}`);

    fetch("/api/ticktick/projects")
      .then((r) => { if (r.status === 401) { setConnected(false); return null; } return r.json(); })
      .then((data: Project[] | null) => {
        if (!data) return;
        setConnected(true);
        setProjects(data);
        const savedId = localStorage.getItem(PROJECT_KEY);
        if (savedId && data.some((p) => p.id === savedId)) setSelectedProject(savedId);
        else if (data.length > 0) setSelectedProject(data[0].id);
      })
      .catch(() => setConnected(false));
  }, []);

  const saveSubtasks = (items: SubItem[]) => {
    setSubtasks(items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  };
  const addSubtask = () => {
    const t = newSubtask.trim();
    if (!t) return;
    saveSubtasks([...subtasks, { id: uid(), title: t }]);
    setNewSubtask("");
  };
  const removeSubtask = (id: string) => saveSubtasks(subtasks.filter((s) => s.id !== id));
  const moveSubtask = (id: string, dir: -1 | 1) => {
    const idx = subtasks.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= subtasks.length) return;
    const arr = [...subtasks];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    saveSubtasks(arr);
  };
  const onFilesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setTasks((prev) => [...prev, ...files.map((f) => ({ id: uid(), title: stripExtension(f.name) }))]);
    e.target.value = "";
  }, []);
  const removeTask = (id: string) => setTasks((prev) => prev.filter((t) => t.id !== id));
  const updateTaskTitle = (id: string, title: string) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
  const handleProjectChange = (id: string) => {
    setSelectedProject(id);
    localStorage.setItem(PROJECT_KEY, id);
  };

  const createTasks = async () => {
    if (!tasks.length || !selectedProject) return;
    setStatus("loading");
    setErrorMsg(null);
    setResults([]);
    try {
      const res = await fetch("/api/ticktick/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: tasks.map((t) => ({ title: t.title })),
          projectId: selectedProject,
          subtasks: subtasks.map((s) => ({ title: s.title })),
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(d.error ?? `오류 (${res.status})`);
        setStatus("error");
        return;
      }
      const data = (await res.json()) as { results: { title: string; ok: boolean }[] };
      setResults(data.results);
      setStatus("done");
      const failedTitles = new Set(data.results.filter((r) => !r.ok).map((r) => r.title));
      setTasks((prev) => prev.filter((t) => failedTitles.has(t.title)));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "알 수 없는 오류");
      setStatus("error");
    }
  };

  if (connected === null) return <main className="mx-auto max-w-2xl px-5 py-12 text-stone-600">TickTick 연결 확인 중…</main>;

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 sm:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">TickTick 사진 일괄 추가</h1>
        <p className="mt-2 text-stone-600 text-sm">파일앱에서 사진을 여러 장 선택 → 각 파일명이 일정 제목이 돼 · 하위항목 템플릿 자동 적용</p>
      </header>

      {errorMsg && <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{errorMsg}</div>}

      <Section label="1. TickTick 계정 연결">
        {connected ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-green-700 font-medium">연결됨</span>
            <a href="/api/ticktick/auth" className="text-xs text-stone-500 underline hover:text-stone-800">다시 연결</a>
          </div>
        ) : (
          <a href="/api/ticktick/auth" className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700">TickTick로 로그인</a>
        )}
      </Section>

      {connected && (
        <>
          <Section label="2. 일정을 추가할 리스트">
            {projects.length === 0 ? <p className="text-sm text-stone-500">리스트 불러오는 중…</p> : (
              <select value={selectedProject} onChange={(e) => handleProjectChange(e.target.value)}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </Section>

          <Section label="3. 하위항목 템플릿 (모든 일정에 공통 적용)">
            <div className="space-y-2">
              {subtasks.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="text-stone-400 text-xs w-4">{i + 1}</span>
                  <span className="flex-1 text-sm text-stone-800">{s.title}</span>
                  <button type="button" onClick={() => moveSubtask(s.id, -1)} disabled={i === 0} className="text-stone-400 hover:text-stone-700 disabled:opacity-20 px-1">↑</button>
                  <button type="button" onClick={() => moveSubtask(s.id, 1)} disabled={i === subtasks.length - 1} className="text-stone-400 hover:text-stone-700 disabled:opacity-20 px-1">↓</button>
                  <button type="button" onClick={() => removeSubtask(s.id)} className="text-red-400 hover:text-red-600 px-1 text-sm">✕</button>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <input type="text" value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSubtask()} placeholder="하위항목 추가 (Enter)"
                  className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-sm placeholder:text-stone-400 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500" />
                <button type="button" onClick={addSubtask} className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-100">추가</button>
              </div>
              {subtasks.length === 0 && <p className="text-xs text-stone-400">하위항목을 추가하면 모든 일정에 동일하게 들어가.</p>}
            </div>
          </Section>

          <Section label="4. 사진 선택 (여러 장 가능)">
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFilesChange} className="hidden" />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="rounded-lg border-2 border-dashed border-stone-300 px-6 py-4 text-sm text-stone-600 hover:border-stone-500 hover:text-stone-800 w-full text-center">
              + 사진 선택 (파일앱에서 여러 장 선택 가능)
            </button>
            {tasks.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-stone-500 font-medium">일정 미리보기 — 제목을 직접 수정할 수 있어</p>
                {tasks.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className="text-stone-400 text-xs w-5">{i + 1}</span>
                    <input type="text" value={t.title} onChange={(e) => updateTaskTitle(t.id, e.target.value)}
                      className="flex-1 rounded-lg border border-stone-200 px-3 py-1.5 text-sm focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400" />
                    <button type="button" onClick={() => removeTask(t.id)} className="text-red-400 hover:text-red-600 px-1 text-sm">✕</button>
                  </div>
                ))}
                {subtasks.length > 0 && (
                  <div className="mt-2 rounded-lg bg-stone-50 px-4 py-3">
                    <p className="text-xs text-stone-500 font-medium mb-1">각 일정에 들어갈 하위항목:</p>
                    {subtasks.map((s) => <p key={s.id} className="text-xs text-stone-600">□ {s.title}</p>)}
                  </div>
                )}
              </div>
            )}
          </Section>

          {tasks.length > 0 && (
            <Section label="">
              <button type="button" onClick={createTasks} disabled={status === "loading"}
                className="w-full rounded-lg bg-stone-900 px-5 py-3 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400">
                {status === "loading" ? `생성 중… (${tasks.length}개)` : `TickTick에 일정 ${tasks.length}개 만들기`}
              </button>
            </Section>
          )}

          {results.length > 0 && (
            <Section label="결과">
              <div className="space-y-1">
                {results.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span>{r.ok ? "✓" : "✗"}</span>
                    <span className={r.ok ? "text-green-700" : "text-red-600"}>{r.title}</span>
                  </div>
                ))}
              </div>
              {results.every((r) => r.ok) && <p className="mt-3 text-sm text-green-700 font-medium">전부 생성 완료! TickTick 앱에서 확인해봐.</p>}
            </Section>
          )}
        </>
      )}

      {!connected && (
        <div className="mt-8 rounded-xl bg-stone-50 border border-stone-200 p-5 text-sm text-stone-700 space-y-2">
          <p className="font-medium">처음 사용 전 설정</p>
          <ol className="list-decimal list-inside space-y-1 text-stone-600">
            <li><a href="https://developer.ticktick.com/manage" target="_blank" rel="noopener noreferrer" className="underline hover:text-stone-900">developer.ticktick.com</a>에서 앱 등록</li>
            <li>OAuth Redirect URI: <code className="bg-stone-100 px-1">[배포URL]/api/ticktick/callback</code></li>
            <li>발급받은 Client ID / Secret을 Vercel 환경변수에 추가</li>
          </ol>
        </div>
      )}

      <footer className="mt-12 text-center text-xs text-stone-400">TickTick Open API · 파일명 → 일정 제목 · 하위항목 템플릿</footer>
    </main>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      {label && <h2 className="text-sm font-semibold text-stone-800 mb-3">{label}</h2>}
      {children}
    </div>
  );
}
