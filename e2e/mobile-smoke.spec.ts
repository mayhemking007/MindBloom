import { expect, test } from "@playwright/test";

const emptySnapshot = {
  sessionId: "mindbloom-session-2026-06-03",
  nodes: [],
  edges: [],
  memories: [],
  memoryEdges: [],
  capturedAt: "2026-06-03T10:00:00.000Z",
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/session/today", async (route) => {
    await route.fulfill({
      json: {
        sessionId: "mindbloom-session-2026-06-03",
        date: "2026-06-03",
      },
    });
  });

  await page.route("**/api/snapshot**", async (route) => {
    await route.fulfill({ json: emptySnapshot });
  });
});

test("mobile navigation and empty states render without overlap", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("MindBloom")).toBeVisible();
  await expect(page.getByPlaceholder("Write a thought...")).toBeVisible();
  await expect(page.getByRole("navigation")).toBeVisible();

  await page.getByRole("link", { name: "Map" }).click();
  await expect(page.getByText("Your mind map is still forming")).toBeVisible();

  await page.getByRole("link", { name: "Timeline" }).click();
  await expect(page.getByText("Your timeline is waiting")).toBeVisible();

  await page.getByRole("link", { name: "Reflect" }).click();
  await expect(page.getByText("A reflection needs a few days")).toBeVisible();
});

test("Bloom overlay renders from mocked API response", async ({ page }) => {
  await page.route("**/api/bloom", async (route) => {
    await route.fulfill({
      json: {
        sessionId: "mindbloom-session-2026-06-03",
        capturedAt: "2026-06-03T10:00:00.000Z",
        topWord: "space",
        insights: {
          mood: "A busy mind finding space",
          moodArc: "The session softened as the thought became clearer.",
          archetype: "The Patient Noticer",
          archetypeCaption: "You stayed with what kept returning.",
          sessionSong: "A quiet indie track with a gentle final chorus.",
          wordOfDay: "space",
          wordOfDayCopy: "It was what the day kept asking for.",
          recurringThread: "You wanted more room around your thoughts.",
          shareableTagline: "I made a little room for myself today.",
        },
        snapshot: emptySnapshot,
      },
    });
  });

  await page.addInitScript(() => {
    sessionStorage.setItem(
      "mindbloom:chat:mindbloom-session-2026-06-03",
      JSON.stringify({
        messages: [
          { id: "1", role: "user", content: "one" },
          { id: "2", role: "user", content: "two" },
          { id: "3", role: "user", content: "three" },
          { id: "4", role: "user", content: "four" },
          { id: "5", role: "user", content: "five" },
        ],
        topicPills: [],
      }),
    );
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Bloom My Mind See your session, differently" }).click();
  await expect(page.getByText("Your MindBloom")).toBeVisible();
  await expect(page.getByText("A busy mind finding space")).toBeVisible();
});
