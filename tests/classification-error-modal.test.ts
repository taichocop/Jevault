import type { App } from "obsidian";
import { describe, expect, it, vi } from "vitest";

interface FakeElement {
  children: FakeElement[];
  disabled: boolean;
  text: string;
  click(): void;
}

vi.mock("obsidian", () => {
  class Element {
    children: Element[] = [];
    disabled = false;
    text = "";
    private clickHandler: (() => void) | undefined;

    empty(): void {
      this.children = [];
    }

    createEl(_tag: string, options?: { text?: string }): Element {
      const child = new Element();
      child.text = options?.text ?? "";
      this.children.push(child);
      return child;
    }

    addEventListener(event: string, handler: () => void): void {
      if (event === "click") {
        this.clickHandler = handler;
      }
    }

    click(): void {
      this.clickHandler?.();
    }
  }

  class Modal {
    contentEl = new Element();

    open(): void {
      (this as unknown as { onOpen(): void }).onOpen();
    }

    close(): void {
      (this as unknown as { onClose(): void }).onClose();
    }
  }

  return { App: class {}, Modal };
});

import { ClassificationErrorModal } from "../src/suggestion/classification-error-modal";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function button(modal: ClassificationErrorModal, text: string): FakeElement {
  const contentEl = modal.contentEl as unknown as FakeElement;
  const result = contentEl.children.find((child) => child.text === text);
  if (result === undefined) {
    throw new Error(`Missing ${text} button`);
  }
  return result;
}

describe("ClassificationErrorModal", () => {
  it("disables Retry while pending and renders the latest failure", async () => {
    const retryResult = deferred<{
      status: "failure";
      presentation: { message: string; retryable: boolean };
    }>();
    const retry = vi.fn(() => retryResult.promise);
    const modal = new ClassificationErrorModal(
      {} as App,
      {
        message: "Jevault couldn't classify this note.\nPlease try again.",
        retryable: true,
      },
      retry,
    );
    modal.open();

    const retryButton = button(modal, "Retry");
    retryButton.click();
    retryButton.click();

    expect(retry).toHaveBeenCalledOnce();
    expect(retryButton.disabled).toBe(true);

    retryResult.resolve({
      status: "failure",
      presentation: {
        message: "Open a Markdown note before running Jevault.",
        retryable: false,
      },
    });
    await retryResult.promise;
    await Promise.resolve();

    const contentEl = modal.contentEl as unknown as FakeElement;
    expect(contentEl.children.map((child) => child.text)).toContain(
      "Open a Markdown note before running Jevault.",
    );
    expect(contentEl.children.map((child) => child.text)).not.toContain("Retry");
    expect(contentEl.children.map((child) => child.text)).toContain("Close");
  });
});
