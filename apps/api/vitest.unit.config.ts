import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.unit.ts"],
    include: [
      "./tests/memoGrafter.test.ts",
      "./tests/openAiAdapters.test.ts",
      "./tests/notionIntegration.test.ts",
      "./tests/notionThoughts.test.ts",
    ],
    clearMocks: true,
    restoreMocks: true,
    fileParallelism: false,
  },
});
