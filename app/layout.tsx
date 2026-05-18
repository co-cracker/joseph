import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "책 분석기 — 비문학 챕터 분석",
  description:
    "책 제목과 챕터, 핵심 개념을 넣으면 정해진 4파트 구조로 분석해주는 도구.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        {children}
      </body>
    </html>
  );
}
