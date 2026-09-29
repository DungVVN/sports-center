export function compareTableValues(left, right, direction = "asc") {
  const leftValue = left ?? "";
  const rightValue = right ?? "";
  const numericLeft = Number(leftValue);
  const numericRight = Number(rightValue);
  const comparison =
    Number.isFinite(numericLeft) && Number.isFinite(numericRight)
      ? numericLeft - numericRight
      : String(leftValue).localeCompare(String(rightValue), "vi", { numeric: true });
  return direction === "asc" ? comparison : -comparison;
}

export function sortTable(items, key, direction, valueFor) {
  return [...items].sort((left, right) =>
    compareTableValues(valueFor(left, key), valueFor(right, key), direction),
  );
}
