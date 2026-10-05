export interface NotionPageSummary {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotionDocument extends NotionPageSummary {
  content: string;
  sections: NotionDocumentSection[];
}

export interface NotionDocumentSection {
  id: string;
  title?: string;
  content: string;
  blockIds: string[];
  order: number;
}

export interface NotionRichText {
  plain_text?: string;
  href?: string | null;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    code?: boolean;
  };
}

export interface NotionBlockLike {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
}
