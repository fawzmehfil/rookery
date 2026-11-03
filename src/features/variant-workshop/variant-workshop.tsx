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

/** Owns the exact draft and one disposable local engine session for this route. */
export function VariantWorkshop() {
  const [draft, setDraft] = useState<VariantDefinition | undefined>(undefined);
  const [session, setSession] = useState<LocalSession | null>(null);

  function startPlaytest(variant: VariantDefinition): string | void {
    const result = createLocalSession(variant);

    if (!result.ok) return describeStartError(result.error);

    setDraft(variant);
    setSession(result.value);
  }

  if (session) {
    return <LocalPlaytest initialSession={session} onReturnToEditor={() => setSession(null)} />;
  }

  return <VariantEditor initialVariant={draft} onPlaytest={startPlaytest} />;
}

function describeStartError(error: SessionStartError): string {
  if (error.code === "PARSE_FAILED" || error.code === "VALIDATION_FAILED") {
    return `Playtest blocked: ${error.issues.map(({ message }) => message).join(" ")}`;
  }

  return `Playtest blocked: ${error.error.message}`;
}
