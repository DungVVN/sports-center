export function serverPageData(path) {
  if (typeof document === "undefined") return null;
  try {
    const data = JSON.parse(document.getElementById("public-page-data")?.textContent || "null");
    return data?.path === path ? data : null;
  } catch {
    return null;
  }
}
