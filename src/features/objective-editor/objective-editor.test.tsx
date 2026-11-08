import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { VariantDefinition } from "@rookery/rules";
import { firstFlightVariant, longWalkVariant } from "@rookery/rules/fixtures";
import { ObjectiveEditor } from "./objective-editor";
import { ShowcasePicker } from "./showcase-picker";
import { VariantEditor } from "@/features/variant-editor/variant-editor";
afterEach(cleanup);
function Harness({initial=firstFlightVariant}:{initial?:VariantDefinition}){const[draft,setDraft]=useState(initial);const[player,setPlayer]=useState<string|null>(null);return <><ObjectiveEditor draft={draft} onChange={setDraft} targetPlayer={player} onTargetPlayerChange={setPlayer}/><output data-testid="draft">{JSON.stringify(draft)}</output></>;}

it("shows relevant controls for exactly one objective and upgrades schema output",async()=>{
  const user=userEvent.setup();render(<Harness/>);
  expect(screen.getByText(/Each player needs exactly one/)).toBeTruthy();
  await user.click(screen.getByRole("button",{name:/^Reach a target$/}));
  expect(screen.getByLabelText("White target coordinate")).toBeTruthy();expect(screen.getByText(/Starting on a target does not win/)).toBeTruthy();
  expect(JSON.parse(screen.getByTestId("draft").textContent!).schemaVersion).toBe(2);
  await user.click(screen.getByRole("button",{name:/^Eliminate all opponents$/}));
  expect(screen.queryByLabelText("White target coordinate")).toBeNull();expect(JSON.parse(screen.getByTestId("draft").textContent!).objectives).toEqual([{type:"eliminate-all"}]);
});
it("requires confirmation before discarding configured targets and preserves cancellation",async()=>{
  const user=userEvent.setup();render(<Harness initial={longWalkVariant}/>);
  await user.click(screen.getByRole("button",{name:/^Capture the royal$/}));
  expect(screen.getByRole("alert").textContent).toContain("discard");
  await user.click(screen.getByRole("button",{name:"Cancel replacement"}));expect(screen.getByLabelText("White target coordinate")).toBeTruthy();
  await user.click(screen.getByRole("button",{name:/^Capture the royal$/}));await user.click(screen.getByRole("button",{name:"Confirm objective switch"}));
  expect(JSON.parse(screen.getByTestId("draft").textContent!).objectives).toEqual([{type:"capture-royal"}]);
});
it("adds multiple targets with keyboard form submission, rejects duplicates, and edits eligibility",async()=>{
  const user=userEvent.setup();render(<Harness initial={longWalkVariant}/>);
  await user.type(screen.getByLabelText("White target coordinate"),"b3{Enter}");
  expect(screen.getByRole("button",{name:"Remove White target b3"})).toBeTruthy();
  await user.click(screen.getByRole("button",{name:"Add White target"}));expect(screen.getByText(/already a target/)).toBeTruthy();
  const white=screen.getByRole("region",{name:"White targets"});
  // Long Walk starts with a runner restriction; allow any piece, then restrict again.
  await user.click(within(white).getByRole("checkbox",{name:"Any White piece can reach a target"}));
  await user.click(within(white).getByRole("checkbox",{name:"Any White piece can reach a target"}));
  await user.click(within(white).getByRole("checkbox",{name:"Runner"}));
  const output=JSON.parse(screen.getByTestId("draft").textContent!);expect(output.objectives[0].targets[0].eligiblePieceTypeIds).toEqual(["runner"]);
  await user.click(screen.getByRole("button",{name:"Remove White target b3"}));expect(screen.queryByRole("button",{name:"Remove White target b3"})).toBeNull();
});
it("uses main-board target mode without moving pieces and blocks invalid configuration",async()=>{
  const user=userEvent.setup();const handoff=vi.fn();render(<VariantEditor onPlaytest={handoff}/>);
  await user.click(screen.getByRole("button",{name:/^Reach a target$/}));expect((screen.getByRole("button",{name:"Open playtest"}) as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole("button",{name:"Select White targets on board"}));
  const board=screen.getByRole("group",{name:"Variant editor board"});await user.click(within(board).getByRole("button",{name:"b4"}));
  expect(screen.getByRole("button",{name:"Remove White target b4"})).toBeTruthy();expect(board.querySelector('[data-square="a1"]')?.getAttribute("aria-label")).toContain("White Tower");
  await user.click(screen.getByRole("button",{name:"Select Black targets on board"}));await user.click(within(board).getByRole("button",{name:"d2"}));
  await user.click(screen.getByRole("button",{name:"Open playtest"}));expect(handoff.mock.calls[0][0].objectives[0].targets).toEqual([{playerId:"white",cells:[{file:1,rank:3}]},{playerId:"black",cells:[{file:3,rank:1}]}]);
});
it("warns on dirty showcase replacement, cancels safely and loads an independent copy",async()=>{
  const user=userEvent.setup();const load=vi.fn();const edited={...firstFlightVariant,name:"My draft"};render(<ShowcasePicker draft={edited} onLoad={load}/>);
  await user.click(screen.getByRole("button",{name:"Load The Long Walk"}));expect(load).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button",{name:"Cancel replacement"}));expect(load).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button",{name:"Load The Long Walk"}));await user.click(screen.getByRole("button",{name:"Confirm load The Long Walk"}));
  expect(load.mock.calls[0][0]).toEqual(longWalkVariant);expect(load.mock.calls[0][0]).not.toBe(longWalkVariant);
});
it("prevents destructive board changes that would strand targets",async()=>{
  const user=userEvent.setup();render(<VariantEditor initialVariant={longWalkVariant}/>);
  fireEvent.change(screen.getByLabelText("Ranks (rows)"),{target:{value:"2"}});await user.click(screen.getByRole("button",{name:"Apply board size"}));
  expect(screen.getByRole("status").textContent).toContain("before shrinking");
  fireEvent.change(screen.getByLabelText("Cell coordinate"),{target:{value:"a3"}});await user.click(screen.getByRole("button",{name:"Enable / disable cell"}));
  expect(screen.getByRole("status").textContent).toContain("before disabling");
});
