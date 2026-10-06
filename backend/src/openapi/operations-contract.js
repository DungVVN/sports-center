export function applyOperationsContract(spec) {
  spec.paths["/ready"] = { get: {
    tags: ["System"], summary: "Readiness: kiểm tra database, tối đa 5 giây", security: [],
    responses: { 200: { description: "API và database sẵn sàng" }, 503: { description: "Database không sẵn sàng hoặc quá thời gian kiểm tra" } },
  } };
  const common = [
    { name: "page", in: "query", schema: { type: "integer", minimum: 1, maximum: 100000, default: 1 } },
    { name: "pageSize", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 10 } },
    { name: "search", in: "query", schema: { type: "string", maxLength: 120 }, description: "Tìm chuỗi không phân biệt hoa thường trên toàn bộ tập dữ liệu được phép xem." },
  ];
  const arrays = (names) => names.map((name) => ({ name, in: "query", style: "form", explode: true, schema: { type: "array", maxItems: 30, items: { type: "string" } }, description: "Có thể lặp query key để chọn nhiều giá trị." }));
  for (const path of ["/members", "/payments", "/members/me/payments"]) {
    const operation = spec.paths[path].get;
    operation.parameters = [...common];
    const facets = path === "/members" ? ["coach", "package", "status"] : ["package"];
    if (path === "/members") operation.parameters.push(...arrays(facets));
    if (path === "/payments") operation.parameters.push(
      { name: "memberId", in: "query", schema: { type: "string", format: "uuid" } }, ...arrays(["status", "method", "package"]),
      { name: "sort", in: "query", schema: { type: "string", enum: ["amountVnd", "transaction_code", "updated_at"], default: "amountVnd" } },
      { name: "direction", in: "query", schema: { type: "string", enum: ["asc", "desc"], default: "desc" } },
    );
    operation.responses[200] = { description: "Một trang kết quả. data luôn là array; meta chứa tổng bản ghi, trang và bộ lọc. Không đọc toàn bộ danh sách trong một request.", content: { "application/json": { schema: {
      type: "object", required: ["success", "data", "meta"], properties: {
        success: { type: "boolean", const: true }, data: { type: "array", items: { type: "object" } },
        meta: { type: "object", required: ["total", "page", "pageSize", "facets"], properties: {
          total: { type: "integer", minimum: 0 }, page: { type: "integer", minimum: 1 }, pageSize: { type: "integer", minimum: 1, maximum: 100 },
          facets: { type: "object", properties: Object.fromEntries(facets.map((name) => [name, { type: "array", items: { type: "string" } }])) },
        } },
      },
    } } } };
    operation.responses[422] = { description: "Query không hợp lệ, vượt giới hạn pageSize hoặc bộ lọc không được phép." };
  }
}
