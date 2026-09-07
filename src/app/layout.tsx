import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "客服 Copilot",
  description: "可追溯、可接管的AI客服演示",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
