import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BloomGraph } from "../bloom/BloomGraph";
import { MindMap } from "./MindMap";

describe("empty graph states", () => {
  it("renders the Bloom graph empty state", () => {
    render(<BloomGraph nodes={[]} edges={[]} />);
    expect(screen.getByText("Your mind map is still forming")).toBeVisible();
  });

  it("renders the full Mind Map empty state", () => {
    render(<MindMap nodes={[]} edges={[]} />);
    expect(screen.getByText("Your mind map is still forming")).toBeVisible();
  });
});
