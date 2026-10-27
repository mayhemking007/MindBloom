import type { ImportNotionPageResult, NotionImportJob } from "@mindbloom/shared";

import { ApiError } from "../http/errors.js";
import type { OwnerScope } from "./entries.service.js";
import {
  cancelImportJob,
  claimNextImportJob,
  createImportJob,
  findImportJob,
  isImportJobCancelled,
  listActiveImportJobs,
  updateImportJobProgress,
  finishImportJob,
  type ImportJobOwner,
} from "../repositories/notionImportJobs.repository.js";
import type { NotionImportJobRow } from "../db/schema.js";
import { importNotionPages } from "./notion.service.js";

function authenticatedOwner(owner: OwnerScope): ImportJobOwner {
  if (owner.ownerKind !== "authenticated") throw new ApiError(401, "Authentication is required");
  return { ownerId: owner.ownerId, ownerKind: "authenticated" };
}

function toJob(row: NotionImportJobRow): NotionImportJob {
  return {
    id: row.id,
    status: row.status,
    stage: row.stage,
    totalPages: row.total_pages,
    completedPages: row.completed_pages,
    currentPageId: row.current_page_id,
    currentPageTitle: row.current_page_title,
    results: row.results as ImportNotionPageResult[],
    lastError: row.last_error,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
  };
}

export async function enqueueNotionImport(pageIds: string[], owner: OwnerScope): Promise<NotionImportJob> {
  const uniquePageIds = [...new Set(pageIds)];
  return toJob(await createImportJob(uniquePageIds, authenticatedOwner(owner)));
}

export async function getNotionImportJob(id: string, owner: OwnerScope): Promise<NotionImportJob> {
  const row = await findImportJob(id, authenticatedOwner(owner));
  if (!row) throw new ApiError(404, "Import job not found");
  return toJob(row);
}

export async function getActiveNotionImportJobs(owner: OwnerScope): Promise<NotionImportJob[]> {
  return (await listActiveImportJobs(authenticatedOwner(owner))).map(toJob);
}

export async function cancelNotionImportJob(id: string, owner: OwnerScope): Promise<NotionImportJob> {
  const row = await cancelImportJob(id, authenticatedOwner(owner));
  if (!row) throw new ApiError(404, "Import job not found");
  return toJob(row);
}

export async function processNextNotionImportJob(): Promise<boolean> {
  const job = await claimNextImportJob();
  if (!job) return false;

  const owner: OwnerScope = { ownerId: job.owner_id, ownerKind: "authenticated" };
  const results = [...(job.results as ImportNotionPageResult[])];
  let completed = job.completed_pages;

  try {
    for (let index = completed; index < job.page_ids.length; index += 1) {
      if (await isImportJobCancelled(job.id)) return true;
      const pageId = job.page_ids[index]!;
      await updateImportJobProgress(job.id, {
        completedPages: completed,
        currentPageId: pageId,
        currentPageTitle: null,
        stage: "reading_notion",
        results,
      });

      const [result] = await importNotionPages([pageId], owner, async (page) => {
        await updateImportJobProgress(job.id, {
          completedPages: completed,
          currentPageId: pageId,
          currentPageTitle: page.title,
          stage: "building_memory",
          results,
        });
      });
      if (result) results.push(result);
      completed += 1;
      await updateImportJobProgress(job.id, {
        completedPages: completed,
        currentPageId: index + 1 < job.page_ids.length ? job.page_ids[index + 1]! : null,
        currentPageTitle: result?.document?.title ?? null,
        stage: index + 1 < job.page_ids.length ? "reading_notion" : "finished",
        results,
      });
    }

    const hasErrors = results.some((result) => result.status === "failed");
    await finishImportJob(job.id, hasErrors ? "completed_with_errors" : "completed", results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import worker failed";
    await finishImportJob(job.id, "failed", results, message);
  }
  return true;
}
