import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { setApiOwnerKind } from "../lib/api";

Object.defineProperty(window, "scrollTo", {
  value: () => undefined,
  writable: true,
});

Element.prototype.scrollIntoView = () => undefined;

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, "ResizeObserver", {
  value: ResizeObserverMock,
  writable: true,
});
Object.defineProperty(globalThis, "ResizeObserver", {
  value: ResizeObserverMock,
  writable: true,
});

beforeEach(() => {
  setApiOwnerKind("authenticated");
});

afterEach(() => {
  cleanup();
});
