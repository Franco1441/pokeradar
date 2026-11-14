import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("reveals the globe after the Earth textures are ready", async ({ page }) => {
  let releaseTextures = () => {};
  const textureGate = new Promise<void>((resolve) => {
    releaseTextures = resolve;
  });
  await page.route(/\/map\/earth-(day|night)\.webp$/, async (route) => {
    await textureGate;
    await route.continue();
  });

  const loader = page.locator('.map-loading[data-fullscreen="true"]');
  const app = page.locator(".expedition-app");
  const startedAt = Date.now();
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".maplibregl-canvas")).toBeAttached();
    await expect(loader.getByRole("status")).toHaveText("Preparando la expedición…");
    expect(await loader.boundingBox()).toEqual({
      x: 0, y: 0, ...page.viewportSize(),
    });
    await expect(app).toHaveAttribute("inert", "");
  } finally {
    releaseTextures();
  }
  await expect(page.locator(".maplibregl-ctrl-attrib-inner")).toContainText("NASA Earth Observatory");
  await expect(loader).toHaveAttribute("data-active", "false");
  await expect(app).not.toHaveAttribute("inert", "");
  expect(Date.now() - startedAt).toBeGreaterThanOrEqual(2_000);
  await expect(page.getByRole("button", { name: "Ver mapa", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver día y noche", exact: true })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Navegación principal" }).getByRole("button", { name: "Safari" })).toHaveCount(0);
  const modes = page.locator(".world-preview-actions");
  await expect(modes.getByRole("button", { name: "Explorar a pie" })).toBeVisible();
  await modes.getByRole("button", { name: "Safari", exact: true }).click();
  await expect(page).toHaveURL(/view=safari$/);
});

test("keeps regional and globe zoom limits in their own views", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 840 });
  await page.goto("/?region=everglades");

  const surface = page.locator(".map-surface");
  const zoomOut = page.getByRole("button", { name: "Alejar mapa" });
  await expect(zoomOut).toBeEnabled();
  for (let step = 0; step < 5 && (await zoomOut.isEnabled()); step++) {
    await zoomOut.click();
  }
  await expect(zoomOut).toBeDisabled();
  await expect(surface).not.toHaveClass(/\bhas-space\b/);
  await expect(page).toHaveURL(/\?region=everglades$/);

  await page.getByRole("button", { name: "Ver todas las expediciones" }).click();
  await expect(surface).toHaveClass(/\bhas-space\b/);
  for (let step = 0; step < 4 && (await zoomOut.isEnabled()); step++) {
    await zoomOut.click();
  }
  await expect(zoomOut).toBeDisabled();
  await expect(surface).toHaveClass(/\bhas-space\b/);
  await expect(page).toHaveURL(/\?region=everglades&view=world$/);
});

test("keeps the selected destination, weather, and Pokémon detail in one globe panel", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date("2026-11-12T15:00:00Z"));
  await page.route("https://api.open-meteo.com/v1/forecast?*", (route) => {
    const latitude = Number(
      new URL(route.request().url()).searchParams.get("latitude"),
    );
    const isIguazu = latitude < 0;
    return route.fulfill({
      json: {
        timezone: isIguazu ? "America/Argentina/Cordoba" : "Asia/Tokyo",
        current: {
          temperature_2m: isIguazu ? 27 : 12,
          weather_code: isIguazu ? 61 : 0,
          wind_speed_10m: 5,
          is_day: Number(isIguazu),
          time: isIguazu ? "2026-11-12T12:00" : "2026-11-13T00:00",
        },
      },
    });
  });
  await page.route("https://pokeapi.co/api/v2/pokemon/190/", (route) =>
    route.fulfill({
      json: {
        id: 190,
        name: "aipom",
        height: 8,
        weight: 115,
        types: [{ type: { name: "normal" } }],
        sprites: { front_default: null },
        stats: [
          "hp",
          "attack",
          "defense",
          "special-attack",
          "special-defense",
          "speed",
        ].map((name) => ({ base_stat: 55, stat: { name } })),
      },
    }),
  );

  await page.goto("/?region=nikko&view=world");
  const panel = page.locator("#expedition-panel");
  const details = panel.getByRole("button", { name: "Ver detalles del destino" });
  await expect(details).toHaveAttribute("aria-expanded", "false");
  await expect(panel.getByText(/12 °C/)).toBeHidden();
  await details.click();
  await expect(panel.getByText(/12 °C/)).toBeVisible();
  await panel
    .getByRole("button", { name: "Enfocar Selva de Iguazú, Argentina" })
    .click();
  await expect(page).toHaveURL(/\?region=iguazu&view=world$/);
  await expect(panel.getByText(/27 °C · Lluvia/)).toBeVisible();
  await expect(panel.getByText("12:00", { exact: true })).toBeVisible();

  const preview = panel.getByRole("button", { name: "Ver ficha de Aipom" });
  await preview.click();
  await expect(page).toHaveURL(
    /\?region=iguazu&view=world&encounter=iguazu-aipom$/,
  );
  const detail = panel.getByRole("region", { name: "Ficha de Aipom" });
  await expect(detail).toBeFocused();
  await expect(detail.getByText("Estadísticas base")).toBeVisible();
  await expect(detail.getByText(/27° · Lluvia/)).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Ficha de Aipom" }),
  ).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(/\?region=iguazu&view=world$/);
  await expect(preview).toBeFocused();
  await preview.click();
  await detail.getByRole("button", { name: "Volver al destino" }).click();
  await expect(preview).toBeFocused();
  await expect(panel.getByText(/27 °C · Lluvia/)).toBeVisible();

  await page.goto("/?region=iguazu&view=world&encounter=iguazu-aipom");
  await detail.getByRole("button", { name: "Volver al destino" }).click();
  await expect(panel.getByRole("button", { name: "Ver detalles del destino" })).toBeFocused();
});
