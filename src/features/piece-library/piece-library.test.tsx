import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { firstFlightVariant } from "@rookery/rules/fixtures";
import { type PieceTypeDefinition, parseVariantDefinition } from "@rookery/rules";
import { PieceLibrary } from "./piece-library";
import { TypeDesigner } from "./type-designer";
import { VariantEditor } from "@/features/variant-editor/variant-editor";
afterEach(cleanup);

it("discovers Empress by alias, previews Chancellor, and adds an independent type",async()=>{
  const user=userEvent.setup();const add=vi.fn();render(<PieceLibrary draft={firstFlightVariant} onAdd={add} onClose={()=>{}} />);
  await user.type(screen.getByLabelText("Search pieces"),"Empress");
  expect(screen.getByRole("status").textContent).toContain("1 templates");
  await user.click(screen.getByRole("button",{name:"Preview Chancellor"}));
  expect(screen.getByRole("region",{name:"Chancellor preview"})).toBeTruthy();
  await user.click(screen.getByRole("button",{name:"Add Chancellor"}));
  expect(add.mock.calls[0][0].movements).toHaveLength(2);
  expect(parseVariantDefinition({...firstFlightVariant,pieceTypes:[...firstFlightVariant.pieceTypes,add.mock.calls[0][0]]}).ok).toBe(true);
});

function DesignerHarness(){const [type,setType]=useState<PieceTypeDefinition>({id:"unicorn",name:"Unicorn",royal:false,movements:[]});return <><TypeDesigner type={type} onChange={setType} token="U" onTokenChange={()=>{}} /><output data-testid="type">{JSON.stringify(type)}</output></>;}
it("creates a visual bishop ray, synchronizes vectors immediately, and preserves invalid drafts",async()=>{
  const user=userEvent.setup();render(<DesignerHarness />);
  await user.selectOptions(screen.getByLabelText("Draw movement"),"slide");
  await user.selectOptions(screen.getByLabelText("Symmetry shortcut"),"all");
  const mini=screen.getByRole("group",{name:"Movement designer"});await user.click(within(mini).getByRole("button",{name:"f6"}));
  let type=JSON.parse(screen.getByTestId("type").textContent!);expect(type.movements[0].directions).toHaveLength(4);
  await user.click(screen.getByText("Advanced: edit movement vectors"));
  fireEvent.change(screen.getByLabelText("Across 1.1"),{target:{value:"0"}});
  fireEvent.change(screen.getByLabelText("Forward 1.1"),{target:{value:"0"}});
  expect(screen.getByRole("alert").textContent).toContain("cannot be zero");
  type=JSON.parse(screen.getByTestId("type").textContent!);expect(type.movements[0].directions[0]).toEqual({fileDelta:0,rankDelta:0});
  fireEvent.change(screen.getByLabelText("Across 1.1"),{target:{value:"1"}});fireEvent.change(screen.getByLabelText("Forward 1.1"),{target:{value:"1"}});
  expect(screen.queryByRole("alert")).toBeNull();
});
it("draws owner-relative capture-only leaps and mirrors the player preview",async()=>{
  const user=userEvent.setup();render(<DesignerHarness />);
  await user.selectOptions(screen.getByLabelText("Direction frame"),"owner");await user.selectOptions(screen.getByLabelText("Movement behavior"),"capture-only");
  const mini=()=>screen.getByRole("group",{name:"Movement designer"});
  await user.click(within(mini()).getByRole("button",{name:"f7"}));
  expect(JSON.parse(screen.getByTestId("type").textContent!).movements[0]).toEqual({kind:"leap",frame:"owner",mode:"capture-only",offsets:[{fileDelta:1,rankDelta:2}]});
  await user.selectOptions(screen.getByLabelText("Preview player"),"1");
  expect(within(mini()).getByRole("button",{name:"f3, capture"})).toBeTruthy();
});
it("requires explicit type removal approval and preserves the cancel path",async()=>{
  const user=userEvent.setup();render(<VariantEditor />);
  await user.selectOptions(screen.getByLabelText("Piece type to edit"),"tower");await user.click(screen.getByRole("button",{name:"Remove piece type"}));
  expect(screen.getByRole("dialog").textContent).toContain("2 placed piece(s)");
  await user.click(screen.getByRole("button",{name:"Cancel removal"}));expect((screen.getByLabelText("Palette piece") as HTMLSelectElement).options).toHaveLength(3);
  await user.click(screen.getByRole("button",{name:"Remove piece type"}));await user.click(screen.getByRole("button",{name:"Remove type and placements"}));
  expect((screen.getByLabelText("Palette piece") as HTMLSelectElement).options).toHaveLength(2);
  expect(screen.getByRole("group",{name:"Variant editor board"}).querySelector('[data-square="a1"]')?.getAttribute("aria-label")).toBe("a1");
});
