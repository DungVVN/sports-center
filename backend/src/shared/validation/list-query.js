import { z } from "zod";

export const listPageQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(120).default(""),
});

export const listValues = (schema = z.string().trim().min(1).max(120)) => z.preprocess(
  (value) => value == null ? [] : typeof value === "string" ? [value] : value,
  z.array(schema).max(30),
);
