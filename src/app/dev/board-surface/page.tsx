import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BoardSurfacePreview } from "@/components/board-surface/board-surface-preview";

export const metadata: Metadata = { title: "Board surface preview" };

// A review page for the shared board component; it isn't part of the product.
export default function BoardSurfacePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main style={{ width: "min(100% - 2rem, 1200px)", margin: "2rem auto" }}>
      <h1>Board surface</h1>
      <BoardSurfacePreview />
    </main>
  );
}
