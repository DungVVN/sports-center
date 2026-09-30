import { useState } from "react";
import { newMenuItem } from "./editor-model.js";

export function useMenuDraftState(detail, location) {
  const [draftState, setDraftState] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);

  const detailKey = detail ? `${location}:${detail.draft?.id ?? "none"}:${detail.draft?.edit_revision ?? 0}:${detail.published?.id ?? "none"}` : "";
  const items = draftState?.key === detailKey ? draftState.items : detail?.draft?.items ?? detail?.published?.items ?? [];
  const revision = draftState?.key === detailKey ? draftState.revision : detail?.draft?.edit_revision ?? 0;
  const dirty = draftState?.key === detailKey && draftState.dirty;

  function change(next) {
    setDraftState({ key: detailKey, items: next, revision, dirty: true });
  }

  function updateAt(index, patch) {
    change(items.map((item, position) => position === index ? { ...item, ...patch } : item));
  }

  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    change(next);
  }

  function addItem(kind = "link") {
    const item = newMenuItem(kind);
    change([...items, item]);
    setSelectedItemId(item.id);
  }

  function removeItem(index) {
    change(items.filter((_, position) => position !== index));
    setSelectedItemId(null);
  }

  function clearDraft() {
    setDraftState(null);
    setSelectedItemId(null);
  }

  return {
    items,
    revision,
    dirty,
    selectedItemId,
    setSelectedItemId,
    change,
    updateAt,
    move,
    addItem,
    removeItem,
    clearDraft
  };
}
