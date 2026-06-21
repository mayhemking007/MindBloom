function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function ensureSentence(value: string): string {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) {
    return "";
  }
  const capitalized = trimmed.replace(
    /(^|[.!?]\s+)([a-z])/g,
    (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`,
  );
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

function useSecondPerson(value: string): string {
  return normalizeWhitespace(value)
    .replace(/\b[Tt]he user is\b/g, "you are")
    .replace(/\b[Tt]he user was\b/g, "you were")
    .replace(/\b[Tt]he user has\b/g, "you have")
    .replace(/\b[Tt]he user\b/g, "you")
    .replace(/\b[Tt]hey\b/g, "you")
    .replace(/\b[Tt]heir\b/g, "your")
    .replace(/\b[Tt]hem\b/g, "you")
    .replace(/\b[Tt]he conversation\b/g, "your writing")
    .replace(/\b[Yy]ou seemed to be\b/g, "you were");
}

function writeAbout(value: string): string {
  const secondPerson = ensureSentence(useSecondPerson(value));
  const withoutPeriod = secondPerson.replace(/[.]$/, "");

  const expressed = /^You expressed (.+)$/i.exec(withoutPeriod);
  if (expressed?.[1]) {
    return ensureSentence(`You wrote about ${expressed[1]}`);
  }

  const wanted = /^You wanted to (.+)$/i.exec(withoutPeriod);
  if (wanted?.[1]) {
    return ensureSentence(`You wrote about wanting to ${wanted[1]}`);
  }

  const explored = /^You (?:were )?explor(?:ing|ed) (.+)$/i.exec(withoutPeriod);
  if (explored?.[1]) {
    return ensureSentence(`You wrote about exploring ${explored[1]}`);
  }

  return secondPerson;
}

function reflectOutcome(value: string): string {
  const secondPerson = ensureSentence(useSecondPerson(value));
  const withoutPeriod = secondPerson.replace(/[.]$/, "");
  const awareness = /^Your writing (?:highlighted|showed|revealed) that you (?:are|were) aware of (.+)$/i.exec(
    withoutPeriod,
  );
  if (awareness?.[1]) {
    return ensureSentence(`You noticed ${awareness[1]}`);
  }

  const highlighted = /^Your writing (?:highlighted|showed|revealed) that (.+)$/i.exec(
    withoutPeriod,
  );
  if (highlighted?.[1]) {
    return ensureSentence(highlighted[1]);
  }

  return secondPerson;
}

export function formatTopicSummary(summary: string): string {
  const normalized = normalizeWhitespace(summary);
  if (!normalized) {
    return normalized;
  }

  const intent = /(?:^|\s)(?:User wanted|User intent|Intent):\s*(.*?)(?=\s+(?:Outcome|Open):|$)/i.exec(
    normalized,
  )?.[1];
  const outcome = /(?:^|\s)Outcome:\s*(.*?)(?=\s+Open:|$)/i.exec(normalized)?.[1];

  if (!intent && !outcome) {
    return ensureSentence(useSecondPerson(normalized));
  }

  return [intent ? writeAbout(intent) : "", outcome ? reflectOutcome(outcome) : ""]
    .filter(Boolean)
    .join(" ");
}
