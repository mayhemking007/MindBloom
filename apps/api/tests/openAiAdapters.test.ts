import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function OpenAIMock() {
    return {
      chat: {
        completions: {
          create: createMock,
        },
      },
    };
  }),
}));

const { MindBloomOpenAILLMAdapter } = await import(
  "../src/memo-grafter/openAiAdapters.js"
);

describe("MindBloomOpenAILLMAdapter", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("uses JSON mode for memo-grafter segment extraction", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: '{"label":"Test"}' } }],
    });
    const adapter = new MindBloomOpenAILLMAdapter("gpt-4o-mini");

    const response = await adapter.complete([
      {
        role: "user",
        content:
          "Analyze this conversation segment and extract structured memory.\nReturn a single valid JSON object and nothing else.",
      },
    ]);

    expect(response).toBe('{"label":"Test"}');
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
      }),
    );
    expect(createMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        stream: true,
      }),
    );
  });

  it("streams normal chat completions without JSON mode", async () => {
    async function* streamChunks() {
      yield { choices: [{ delta: { content: "hello " } }] };
      yield { choices: [{ delta: { content: "there" } }] };
    }
    createMock.mockResolvedValue(streamChunks());
    const onChunk = vi.fn();
    const adapter = new MindBloomOpenAILLMAdapter("gpt-4o-mini", {
      streaming: true,
      onChunk,
    });

    const response = await adapter.complete([{ role: "user", content: "Hi" }]);

    expect(response).toBe("hello there");
    expect(onChunk).toHaveBeenNthCalledWith(1, "hello ");
    expect(onChunk).toHaveBeenNthCalledWith(2, "there");
    expect(createMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        response_format: expect.anything(),
      }),
    );
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stream: true,
      }),
    );
  });
});
