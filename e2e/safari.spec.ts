import { expect, test } from "@playwright/test";
import { EXPEDITIONS } from "../src/lib/expeditions";
import { getSafariSnapshot, SAFARI_RESPAWN_MS } from "../src/lib/safari";

test.use({ reducedMotion: "reduce" });

test("scans by local conditions and registers a nocturnal sighting", async ({
  page,
}) => {
  const iguazu = EXPEDITIONS.find(({ id }) => id === "iguazu")!;
  const base = Date.parse("2026-11-11T15:00:30Z");
  const now = Array.from({ length: 12 }, (_, index) => base + index * SAFARI_RESPAWN_MS).find((time) =>
    getSafariSnapshot(iguazu, { mode: "night", now: time }).signals.some(({ encounter }) => encounter.pokemonId === 167),
  )!;
  await page.clock.setFixedTime(new Date(now));
  await page.route(/api\.open-meteo\.com\/v1\/forecast/, (route) =>
    route.fulfill({
      json: {
        timezone: "America/Argentina/Cordoba",
        current: {
          time: "2026-11-11T12:00",
          is_day: 1,
          temperature_2m: 24,
          wind_speed_10m: 4,
          weather_code: 61,
        },
      },
    }),
  );
  await page.route("https://pokeapi.co/api/v2/pokemon/167/", (route) =>
    route.fulfill({
      json: {
        id: 167,
        name: "spinarak",
        height: 10,
        weight: 300,
        types: [{ type: { name: "bug" } }, { type: { name: "poison" } }],
        sprites: { front_default: null },
        stats: [
          "hp",
          "attack",
          "defense",
          "special-attack",
          "special-defense",
          "speed",
        ].map((name) => ({ base_stat: 45, stat: { name } })),
      },
    }),
  );
  await page.route("https://pokeapi.co/api/v2/pokemon-species/167/", (route) =>
    route.fulfill({ json: { flavor_text_entries: [] } }),
  );

  await page.goto("/?region=iguazu");
  await page.getByRole("button", { name: "Ver radar", exact: true }).click();
  const radar = page.getByRole("complementary", { name: "Radar Safari" });
  await expect(radar.getByText("Día local")).toBeVisible();
  await expect(radar.getByText("Lluvia", { exact: true })).toBeVisible();
  await expect.poll(() => radar.getByRole("listitem").count()).toBeGreaterThanOrEqual(6);

  await radar.getByRole("button", { name: "Día", exact: true }).click();
  await expect(radar.getByText("Día de prueba")).toBeVisible();
  const spinarak = radar.getByRole("button", { name: /Spinarak/ });
  await expect(spinarak).toHaveCount(0);

  await radar.getByRole("button", { name: "Noche", exact: true }).click();
  await expect(radar.getByText("Noche de prueba")).toBeVisible();
  await expect(spinarak).toContainText("clima favorable");
  await spinarak.click();
  await expect(page).toHaveURL(
    /region=iguazu&view=radar&encounter=iguazu-safari-167/,
  );
  const detail = page.getByRole("dialog", { name: "Ficha de Spinarak" });
  await expect(detail.getByText("Estadísticas base")).toBeVisible();
  await detail.getByRole("button", { name: "Registrar avistamiento" }).click();
  await detail.getByRole("button", { name: "Volver a explorar" }).click();
  await expect(
    radar.getByRole("button", { name: "Noche", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(spinarak.getByLabel("Registrado", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/region=iguazu&view=radar$/);

  await radar.getByRole("button", { name: /Cambiar destino/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Humedales de Everglades/ })
    .click();
  await expect(page).toHaveURL(/region=everglades&view=radar$/);
  await expect(
    radar.getByText("Humedal subtropical", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Mi atlas" }).click();
  await page.getByRole("checkbox", { name: "Registrados" }).check();
  await expect(
    page.getByRole("button", { name: /Spinarak.*Registrado/ }),
  ).toBeVisible();
});
