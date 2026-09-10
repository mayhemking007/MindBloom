import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { LLMAdapter, MemoGrafterOperationOptions, Message } from "memo-grafter";

interface MindBloomOpenAIOptions {
  streaming?: boolean;
  onChunk?: (chunk: string) => void | Promise<void>;
}

function isSegmentExtractionPrompt(messages: Message[]) {
  return messages.some(
    (message) =>
      message.role === "user" &&
      (message.content.includes("Analyze this conversation segment:") ||
        message.content.includes("Analyze this document segment:")) &&
      message.content.includes("Return a single valid JSON object"),
  );
}

export class MindBloomOpenAILLMAdapter implements LLMAdapter {
  private readonly client = new OpenAI();

  constructor(
    private readonly model = "gpt-4o-mini",
    private readonly options: MindBloomOpenAIOptions = {},
  ) {}

  async complete(
    messages: Message[],
    system?: string,
    operationOptions?: MemoGrafterOperationOptions,
  ): Promise<string> {
    const timeoutSignal = operationOptions?.timeoutMs
      ? AbortSignal.timeout(operationOptions.timeoutMs)
      : undefined;
    const operationSignal = operationOptions?.signal && timeoutSignal
      ? AbortSignal.any([operationOptions.signal, timeoutSignal])
      : operationOptions?.signal ?? timeoutSignal;
    const openAiMessages: ChatCompletionMessageParam[] = [
      ...(system ? [{ role: "system" as const, content: system }] : []),
      ...messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    const shouldUseJsonMode = isSegmentExtractionPrompt(messages);

    if (this.options.streaming && !shouldUseJsonMode) {
      const request = {
        model: this.model,
        messages: openAiMessages,
        stream: true as const,
      };
      const stream = operationSignal
        ? await this.client.chat.completions.create(request, {
            signal: operationSignal,
          })
        : await this.client.chat.completions.create(request);
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

    const request = {
      model: this.model,
      messages: openAiMessages,
      ...(shouldUseJsonMode
        ? { response_format: { type: "json_object" as const } }
        : {}),
    };
    const response = operationSignal
      ? await this.client.chat.completions.create(request, {
          signal: operationSignal,
        })
      : await this.client.chat.completions.create(request);

    return response.choices[0]?.message.content ?? "";
  }
}
