import {
  applyAction,
  createInitialState,
  parseVariantDefinition,
  validateVariantDefinition,
  type EngineError,
  type EngineEvent,
  type GameState,
  type MoveAction,
  type ParseIssue,
  type ValidationIssue,
  type VariantDefinition,
} from "@rookery/rules";

export type AcceptedAction = Readonly<{
  action: MoveAction;
  events: readonly EngineEvent[];
}>;

export type LocalSession = Readonly<{
  variant: VariantDefinition;
  initialState: GameState;
  state: GameState;
  history: readonly AcceptedAction[];
}>;

export type SessionStartError =
  | Readonly<{ code: "PARSE_FAILED"; issues: readonly ParseIssue[] }>
  | Readonly<{ code: "VALIDATION_FAILED"; issues: readonly ValidationIssue[] }>
  | Readonly<{ code: "INITIALIZATION_FAILED"; error: EngineError }>;

export type SessionStartResult =
  | Readonly<{ ok: true; value: LocalSession }>
  | Readonly<{ ok: false; error: SessionStartError }>;

export type SessionActionResult =
  | Readonly<{ ok: true; value: LocalSession }>
  | Readonly<{ ok: false; error: EngineError }>;

/**
 * The only local playtest trust boundary. The editor's shared draft is parsed
 * and semantically validated before any state can enter the engine.
 */
export function createLocalSession(input: unknown): SessionStartResult {
  const parsed = parseVariantDefinition(input);

  if (!parsed.ok) {
    return { ok: false, error: Object.freeze({ code: "PARSE_FAILED", issues: parsed.issues }) };
  }

  const issues = validateVariantDefinition(input);
  const blockingIssues = Object.freeze(issues.filter(({ severity }) => severity === "error"));

  if (blockingIssues.length > 0) {
    return {
      ok: false,
      error: Object.freeze({ code: "VALIDATION_FAILED", issues: blockingIssues }),
    };
  }

  const initial = createInitialState(parsed.value);

  if (!initial.ok) {
    return {
      ok: false,
      error: Object.freeze({ code: "INITIALIZATION_FAILED", error: initial.error }),
    };
  }

  return {
    ok: true,
    value: freezeSession(parsed.value, initial.value, initial.value, []),
  };
}

/** Applies one action and appends to the accepted log only on engine success. */
export function submitLocalAction(session: LocalSession, action: MoveAction): SessionActionResult {
  const result = applyAction(session.variant, session.state, action);

  if (!result.ok) return result;

  const accepted = Object.freeze({ action: freezeAction(action), events: result.value.events });

  return {
    ok: true,
    value: freezeSession(
      session.variant,
      session.initialState,
      result.value.state,
      [...session.history, accepted],
    ),
  };
}

/** Returns the exact validated starting position and clears all accepted input. */
export function resetLocalSession(session: LocalSession): LocalSession {
  return freezeSession(session.variant, session.initialState, session.initialState, []);
}

function freezeSession(
  variant: VariantDefinition,
  initialState: GameState,
  state: GameState,
  history: readonly AcceptedAction[],
): LocalSession {
  return Object.freeze({
    variant,
    initialState,
    state,
    history: Object.freeze([...history]),
  });
}

function freezeAction(action: MoveAction): MoveAction {
  return Object.freeze({
    type: "move",
    pieceId: action.pieceId,
    to: Object.freeze({ file: action.to.file, rank: action.to.rank }),
  });
}
