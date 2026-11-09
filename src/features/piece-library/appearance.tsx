"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { PieceArt, type BoardPiece } from "@/components/board-surface";

type Appearance = { tokens: Record<string,string>; setToken: (id: string, token: string) => void };
const Context = createContext<Appearance>({ tokens: {}, setToken: () => {} });
export const usePieceAppearance = () => useContext(Context);
export function PieceAppearanceProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<Record<string,string>>({});
  return <Context.Provider value={{ tokens, setToken: (id, token) => setTokens(current => ({ ...current, [id]: token })) }}>{children}</Context.Provider>;
}
export function SessionPieceArt({ piece }: { piece: BoardPiece }) {
  const { tokens } = usePieceAppearance();
  const canonical = ({king:"sovereign",rook:"tower",knight:"hopper"} as Record<string,string>)[piece.kind] ?? piece.kind;
  const token = tokens[piece.kind] ?? tokens[canonical];
  return token ? <span style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", fontSize: "clamp(12px, 4cqw, 32px)", fontWeight: 800,
    color: piece.side === "white" ? "#fff" : "#172110", textShadow: piece.side === "white" ? "0 1px 3px #000" : "0 1px 2px #fff" }}>{token}</span>
    : <PieceArt kind={piece.kind} side={piece.side} />;
}
