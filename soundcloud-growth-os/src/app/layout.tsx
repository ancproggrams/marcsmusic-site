import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "SoundCloud Growth OS",
  description: "White-hat SoundCloud growth operating system for analytics, releases, comments, metadata, scene research, and experiments."
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="topbar">
            <Link className="brand" href="/dashboard">
              SoundCloud Growth OS
              <span>white-hat · human-approved</span>
            </Link>
            <nav className="nav" aria-label="Main navigation">
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/tracks">Tracks</Link>
              <Link href="/outreach">Outreach</Link>
              <Link href="/api/auth/soundcloud/start">Connect SoundCloud</Link>
            </nav>
          </header>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
