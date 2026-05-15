import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NULLBEAT",
  description: "A minimal generative techno beat machine for focused work."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
