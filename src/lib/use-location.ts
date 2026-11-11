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
  function navigate(
    region: string | null,
    encounter?: string,
    replace = false,
    view?: "field" | "world" | "safari",
  ) {
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    if (view) params.set("view", view);
    if (encounter) params.set("encounter", encounter);
    window.history[replace ? "replaceState" : "pushState"](
      null,
      "",
      params.size ? `?${params}` : window.location.pathname,
    );
    window.dispatchEvent(new Event("pokeradar-location"));
  }
  return { params: new URLSearchParams(search), navigate };
}
