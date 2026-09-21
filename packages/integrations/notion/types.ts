export interface NotionPageSummary {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotionDocument extends NotionPageSummary {
  content: string;
}

export interface NotionRichText {
  plain_text?: string;
  href?: string | null;
}

export interface NotionBlockLike {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
}
