import { expect, test } from "@playwright/test";
import { EXPEDITIONS } from "../src/lib/expeditions";

test.use({ reducedMotion: "reduce" });

const iguazu = EXPEDITIONS.find(({ id }) => id === "iguazu")!;

test("opens local weather and follows a Safari encounter without losing the route", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date("2026-11-12T15:00:00Z"));
  await page.route(/api\.open-meteo\.com\/v1\/forecast/, (route) =>
    route.fulfill({
      json: {
        timezone: "America/Argentina/Cordoba",
        current: {
          time: "2026-11-12T12:00",
          is_day: 1,
          temperature_2m: 24,
          wind_speed_10m: 4,
          weather_code: 61,
        },
      },
    }),
  );
  await page.route(/pokeapi\.co\/api\/v2\/pokemon\/\d+\/$/, async (route) => {
    const id = Number(
      new URL(route.request().url()).pathname.split("/").filter(Boolean).at(-1),
    );
    const encounter = iguazu.encounters.find(
      ({ pokemonId }) => pokemonId === id,
    );
    if (!encounter) return route.fallback();
    return route.fulfill({
      json: {
        id,
        name: encounter.name.toLowerCase(),
        height: 10,
        weight: 300,
        types: encounter.types.map((name) => ({ type: { name } })),
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
    });
  });

  await page.goto("/?region=iguazu");
  const climate = page.getByRole("button", { name: "Ver clima local" });
  await expect(climate).toContainText("Lluvia");
  await climate.click();
  const weather = page.getByRole("dialog", {
    name: "Clima local en Selva de Iguazú",
  });
  await expect(
    weather.getByText(/qué Pokémon podés encontrar durante el Safari/),
  ).toBeVisible();
  await weather.getByRole("button", { name: "Cerrar clima" }).click();
  await expect(climate).toBeFocused();

  await page.getByRole("button", { name: "Safari", exact: true }).click();
  const walk = page.getByRole("main", { name: "Safari en primera persona" });
  await expect(walk).toBeVisible();
  await expect(page).toHaveURL(/region=iguazu&view=safari$/);
  await expect(walk.getByText(/^Avistamiento 1 de /)).toBeVisible();
  await walk.getByRole("button", { name: "Avanzar", exact: true }).click();
  await expect(walk.getByText(/^Avistamiento 2 de /)).toBeVisible();
  const encounter = walk.getByRole("button", { name: /^Ver ficha de / });
  await expect(encounter).toBeVisible();
  await encounter.click();

  const detail = page.getByRole("dialog", { name: /^Ficha de / });
  await expect(detail.getByText("Estadísticas base")).toBeVisible();
  await expect(page).toHaveURL(/region=iguazu&view=safari&encounter=iguazu-/);
  await detail.getByRole("button", { name: "Volver a explorar" }).click();
  await expect(page).toHaveURL(/region=iguazu&view=safari$/);
  await expect(walk).toBeVisible();
  await walk.getByRole("button", { name: "Ver radar en el mapa" }).click();
  await expect(page).toHaveURL(/region=iguazu&view=radar$/);
  await expect(
    page.getByRole("complementary", { name: "Radar Safari" }),
  ).toBeVisible();
});
