export type ColorRamp =
  | "coral"
  | "purple"
  | "teal"
  | "amber"
  | "blue"
  | "pink"
  | "gray";

const colorMap: Record<string, ColorRamp> = {
  work: "coral",
  job: "coral",
  career: "coral",
  manager: "coral",
  review: "coral",
  office: "coral",
  colleague: "coral",
  meeting: "coral",
  promotion: "coral",
  stress: "coral",
  pressure: "coral",
  self: "purple",
  identity: "purple",
  worth: "purple",
  confidence: "purple",
  fear: "purple",
  anxiety: "purple",
  doubt: "purple",
  shame: "purple",
  purpose: "purple",
  meaning: "purple",
  values: "purple",
  family: "teal",
  friend: "teal",
  partner: "teal",
  relationship: "teal",
  mother: "teal",
  father: "teal",
  sister: "teal",
  brother: "teal",
  love: "teal",
  connection: "teal",
  loneliness: "teal",
  mood: "amber",
  happy: "amber",
  sad: "amber",
  tired: "amber",
  energy: "amber",
  rest: "amber",
  sleep: "amber",
  exhausted: "amber",
  joy: "amber",
  grief: "amber",
  anger: "amber",
  calm: "amber",
  goal: "blue",
  future: "blue",
  plan: "blue",
  dream: "blue",
  change: "blue",
  growth: "blue",
  learning: "blue",
  decision: "blue",
  health: "pink",
  body: "pink",
  exercise: "pink",
  eating: "pink",
  therapy: "pink",
  medication: "pink",
};

export function getColorForTopic(label: string): ColorRamp {
  const lower = label.toLowerCase();
  for (const [keyword, color] of Object.entries(colorMap)) {
    if (lower.includes(keyword)) {
      return color;
    }
  }
  return "gray";
}

export const colorClasses: Record<
  ColorRamp,
  { bg: string; border: string; text: string; dot: string; fill: string }
> = {
  coral: {
    bg: "bg-coral-bg",
    border: "border-coral-border",
    text: "text-coral-text",
    dot: "bg-coral-border",
    fill: "fill-coral-border",
  },
  purple: {
    bg: "bg-purple-bg",
    border: "border-purple-border",
    text: "text-purple-text",
    dot: "bg-purple-border",
    fill: "fill-purple-border",
  },
  teal: {
    bg: "bg-teal-bg",
    border: "border-teal-border",
    text: "text-teal-text",
    dot: "bg-teal-border",
    fill: "fill-teal-border",
  },
  amber: {
    bg: "bg-amber-bg",
    border: "border-amber-border",
    text: "text-amber-text",
    dot: "bg-amber-border",
    fill: "fill-amber-border",
  },
  blue: {
    bg: "bg-blue-bg",
    border: "border-blue-border",
    text: "text-blue-text",
    dot: "bg-blue-border",
    fill: "fill-blue-border",
  },
  pink: {
    bg: "bg-pink-bg",
    border: "border-pink-border",
    text: "text-pink-text",
    dot: "bg-pink-border",
    fill: "fill-pink-border",
  },
  gray: {
    bg: "bg-gray-bg",
    border: "border-gray-border",
    text: "text-gray-text",
    dot: "bg-gray-border",
    fill: "fill-gray-border",
  },
};

export const constellationRamps: Record<
  ColorRamp,
  { bright: string; mid: string; dim: string }
> = {
  coral: { bright: "#d85a30", mid: "#f0997b", dim: "#f5c4b3" },
  purple: { bright: "#534ab7", mid: "#7f77dd", dim: "#afa9ec" },
  teal: { bright: "#1d9e75", mid: "#5dcaa5", dim: "#9fe1cb" },
  amber: { bright: "#ba7517", mid: "#ef9f27", dim: "#fac775" },
  blue: { bright: "#185fa5", mid: "#378add", dim: "#85b7eb" },
  pink: { bright: "#993556", mid: "#d4537e", dim: "#ed93b1" },
  gray: { bright: "#5f5e5a", mid: "#888780", dim: "#b4b2a9" },
};
