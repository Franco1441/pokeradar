import { expect, test } from "@playwright/test";
import { EXPEDITIONS } from "../src/lib/expeditions";
import { getSafariSnapshot } from "../src/lib/safari";

test.use({ reducedMotion: "reduce" });

const iguazu = EXPEDITIONS.find(({ id }) => id === "iguazu")!;
const daytime = Date.parse("2026-11-12T15:00:00Z");
const rainyDay = {
  temperature: 24,
  windSpeed: 4,
  code: 61,
  isDay: true,
  time: "2026-11-12T12:00",
  timezone: "America/Argentina/Cordoba",
};

test("tracks Safari signals in other zones and updates the radar after registering", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const snapshotAt = (now: number) => getSafariSnapshot(iguazu, { mode: "live", weather: rainyDay, now });
  const start = Array.from({ length: 65 }, (_, index) => daytime + index * 1_000).find((now) => {
    const [current] = snapshotAt(now).zones;
    if (current.signals.length !== 2 || current.nextRefreshAt === null) return false;
    const [after] = snapshotAt(current.nextRefreshAt).zones;
    return after.signals.length === 3 && after.signals.some(({ slot }) => slot >= 2);
  })!;
  await page.clock.setFixedTime(start);
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
  const radar = walk.getByRole("complementary", { name: "Radar de campo" });
  const mirador = radar.getByRole("button", { name: /^Mirador de las cataratas,/ });
  const claro = radar.getByRole("button", { name: /^Claro de los helechos,/ });
  await expect(mirador).toHaveAttribute("aria-pressed", "true");
  await expect(claro).toHaveAccessibleName(/[23] señales, [23] sin registrar/);
  await expect(radar.getByText(/[4-6] sin registrar en otras zonas/, { exact: true })).toBeVisible();
  await expect(walk.getByRole("button", { name: /^Ver ficha de / })).toHaveCount(2);

  await claro.click();
  await expect(claro).toHaveAttribute("aria-pressed", "true");
  await expect(walk.getByRole("heading", { name: "Claro de los helechos" })).toBeVisible();
  const arrivalAt = snapshotAt(start).zones[0].nextRefreshAt!;
  const arrived = snapshotAt(arrivalAt).zones[0].signals.find(({ slot }) => slot >= 2)!;
  await page.clock.setFixedTime(arrivalAt);
  await expect(mirador).toHaveAttribute("title", new RegExp(arrived.encounter.name));
  await expect(radar.getByRole("status")).toContainText(/nueva señal en Mirador de las cataratas/);
  await page.clock.setFixedTime(arrived.expiresAt!);
  await expect(mirador).not.toHaveAttribute("title", new RegExp(arrived.encounter.name));
  const nearby = walk.getByRole("button", { name: /^Ver ficha de / }).first();
  const nearbyName = (await nearby.getAttribute("aria-label"))!.replace("Ver ficha de ", "");
  const nearbyEncounter = iguazu.encounters.find(({ name }) => name === nearbyName)!;
  await nearby.click();

  const detail = page.getByRole("dialog", { name: /^Ficha de / });
  await expect(detail.getByText("Estadísticas base")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`region=iguazu&view=safari&encounter=${nearbyEncounter.id}`));
  await detail.getByRole("button", { name: "Registrar avistamiento" }).click();
  await detail.getByRole("button", { name: "Volver a explorar" }).click();
  await expect(page).toHaveURL(/region=iguazu&view=safari$/);
  await expect(walk).toBeVisible();
  await expect(claro).toHaveAccessibleName(/2 señales, 1 sin registrar|3 señales, 2 sin registrar/);
  await expect(claro).toHaveAttribute("aria-pressed", "true");
  await mirador.click();
  await expect(radar.getByText(/[3-5] sin registrar en otras zonas/, { exact: true })).toBeVisible();
  await walk.getByRole("button", { name: "Ver radar en el mapa" }).click();
  await expect(page).toHaveURL(/region=iguazu&view=radar$/);
  await expect(
    page.getByRole("complementary", { name: "Radar Safari" }),
  ).toBeVisible();
});
