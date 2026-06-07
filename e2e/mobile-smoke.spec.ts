import { expect, test } from "@playwright/test";

const emptySnapshot = {
  sessionId: "mindbloom-session-2026-06-03",
  nodes: [],
  edges: [],
  memories: [],
  memoryEdges: [],
  capturedAt: "2026-06-03T10:00:00.000Z",
};

const entry = {
  id: "entry-1",
  ownerId: "demo-local",
  ownerKind: "demo",
  title: "Morning thoughts",
  purpose: "journal",
  mode: "classic",
  status: "draft",
  memoSessionId: "mindbloom-entry-entry-1",
  createdAt: "2026-06-03T10:00:00.000Z",
  updatedAt: "2026-06-03T10:00:00.000Z",
  completedAt: null,
  allowFutureContext: true,
};

const entryGroups = [
  {
    date: "2026-06-03",
    entries: [entry],
  },
];

test.beforeEach(async ({ page }) => {
  let savedReflection:
    | {
        id: string;
        entryId: string;
        cards: Array<{
          id: string;
          type: string;
          title: string;
          body: string;
        }>;
        graphSnapshot: typeof emptySnapshot;
        createdAt: string;
      }
    | null = null;
  let sharedCardIds: string[] = [];

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

  await page.route("**/api/entries", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 201, json: { entry } });
      return;
    }

    await route.fulfill({
      json: {
        entries: [entry],
        groups: entryGroups,
      },
    });
  });

  await page.route("**/api/entries/entry-1/document", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({
        json: {
          document: {
            id: "document-1",
            entryId: "entry-1",
            content: JSON.parse(route.request().postData() ?? "{}").content ?? "",
            version: 1,
            lastIngestedVersion: null,
            createdAt: "2026-06-03T10:00:00.000Z",
            updatedAt: "2026-06-03T10:00:00.000Z",
          },
        },
      });
      return;
    }

    await route.fulfill({
      json: {
        document: null,
      },
    });
  });

  await page.route("**/api/entries/entry-1/messages", async (route) => {
    if (route.request().method() === "POST") {
      const body = JSON.parse(route.request().postData() ?? "{}");
      await route.fulfill({
        status: 201,
        json: {
          message: {
            id: `${body.role}-message`,
            entryId: "entry-1",
            role: body.role,
            content: body.content,
            createdAt: "2026-06-03T10:00:00.000Z",
          },
        },
      });
      return;
    }

    await route.fulfill({ json: { messages: [] } });
  });

  await page.route("**/api/entries/entry-1/grafts", async (route) => {
    await route.fulfill({ json: { grafts: [] } });
  });

  await page.route("**/api/entries/entry-1/grafts/relevance", async (route) => {
    await route.fulfill({
      json: {
        grafts: [
          {
            id: "graft-1",
            entryId: "entry-1",
            query: "starting point",
            sourceEntryId: "entry-old",
            sourceEntryTitle: "Earlier entry",
            sourceEntryCreatedAt: "2026-06-02T10:00:00.000Z",
            sourceSessionId: "mindbloom-entry-entry-old",
            sourceThemeId: "theme-old",
            themeLabel: "Returning to the beginning",
            similarity: null,
            graftedAt: "2026-06-03T10:00:00.000Z",
          },
        ],
        topicPills: [{ id: "theme-2", label: "Previous theme", topicOrder: 1 }],
        tokenCount: 24,
      },
    });
  });

  await page.route("**/api/notes", async (route) => {
    await route.fulfill({ json: { notes: [], groups: [] } });
  });

  await page.route("**/api/entries/entry-1/reflections", async (route) => {
    if (route.request().method() === "POST") {
      savedReflection = {
        id: "reflection-1",
        entryId: "entry-1",
        cards: [
          {
            id: "stats",
            type: "stats",
            title: "Words You Put Down",
            body: "You wrote 12 words.",
          },
          {
            id: "question",
            type: "question",
            title: "Question For Next Time",
            body: "What wants attention next?",
          },
        ],
        graphSnapshot: emptySnapshot,
        createdAt: "2026-06-03T10:00:00.000Z",
      };
      await route.fulfill({
        status: 201,
        json: {
          reflection: savedReflection,
        },
      });
      return;
    }

    await route.fulfill({
      json: { reflections: savedReflection ? [savedReflection] : [] },
    });
  });

  await page.route("**/api/reflections/reflection-1/share-links", async (route) => {
    if (route.request().method() === "POST") {
      sharedCardIds = JSON.parse(route.request().postData() ?? "{}").selectedCardIds ?? [];
      await route.fulfill({
        status: 201,
        json: {
          shareLink: {
            id: "share-1",
            reflectionId: "reflection-1",
            token: "public-token-123456789",
            selectedCardIds: sharedCardIds,
            createdAt: "2026-06-03T10:01:00.000Z",
            expiresAt: null,
            revokedAt: null,
          },
        },
      });
      return;
    }

    await route.fulfill({
      json: {
        shareLinks:
          sharedCardIds.length > 0
            ? [
                {
                  id: "share-1",
                  reflectionId: "reflection-1",
                  token: "public-token-123456789",
                  selectedCardIds: sharedCardIds,
                  createdAt: "2026-06-03T10:01:00.000Z",
                  expiresAt: null,
                  revokedAt: null,
                },
              ]
            : [],
      },
    });
  });

  await page.route("**/api/share/public-token-123456789", async (route) => {
    await route.fulfill({
      json: {
        token: "public-token-123456789",
        cards: (savedReflection?.cards ?? []).filter((card) =>
          sharedCardIds.includes(card.id),
        ),
        createdAt: "2026-06-03T10:01:00.000Z",
        expiresAt: null,
      },
    });
  });
});

