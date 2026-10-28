import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "カスタマーサポート Copilot",
  description: "追跡可能で担当者へ引き継げるAIカスタマーサポートのデモ",
};

export default function JapaneseLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div lang="ja-JP">{children}</div>;
}
