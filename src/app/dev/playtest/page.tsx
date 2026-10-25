import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlaytestPreview } from "@/components/playtest/playtest-preview";

export const metadata: Metadata = { title: "Playtest preview" };

// Uses a scripted test session, so it's only available in development.
export default function PlaytestPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main style={{ width: "min(100% - 2rem, 1200px)", margin: "1.5rem auto" }}>
      <PlaytestPreview />
    </main>
  );
}