test("navigation and empty states render without overlap", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Write freely, ask Bloom when needed.")).toBeVisible();
  await expect(page.getByLabel("Journal entry")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Morning thoughts Journal · Classic" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toBeVisible();

  await page.getByRole("link", { name: "Map" }).click();
  await expect(page.getByText("Your mind map is still forming")).toBeVisible();

  await page.getByRole("link", { name: "Notes" }).click();
  await expect(page.getByText("No notes yet")).toBeVisible();

  await page.getByRole("link", { name: "Reflect" }).click();
  await expect(page.getByText("No reflection cards yet", { exact: true })).toBeVisible();
});

test("Bloom sidebar sends a message from the current entry", async ({ page }) => {
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      json: {
        reply: "You are finding the first thread.",
        topicPills: [{ id: "theme-1", label: "Starting point", topicOrder: 1 }],
      },
    });
  });

  await page.goto("/");
  await page.getByLabel("Ask Bloom").fill("Help me start");
  await page.getByLabel("Ask Bloom").press("Enter");
  await expect(page.getByText("You are finding the first thread.")).toBeVisible();
  await expect(page.getByText("Starting point")).toBeVisible();
});

test("creates and opens a public reflection share link", async ({ page }) => {
  await page.goto("/reflect");
  await page.getByRole("button", { name: "Reflect on this entry" }).click();
  await expect(
    page.getByRole("heading", { name: "Words You Put Down" }),
  ).toBeVisible();
  await page.getByLabel("Question For Next Time").click();
  await page.getByRole("button", { name: "Create share link" }).click();
  await page.goto("/share/public-token-123456789");
  await expect(page.getByText("Shared Reflection")).toBeVisible();
  await expect(page.getByText("Words You Put Down")).toBeVisible();
  await expect(page.getByText("Question For Next Time")).not.toBeVisible();
});

test("desktop layout uses a sidebar and wider map workspace", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Desktop-only responsive layout check",
  );

  await page.goto("/map");
  const navigation = page.getByRole("navigation");
  await expect(navigation).toBeVisible();

  const navigationBox = await navigation.boundingBox();
  expect(navigationBox?.height).toBeGreaterThan(700);

  const mapHeading = page.getByRole("heading", { name: "Mind Map" });
  const headingBox = await mapHeading.boundingBox();
  expect(headingBox?.x).toBeGreaterThan(220);
});
