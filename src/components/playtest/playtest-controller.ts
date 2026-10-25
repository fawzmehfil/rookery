"use client";

import { useReducer } from "react";
import type { BoardSquare, SquareActivation } from "@/components/board-surface";
import type { LegalAction, PlaytestAction, PlaytestEvent, PlaytestSession, PlaytestSnapshot, SessionError } from "./session";

/*
 * Turns board activations into session calls. It holds only UI state
 * (selection, pending promotion, the last error); positions, turns and
 * outcomes always come from what the session returns.
 */

export type PlaytestView = {
  snapshot: PlaytestSnapshot;
  selected: BoardSquare | null;
  /** Legal actions for the selected piece, exactly as the session reported them. */
  actions: readonly LegalAction[];
  /** Set when a destination allows more than one promotion. */
  promotionChoices: readonly LegalAction[] | null;
  error: string | null;
  /** Confirmed events, newest first, with the turn they happened on. */
  log: readonly { turn: number; event: PlaytestEvent }[];
};

type Action =
  | { type: "select"; square: BoardSquare; actions: readonly LegalAction[] }
  | { type: "deselect" }
  | { type: "choose-promotion"; choices: readonly LegalAction[] }
  | { type: "accepted"; snapshot: PlaytestSnapshot; turn: number }
  | { type: "rejected"; error: string }
  | { type: "reset"; snapshot: PlaytestSnapshot };

export function initialView(snapshot: PlaytestSnapshot): PlaytestView {
  return { snapshot, selected: null, actions: [], promotionChoices: null, error: null, log: [] };
}

export function playtestReducer(view: PlaytestView, action: Action): PlaytestView {
  switch (action.type) {
    case "select":
      return { ...view, selected: action.square, actions: action.actions, promotionChoices: null, error: null };
    case "deselect":
      return { ...view, selected: null, actions: [], promotionChoices: null };
    case "choose-promotion":
      return { ...view, promotionChoices: action.choices };
    case "accepted":
      return {
        ...initialView(action.snapshot),
        log: [...action.snapshot.events.map((event) => ({ turn: action.turn, event })).reverse(), ...view.log],
      };
    case "rejected":
      // The board is left exactly as the session last confirmed it.
      return { ...view, selected: null, actions: [], promotionChoices: null, error: action.error };
    case "reset":
      return initialView(action.snapshot);
  }
}

const FRIENDLY_ERRORS: Record<string, string> = {
  "illegal-move": "That move isn't allowed in this position.",
  "illegal-action": "That move isn't allowed in this position.",
  "not-your-turn": "It's the other player's turn.",
  "game-over": "The game is over. Reset to play again.",
  "invalid-state": "The game reached a state it can't continue from. Reset to start again.",
};

/** Plain-language text for a structured session error. */
export function describeError(error: SessionError): string {
  return FRIENDLY_ERRORS[error.code] ?? error.message;
}

export function usePlaytest(session: PlaytestSession) {
  const [view, dispatch] = useReducer(playtestReducer, session, (initial) => initialView(initial.snapshot()));
  const { snapshot, selected, actions } = view;

  function submit({ from, to, promotion }: PlaytestAction) {
    const result = session.submit({ type: "move", from, to, ...(promotion && { promotion }) });
    if (result.ok) dispatch({ type: "accepted", snapshot: result.snapshot, turn: snapshot.turnNumber });
    else dispatch({ type: "rejected", error: describeError(result.error) });
  }

  function activate({ square, piece }: SquareActivation) {
    if (snapshot.outcome) return;

    if (selected && square !== selected) {
      const matches = actions.filter((candidate) => candidate.to === square);
      if (matches.length > 1) return dispatch({ type: "choose-promotion", choices: matches });
      if (matches.length === 1) return submit(matches[0]);
    }

    if (piece?.side === snapshot.activeSide) {
      if (square === selected) return dispatch({ type: "deselect" });
      return dispatch({ type: "select", square, actions: session.legalActions(square) });
    }

    // Anything else is still sent, so the session explains why it isn't allowed.
    if (selected) return submit({ type: "move", from: selected, to: square });
    if (piece) {
      dispatch({ type: "rejected", error: describeError({ code: "not-your-turn", message: "" }) });
    }
  }

  return {
    view,
    activate,
    choosePromotion: (action: LegalAction) => submit(action),
    cancelPromotion: () => dispatch({ type: "deselect" }),
    reset: () => dispatch({ type: "reset", snapshot: session.reset() }),
  };
}
