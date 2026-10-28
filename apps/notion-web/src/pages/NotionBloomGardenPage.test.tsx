import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listNotionPages: vi.fn(),
  listNotionConnections: vi.fn(),
  listNotionDocuments: vi.fn(),
  listActiveNotionImports: vi.fn(),
  importNotionPages: vi.fn(),
  getNotionImport: vi.fn(),
  getNotionIngestion: vi.fn(),
  retryNotionIngestion: vi.fn(),
  cancelNotionIngestion: vi.fn(),
  cancelNotionImport: vi.fn(),
  deleteNotionDocument: vi.fn(),
  exportNotionData: vi.fn(),
  startNotionOAuth: vi.fn(),
  disconnectNotionConnection: vi.fn(),
}));

vi.mock("../../../web/src/lib/api", () => api);

import { NotionBloomGardenPage } from "./NotionBloomGardenPage";

describe("Notion Bloom garden", () => {
  beforeEach(() => {
    window.localStorage.clear();
    api.listNotionConnections.mockResolvedValue({ connections: [], legacyInternalAvailable: true });
    api.listNotionPages.mockResolvedValue({ pages: [{ id: "page-1", title: "Ideas", url: "https://notion.so/1", createdAt: "2026-10-27T00:00:00.000Z", updatedAt: "2026-10-27T00:00:00.000Z", importedDocumentId: null }] });
    api.listNotionDocuments.mockResolvedValue({ documents: [] });
    api.listActiveNotionImports.mockResolvedValue({ jobs: [] });
    api.importNotionPages.mockResolvedValue({ job: { id: "10000000-0000-4000-8000-000000000001", status: "queued", connectionId: null, workspaceId: null, stage: "queued", totalPages: 1, completedPages: 0, currentPageId: null, currentPageTitle: null, results: [], lastError: null, createdAt: "2026-10-27T00:00:00.000Z", updatedAt: "2026-10-27T00:00:00.000Z", completedAt: null } });
  });

  it("queues selected pages and explains that background processing continues", async () => {
    render(<MemoryRouter><NotionBloomGardenPage /></MemoryRouter>);
    const checkbox = await screen.findByRole("checkbox");
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole("button", { name: "Import 1" }));
    await waitFor(() => expect(api.importNotionPages).toHaveBeenCalledWith(["page-1"], undefined));
    expect(screen.getByText("Import queued")).toBeInTheDocument();
    expect(screen.getByText(/close this page/i)).toBeInTheDocument();
  });

  it("scopes page discovery and imports to the selected OAuth workspace", async () => {
    api.listNotionConnections.mockResolvedValue({
      connections: [{ id: "20000000-0000-4000-8000-000000000001", workspaceId: "workspace-1", workspaceName: "Research", workspaceIcon: null, status: "connected", scopes: [], connectedAt: "2026-10-27T00:00:00.000Z", lastVerifiedAt: null, lastError: null, importedPages: 0 }],
      legacyInternalAvailable: false,
    });
    render(<MemoryRouter><NotionBloomGardenPage /></MemoryRouter>);
    const checkbox = await screen.findByRole("checkbox");
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole("button", { name: "Import 1" }));
    await waitFor(() => expect(api.listNotionPages).toHaveBeenCalledWith("20000000-0000-4000-8000-000000000001"));
    expect(api.importNotionPages).toHaveBeenCalledWith(["page-1"], "20000000-0000-4000-8000-000000000001");
  });
});
