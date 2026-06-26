import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { LLMAdapter, Message } from "memo-grafter";

interface MindBloomOpenAIOptions {
  streaming?: boolean;
  onChunk?: (chunk: string) => void | Promise<void>;
}

function isSegmentExtractionPrompt(messages: Message[]) {
  return messages.some(
    (message) =>
      message.role === "user" &&
      message.content.includes(
        "Analyze this conversation segment and extract structured memory",
      ) &&
      message.content.includes("Return a single valid JSON object"),
  );
}

export class MindBloomOpenAILLMAdapter implements LLMAdapter {
  private readonly client = new OpenAI();

  constructor(
    private readonly model = "gpt-4o-mini",
    private readonly options: MindBloomOpenAIOptions = {},
  ) {}

  async complete(messages: Message[], system?: string): Promise<string> {
    const openAiMessages: ChatCompletionMessageParam[] = [
      ...(system ? [{ role: "system" as const, content: system }] : []),
      ...messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    const shouldUseJsonMode = isSegmentExtractionPrompt(messages);

    if (this.options.streaming && !shouldUseJsonMode) {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: openAiMessages,
        stream: true,
      });
      let response = "";
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta.content;
        if (!content) {
          continue;
        }
        response += content;
        await this.options.onChunk?.(content);
      }
      return response;
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: openAiMessages,
      ...(shouldUseJsonMode
        ? { response_format: { type: "json_object" as const } }
        : {}),
    });

    return response.choices[0]?.message.content ?? "";
  }
}
