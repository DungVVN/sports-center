import { apiClient } from "./client.js";

export function readListPage(path, query = {}) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== null && item !== "") params.append(name, String(item));
    }
  }
  return apiClient.get(`${path}?${params}`, { includeMeta: true });
}

// Existing selection forms need all choices. Fetch bounded pages; tables use
// readListPage directly so search, sorting and pagination stay on the server.
export async function readListChoices(path, query = {}) {
  const items = [];
  for (let page = 1; ; page += 1) {
    const result = await readListPage(path, { ...query, page, pageSize: 100 });
    if (result.meta.page < page) return items;
    items.push(...result.items);
    if (page * result.meta.pageSize >= result.meta.total) return items;
  }
}
