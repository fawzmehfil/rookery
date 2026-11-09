import { getLegalActions, movementPatternSchema, pieceTemplateCatalog, type MovementPattern, type PieceTemplate, type PieceTypeDefinition, type VariantDefinition, type Vector } from "@rookery/rules";
import { firstFlightVariant } from "@rookery/rules/fixtures";

export const categories = [
  ["recommended", "Recommended"], ["standard", "Standard chess"], ["compound", "Compound pieces"],
  ["leaper", "Leapers"], ["rider", "Riders"], ["additional-classic", "Additional classics"], ["custom", "Your custom pieces"],
] as const;

export function searchTemplates(query: string, category = "all"): readonly PieceTemplate[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return pieceTemplateCatalog.filter(t => (category === "all" || t.category === category || (category === "recommended" && t.tags.includes("recommended")))
    && words.every(word => `${t.name} ${t.aliases.join(" ")} ${t.description} ${t.tags.join(" ")}`.toLowerCase().includes(word)));
}

export function uniqueTypeId(name: string, types: readonly PieceTypeDefinition[]) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  const base = /^[a-z]/.test(slug) ? slug : `piece-${slug || "custom"}`;
  let id = base, suffix = 2;
  while (types.some(t => t.id === id)) id = `${base}-${suffix++}`;
  return id;
}

export function addType(draft: VariantDefinition, type: PieceTypeDefinition): VariantDefinition {
  if (draft.pieceTypes.length >= 128) return draft;
  const copy = structuredClone(type);
  return { ...draft, pieceTypes: [...draft.pieceTypes, { ...copy, id: uniqueTypeId(type.id || type.name, draft.pieceTypes) }] };
}

export function removeType(draft: VariantDefinition, id: string): VariantDefinition {
  return { ...draft, pieceTypes: draft.pieceTypes.filter(t => t.id !== id), setup: draft.setup.filter(p => p.typeId !== id) };
}

export type Symmetry = "single" | "left-right" | "forward-backward" | "diagonals" | "rotations" | "all";
export function symmetricalVectors(v: Vector, symmetry: Symmetry): Vector[] {
  const x = v.fileDelta, y = v.rankDelta;
  const pairs = symmetry === "single" ? [[x,y]] : symmetry === "left-right" ? [[x,y],[-x,y]]
    : symmetry === "forward-backward" ? [[x,y],[x,-y]] : symmetry === "rotations" ? [[x,y],[-y,x],[-x,-y],[y,-x]]
    : symmetry === "diagonals" ? [[x,y],[y,x],[-y,-x],[-x,-y]]
    : [[x,y],[-x,y],[x,-y],[-x,-y],[y,x],[-y,x],[y,-x],[-y,-x]];
  return [...new Map(pairs.map(([fileDelta,rankDelta]) => [`${fileDelta},${rankDelta}`, { fileDelta: fileDelta || 0, rankDelta: rankDelta || 0 }])).values()];
}

export function duplicateMovement(type: PieceTypeDefinition): string | null {
  for (const m of type.movements) {
    const vectors = m.kind === "slide" ? m.directions : m.offsets;
    if (new Set(vectors.map(v => `${v.fileDelta},${v.rankDelta}`)).size !== vectors.length) return "Duplicate directions: remove a repeated destination from this rule.";
  }
  const keys = type.movements.map(m => JSON.stringify(m));
  return new Set(keys).size === keys.length ? null : "This piece has a duplicate movement rule. Remove the repeated rule.";
}

export function movementSummary(m: MovementPattern): string {
  const vectors=m.kind === "slide" ? m.directions : m.offsets;
  const allOrthogonal=vectors.length===4 && vectors.every(v=>Math.abs(v.fileDelta)+Math.abs(v.rankDelta)===1);
  const allDiagonal=vectors.length===4 && vectors.every(v=>Math.abs(v.fileDelta)===1 && Math.abs(v.rankDelta)===1);
  const knight=vectors.length===8 && vectors.every(v=>Math.abs(v.fileDelta)*Math.abs(v.rankDelta)===2);
  const verb=m.kind === "slide" ? "Slide" : m.kind === "leap" ? "Leap" : "Step";
  const direction=allOrthogonal ? "horizontally or vertically" : allDiagonal ? "diagonally" : knight ? "in all knight-like directions"
    : vectors.length===8 && m.kind!=="leap" ? "in all eight directions" : vectors.map(v=>`${Math.abs(v.fileDelta)} ${v.fileDelta<0?"left":"right"}, ${Math.abs(v.rankDelta)} ${v.rankDelta<0?"backward":"forward"}`).join("; ");
  return `${verb} ${direction} · ${m.mode.replaceAll("-"," ")}${m.kind === "slide" ? ` · ${m.maxDistance ? `up to ${m.maxDistance} cells` : "until blocked"}` : ""}. ${m.frame === "owner" ? "Forward follows the owner's direction" : "Directions stay fixed on the board"}.`;
}

/** Illustrative empty-board geometry from the PUBLIC movement engine. Behavior
 * is shown with distinct highlights; capture-only geometry is queried with an
 * empty-board probe using move-or-capture, not reimplemented in the frontend. */
export function previewTargets(type: PieceTypeDefinition, forwardRank: 1 | -1, size = 9) {
  const center = Math.floor(size / 2), moves = new Set<string>(), captures = new Set<string>();
  for (const m of type.movements) {
    if (!movementPatternSchema.safeParse(m).success) continue;
    const probeType = { ...type, movements: [{ ...m, mode: "move-or-capture" as const }] };
    const variant: VariantDefinition = { ...firstFlightVariant, board: { files: size, ranks: size, disabledCells: [] },
      players: [{ id: "preview", name: "Preview", forwardRank }, { id: "other", name: "Other", forwardRank: forwardRank === 1 ? -1 : 1 }],
      pieceTypes: [probeType], turnOrder: ["preview", "other"] };
    const actions = getLegalActions(variant, { variantId: variant.id, ply: 0, activePlayerId: "preview", outcome: null,
      pieces: [{ id: "preview-piece", typeId: type.id, ownerId: "preview", at: { file: center, rank: center } }] });
    for (const action of actions) {
      const square = `${String.fromCharCode(97 + action.to.file)}${action.to.rank + 1}`;
      if (m.mode === "capture-only") captures.add(square); else moves.add(square);
    }
  }
  return { moves: [...moves], captures: [...captures] };
}
