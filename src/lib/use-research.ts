"use client";

import { useSyncExternalStore, useState } from "react";
import { EMPTY_PROGRESS, parseProgress } from "./research";
import type { ResearchProgress } from "./types";

const STORAGE_KEY = "pokeradar.research.v1";
const CHANGE_EVENT = "pokeradar-research";
let cachedRaw: string | null | undefined;
let cachedProgress: ResearchProgress = EMPTY_PROGRESS;
let memoryOnly = false;

function snapshot() {
  if (memoryOnly) return cachedProgress;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedProgress = parseProgress(raw);
    }
  } catch {
    memoryOnly = true;
  }
  return cachedProgress;
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

export function useResearch() {
  const progress = useSyncExternalStore(
    subscribe,
    snapshot,
    () => EMPTY_PROGRESS,
  );
  const [storageError, setStorageError] = useState(false);
  function update(transform: (value: ResearchProgress) => ResearchProgress) {
    const next = transform(snapshot());
    cachedProgress = next;
    cachedRaw = JSON.stringify(next);
    try {
      localStorage.setItem(STORAGE_KEY, cachedRaw);
    } catch {
      memoryOnly = true;
      setStorageError(true);
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return next;
  }
  return { progress, update, storageError };
}
