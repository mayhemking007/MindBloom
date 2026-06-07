import { z } from "zod";
import type {
  EntryMessage,
  GraphSnapshotResponse,
  JournalEntry,
  Note,
  ReflectionCard,
  TopicPill,
} from "@mindbloom/shared";

import { openai } from "./openai.js";

interface BuildEntryReflectionInput {
  entry: JournalEntry;
  documentText: string;
  messages: EntryMessage[];
  notes: Note[];
  topicPills: TopicPill[];
  graphSnapshot: GraphSnapshotResponse;
}

const generatedReflectionSchema = z.object({
  mood: z.string().min(1),
  takeaways: z.array(z.string().min(1)).min(1).max(5),
  quote: z.string().min(1),
  song: z.string().min(1),
  weather: z.string().min(1),
  word: z.string().min(1),
  question: z.string().min(1),
});

type GeneratedReflection = z.infer<typeof generatedReflectionSchema>;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function firstSentence(text: string): string {
  const sentence = text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .find((item) => item.trim().length > 0);
  return sentence?.trim() || "You made room for a thought that wanted attention.";
}

function mostCommonWord(text: string): string {
  const stopWords = new Set([
    "about",
    "after",
    "again",
    "also",
    "because",
    "being",
    "could",
    "from",
    "have",
    "into",
    "just",
    "like",
    "that",
    "their",
    "there",
    "this",
    "want",
    "with",
    "would",
    "your",
  ]);
  const counts = new Map<string, number>();
  for (const rawWord of text.toLowerCase().match(/[a-z]{4,}/g) ?? []) {
    if (stopWords.has(rawWord)) {
      continue;
    }
    counts.set(rawWord, (counts.get(rawWord) ?? 0) + 1);
  }

  return (
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "notice"
  );
}

function fallbackReflection(input: BuildEntryReflectionInput): GeneratedReflection {
  const combinedText = [
    input.documentText,
    ...input.messages.map((message) => message.content),
    ...input.notes.map((note) => note.body),
  ].join("\n");
  const primaryTheme = input.topicPills[0]?.label ?? input.entry.title;

  return {
    mood: `You noticed ${primaryTheme.toLowerCase()} with some honesty.`,
    takeaways: [
      `You wanted to understand ${primaryTheme.toLowerCase()} more clearly.`,
      "You gave the thought enough room to become specific.",
      input.notes.length > 0
        ? "You saved a few pieces that felt worth keeping."
        : "You left yourself a thread to return to later.",
    ],
    quote: firstSentence(combinedText),
    song: "A steady, low-tempo track that opens quietly and ends with a little more air.",
    weather: "Clouds thinning into a calm patch of light.",
    word: mostCommonWord(combinedText),
    question: "What part of this still wants a little more honesty next time?",
  };
}

function buildPrompt(input: BuildEntryReflectionInput): string {
  const messages = input.messages
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
  const notes = input.notes.map((note) => `- ${note.title}: ${note.body}`).join("\n");
  const themes = input.topicPills.map((theme) => theme.label).join(", ");

  return `Entry title: ${input.entry.title}
Entry purpose: ${input.entry.purpose}

Classic writing:
${input.documentText || "None"}

Bloom conversation:
${messages || "None"}

User-written notes:
${notes || "None"}

Current themes:
${themes || "None"}

Write directly to the user in second person. Use phrases like "You wanted", "You noticed", and "You returned to" when they fit.`;
}

async function generateReflectionText(
  input: BuildEntryReflectionInput,
): Promise<GeneratedReflection> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            'You create warm, specific entry reflection cards for a journaling app. Respond only with JSON matching: {"mood":"...","takeaways":["..."],"quote":"...","song":"...","weather":"...","word":"...","question":"..."}',
        },
        { role: "user", content: buildPrompt(input) },
      ],
      temperature: 0.7,
    });
    const rawText = response.choices[0]?.message?.content ?? "";
    return generatedReflectionSchema.parse(JSON.parse(rawText) as unknown);
  } catch {
    return fallbackReflection(input);
  }
}

export async function buildEntryReflectionCards(
  input: BuildEntryReflectionInput,
): Promise<ReflectionCard[]> {
  const generated = await generateReflectionText(input);
  const wordCount = countWords(input.documentText);
  const bloomTurns = input.messages.filter((message) => message.role !== "system")
    .length;
  const themeLabels = input.topicPills.map((theme) => theme.label);

  return [
    {
      id: "stats",
      type: "stats",
      title: "Words You Put Down",
      body: `You wrote ${wordCount} words, talked with Bloom ${bloomTurns} times, and saved ${input.notes.length} notes from this entry.`,
      metadata: { wordCount, bloomTurns, noteCount: input.notes.length },
    },
    {
      id: "mood",
      type: "mood",
      title: "Mood",
      body: generated.mood,
    },
    {
      id: "takeaways",
      type: "takeaways",
      title: "What You Took With You",
      body: generated.takeaways.map((takeaway) => `- ${takeaway}`).join("\n"),
      metadata: { takeaways: generated.takeaways },
    },
    {
      id: "mind-map",
      type: "mind-map",
      title: "Mind Map Snapshot",
      body:
        themeLabels.length > 0
          ? `You circled around ${themeLabels.slice(0, 4).join(", ")}.`
          : "Your themes are still forming.",
      metadata: {
        themeLabels,
        graphSnapshot: input.graphSnapshot,
      },
    },
    {
      id: "quote",
      type: "quote",
      title: "Line Worth Keeping",
      body: generated.quote,
    },
    {
      id: "song",
      type: "song",
      title: "If This Entry Were A Song",
      body: generated.song,
    },
    {
      id: "weather",
      type: "weather",
      title: "If This Entry Were Weather",
      body: generated.weather,
    },
    {
      id: "word",
      type: "word",
      title: "Word To Carry Forward",
      body: generated.word,
    },
    {
      id: "question",
      type: "question",
      title: "Question For Next Time",
      body: generated.question,
    },
  ];
}
