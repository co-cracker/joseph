"use client";

import { useCallback, useRef, useState } from "react";

interface FormState {
  bookTitle: string;
  chapter: string;
  coreConcept: string;
  extraContext: string;
  accessCode: string;
}

const EMPTY_FORM: FormState = {
  bookTitle: "",
  chapter: "",
  coreConcept: "",
  extraContext: "",
  accessCode: "",
};

const SAMPLE: FormState = {
  bookTitle: "에니어그램",
  chapter: "4번 유형 - 결핍감",
  coreConcept: "결핍감",
  extraContext: "",
  accessCode: "",
};

export default function HomePage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [output, setOutput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAccessCode, setShowAccessCode] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const update = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const fillSample = () => {
    setForm((prev) => ({ ...SAMPLE, accessCode: prev.accessCode }));
    setOutput("");
    setErrorMsg(null);
  };

  const reset = () => {
    abortRef.current?.abort();
    setForm((prev) => ({ ...EMPTY_FORM, accessCode: prev.accessCode }));
    setOutput("");
    setErrorMsg(null);
  };

  const copyOutput = useCallback(async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      // Some browsers block clipboard access — silently no-op.
    }
  }, [output]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isStreaming) return;

    const trimmed = {
      bookTitle: form.bookTitle.trim(),
      chapter: form.chapter.trim(),
      coreConcept: form.coreConcept.trim(),
      extraContext: form.extraContext.trim(),
      accessCode: form.accessCode.trim(),
    };

    if (!trimmed.bookTitle || !trimmed.chapter || !trimmed.coreConcept) {
      setErrorMsg("책 제목, 챕터, 핵심 개념은 필수야.");
      return;
    }

    setErrorMsg(null);
    setOutput("");
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trimmed),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 401) setShowAccessCode(true);
        setErrorMsg(data.error || `요청 실패 (${res.status})`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setErrorMsg("응답 스트림을 읽을 수 없어.");
        return;
      }

      const decoder = new TextDecoder();
      // Read until done, appending each chunk to the output buffer.
      // The route emits an inline `[오류로 중단됨]` marker if the upstream
      // Claude call fails mid-stream — that's surfaced as part of the output.
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          setOutput((prev) => prev + chunk);
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setErrorMsg(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했어.",
      );
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          책 분석기
        </h1>
        <p className="mt-3 text-stone-600">
          책 제목 · 챕터 · 핵심 개념을 입력하면, 정해진 4파트 구조(배경지식 →
          욕구와 행동 → 챕터 연결 → 세포 비유)로 분석해줘.
        </p>
      </header>

      <form
        onSubmit={submit}
        className="space-y-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <Field
          label="책 제목"
          value={form.bookTitle}
          onChange={(v) => update("bookTitle", v)}
          placeholder="예: 에니어그램"
          required
        />
        <Field
          label="챕터"
          value={form.chapter}
          onChange={(v) => update("chapter", v)}
          placeholder="예: 4번 유형 - 결핍감"
          required
        />
        <Field
          label="핵심 개념"
          value={form.coreConcept}
          onChange={(v) => update("coreConcept", v)}
          placeholder="예: 결핍감"
          required
        />
        <TextareaField
          label="추가 맥락 (선택)"
          value={form.extraContext}
          onChange={(v) => update("extraContext", v)}
          placeholder="이 챕터에서 특히 주목할 부분이나 책의 흐름 메모. 비워둬도 돼."
        />

        {showAccessCode && (
          <Field
            label="접속 코드"
            value={form.accessCode}
            onChange={(v) => update("accessCode", v)}
            placeholder="공유받은 코드를 입력해줘"
            type="password"
          />
        )}

        {errorMsg && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isStreaming}
            className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {isStreaming ? "분석 중…" : "분석하기"}
          </button>
          {isStreaming && (
            <button
              type="button"
              onClick={stop}
              className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              중지
            </button>
          )}
          <button
            type="button"
            onClick={fillSample}
            disabled={isStreaming}
            className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
          >
            샘플 채우기
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={isStreaming}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-stone-500 hover:text-stone-700 disabled:opacity-50"
          >
            초기화
          </button>
        </div>
      </form>

      {(output || isStreaming) && (
        <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">분석 결과</h2>
            {output && !isStreaming && (
              <button
                type="button"
                onClick={copyOutput}
                className="text-sm text-stone-600 hover:text-stone-900"
              >
                복사하기
              </button>
            )}
          </div>
          <div
            className={`analysis-output text-stone-800 ${
              isStreaming ? "streaming-caret" : ""
            }`}
          >
            {output ||
              (isStreaming ? "Claude가 분석을 시작하고 있어…" : null)}
          </div>
        </section>
      )}

      <footer className="mt-12 text-center text-xs text-stone-400">
        Google Gemini 2.5 Flash · 비문학 책 분석 템플릿 · 0원 무료
      </footer>
    </main>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-stone-800">
        {props.label}
        {props.required && <span className="ml-1 text-red-500">*</span>}
      </span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        required={props.required}
        className="mt-1.5 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-stone-400 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
      />
    </label>
  );
}

function TextareaField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-stone-800">
        {props.label}
      </span>
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        rows={3}
        className="mt-1.5 block w-full resize-y rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-stone-400 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
      />
    </label>
  );
}
