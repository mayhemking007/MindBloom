import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { bloomFixture } from "../test/fixtures";
import { saveBloom } from "../lib/bloomStore";
import { ReflectPage } from "./ReflectPage";
import { TimelinePage } from "./TimelinePage";

describe("archive pages", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders Timeline empty state", () => {
    render(<TimelinePage />);
    expect(screen.getByText("Your timeline is waiting")).toBeVisible();
  });

  it("renders Timeline with a saved Bloom", () => {
    saveBloom(bloomFixture());
    render(<TimelinePage />);
    expect(screen.getAllByText("A quiet mind making room")).toHaveLength(2);
    expect(screen.getByText("Captured Mind Map")).toBeVisible();
  });

  it("renders Reflection empty state when no sessions are available", () => {
    render(<ReflectPage />);
    expect(screen.getByText("A reflection needs a few days")).toBeVisible();
  });
});
