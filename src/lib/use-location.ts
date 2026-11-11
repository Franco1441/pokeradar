"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener("pokeradar-location", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("pokeradar-location", callback);
  };
}

export function useLocation() {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
  function navigate(region: string, encounter?: string, replace = false) {
    const params = new URLSearchParams({ region });
    if (encounter) params.set("encounter", encounter);
    window.history[replace ? "replaceState" : "pushState"](
      null,
      "",
      `?${params}`,
    );
    window.dispatchEvent(new Event("pokeradar-location"));
  }
  return { params: new URLSearchParams(search), navigate };
}
