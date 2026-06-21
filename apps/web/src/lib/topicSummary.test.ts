import { describe, expect, it } from "vitest";

import { formatTopicSummary } from "./topicSummary";

describe("formatTopicSummary", () => {
  it("turns memo-grafter intent and outcome labels into a personal reflection", () => {
    const summary =
      "User wanted: The user expressed feelings of anxiety related to pursuing perfection. They seemed to be reflecting on the consequences of such worries. Outcome: The conversation highlighted that the user is aware of their tendency to worry excessively about achieving perfection.";

    expect(formatTopicSummary(summary)).toBe(
      "You wrote about feelings of anxiety related to pursuing perfection. You were reflecting on the consequences of such worries. You noticed your tendency to worry excessively about achieving perfection.",
    );
  });

  it("keeps an already friendly summary intact", () => {
    expect(formatTopicSummary("You wrote about wanting more room to rest.")).toBe(
      "You wrote about wanting more room to rest.",
    );
  });

  it("converts an unlabeled third-person summary", () => {
    expect(formatTopicSummary("The user is considering a change in direction")).toBe(
      "You are considering a change in direction.",
    );
  });
});
