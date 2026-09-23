import type { TFile } from "obsidian";
import { NoteSource } from "../../src/note-source";

export function fixtureSource(path = "Inbox/Synthetic.md"): NoteSource {
  return new NoteSource({ path } as TFile);
}
