"use client";

import { useState } from "react";
import { createScriptedSession } from "./fixtures/scripted-session";
import { PlaytestScreen } from "./playtest-screen";

/*
 * Runs the playtest screen against the scripted fixture so the flow can be
 * reviewed before the real session controller exists. The only legal move
 * at each step is the next move of the scripted game: e4 e5 Qh5 Nc6 Bc4 Nf6 Qxf7#.
 */
export function PlaytestPreview() {
  const [session] = useState(() => createScriptedSession());
  return <PlaytestScreen session={session} />;
}
