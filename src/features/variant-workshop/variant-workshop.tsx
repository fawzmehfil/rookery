"use client";

import { useState } from "react";
import type { VariantDefinition } from "@rookery/rules";
import { LocalPlaytest } from "@/features/local-playtest/local-playtest";
import {
  createLocalSession,
  type LocalSession,
  type SessionStartError,
} from "@/features/local-playtest/local-session";
import { VariantEditor } from "@/features/variant-editor/variant-editor";
import { PieceAppearanceProvider, usePieceAppearance } from "@/features/piece-library/appearance";
import { DraftControls } from "@/features/draft-persistence/draft-controls";
import type { DraftRepository } from "@/features/draft-persistence/repository";
import { useDraftPersistence } from "@/features/draft-persistence/use-draft-persistence";
import styles from "@/features/draft-persistence/draft-controls.module.css";

export type VariantWorkshopProps = {
  /** Replaces browser storage, e.g. with an in-memory repository in tests. */
  repository?: DraftRepository;
};

/** Owns the exact draft, its local persistence, and one disposable local engine session for this route. */
export function VariantWorkshop({ repository }: VariantWorkshopProps) {
  return <PieceAppearanceProvider><WorkshopSession repository={repository} /></PieceAppearanceProvider>;
}

function WorkshopSession({ repository }: VariantWorkshopProps) {
  const persistence = useDraftPersistence(repository);
  const { tokens, setToken } = usePieceAppearance();
  const [session, setSession] = useState<LocalSession | null>(null);

  if (persistence.phase === "restoring") {
    return <main className={styles.restoring}><p role="status">Restoring your draft…</p></main>;
  }

  function startPlaytest(variant: VariantDefinition): string | void {
    if (persistence.phase !== "ready") return;
    const result = createLocalSession(variant);

    if (!result.ok) return describeStartError(result.error);

    // Only the variant is persisted; the session's GameState and history never are.
    persistence.handoff();
    setSession(result.value);
  }

  async function reset() {
    if (persistence.phase !== "ready") return;
    await persistence.reset();
    Object.keys(tokens).forEach((id) => setToken(id, ""));
  }

  if (session) {
    return (
      <LocalPlaytest
        initialSession={session}
        onReturnToEditor={() => {
          persistence.returnToEditor();
          setSession(null);
        }}
      />
    );
  }

  return (
    <VariantEditor
      key={persistence.editorKey}
      initialVariant={persistence.editorDraft}
      initialMessage={persistence.editorMessage}
      onDraftChange={persistence.onDraftChange}
      onPlaytest={startPlaytest}
      draftControls={<DraftControls status={persistence.status} notice={persistence.notice} onReset={reset} />}
    />
  );
}

function describeStartError(error: SessionStartError): string {
  if (error.code === "PARSE_FAILED" || error.code === "VALIDATION_FAILED") {
    return `Playtest blocked: ${error.issues.map(({ message }) => message).join(" ")}`;
  }

  return `Playtest blocked: ${error.error.message}`;
}
