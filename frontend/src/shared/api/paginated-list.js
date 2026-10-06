import { apiClient } from "./client.js";
import { ApiError } from "./api-error.js";

export function readListPage(path, query = {}, options = {}) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== null && item !== "") params.append(name, String(item));
    }
  }
  return apiClient.get(`${path}?${params}`, { ...options, includeMeta: true });
}

// Existing selection forms need all choices. Fetch bounded pages; tables use
// readListPage directly so search, sorting and pagination stay on the server.
export async function readListChoices(path, query = {}, options = {}) {
  const items = [];
  const seenIds = new Set();
  let totalPages = 1;
  let pageSize;
  for (let page = 1; page <= totalPages; page += 1) {
    const result = await readListPage(path, { ...query, page, pageSize: 100 }, options);
    const meta = result?.meta;
    if (!Array.isArray(result?.items) || !Number.isSafeInteger(meta?.total) || meta.total < 0
      || !Number.isSafeInteger(meta?.pageSize) || meta.pageSize < 1 || meta.pageSize > 100
      || !Number.isSafeInteger(meta?.page) || meta.page < 1 || meta.page > page
      || (pageSize !== undefined && meta.pageSize !== pageSize)) {
      throw new ApiError({ code: "INVALID_PAGINATION", message: "Không thể tải đầy đủ danh sách. Vui lòng tải lại và thử tiếp." });
    }
    if (page === 1) {
      pageSize = meta.pageSize;
      // Bound this read to the first total so continuous inserts cannot extend it forever.
      totalPages = Math.max(1, Math.ceil(meta.total / pageSize));
    }
    if (result.meta.page < page) return items;
    if (!result.items.length) return items;
    for (const item of result.items) {
      if (item.id != null && seenIds.has(item.id)) continue;
      if (item.id != null) seenIds.add(item.id);
      items.push(item);
    }
    if (page * pageSize >= meta.total) return items;
  }
  return items;
}
