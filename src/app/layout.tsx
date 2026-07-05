import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Techno Daemon",
  description: "A self-evolving generative rave machine with a daemon's taste."
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
