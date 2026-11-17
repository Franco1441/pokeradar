import { expect, test, type Page } from "@playwright/test";
import type { ResearchProgress } from "../src/lib/types";

test.use({ reducedMotion: "reduce" });

const WEATHER_URL = /https:\/\/api\.open-meteo\.com\/v1\/forecast/;
const NOW = new Date("2026-11-12T15:00:00Z");
const ATLAS: ResearchProgress = {
  version: 1,
  records: [
    {
      expeditionId: "iguazu",
      encounterId: "iguazu-aipom",
      pokemonId: 190,
      registeredAt: "2026-11-12T14:30:00.000Z",
    },
    {
      expeditionId: "iguazu",
      encounterId: "iguazu-lotad",
      pokemonId: 270,
      registeredAt: "2026-11-12T14:31:00.000Z",
    },
  ],
  team: [],
};

async function mockWeather(page: Page, { iguazuUnavailable = false } = {}) {
  await page.route(WEATHER_URL, (route) => {
    const forecast = new URL(route.request().url());
    const latitude = Number(forecast.searchParams.get("latitude"));
    const isIguazu = latitude >= -26 && latitude <= -25;
    if (isIguazu && iguazuUnavailable) return route.fulfill({ status: 503 });

    return route.fulfill({
      json: {
        timezone: isIguazu ? "America/Argentina/Cordoba" : "UTC",
        current: {
          temperature_2m: isIguazu ? 27 : 12,
          weather_code: isIguazu ? 61 : 0,
          wind_speed_10m: 5,
          is_day: Number(isIguazu),
          time: "2026-11-12T12:00",
        },
      },
    });
  });
}

test("compares atlas coverage and field signals, then opens the selected destination", async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.addInitScript((progress) => {
    localStorage.setItem("pokeradar.research.v1", JSON.stringify(progress));
  }, ATLAS);
  await mockWeather(page);

  await page.goto("/?region=nikko&view=world");
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await nav.getByRole("button", { name: "Análisis", exact: true }).click();
  await expect(page).toHaveURL(/\?region=nikko&view=analysis$/);
  await expect(nav.getByRole("button", { name: "Análisis", exact: true })).toHaveAttribute("aria-current", "page");
  const dashboard = page.getByRole("main", { name: "Análisis de expediciones" });
  await expect(dashboard.getByRole("heading", { name: "Análisis de expediciones" })).toBeVisible();

  const comparison = dashboard.getByRole("region", { name: "Comparar destinos" });
  const nikko = comparison.getByRole("button", { name: /Bosques de Nikkō/ });
  const iguazu = comparison.getByRole("button", { name: /Selva de Iguazú/ });
  await expect(iguazu).toHaveAccessibleName("Selva de Iguazú, 2 de 27 especies registradas, 7%");
  await expect(nikko).toHaveAttribute("aria-pressed", "true");
  await iguazu.click();
  await expect(iguazu).toHaveAttribute("aria-pressed", "true");
  await expect(nikko).toHaveAttribute("aria-pressed", "false");
  const detail = dashboard.getByRole("region", { name: "Selva de Iguazú" });
  await expect(detail.getByText(/27 °C · Lluvia/)).toBeVisible();
  await expect(detail.getByText(/Clima en vivo/)).toBeVisible();

  const coverage = dashboard.getByRole("button", { name: "Cobertura del atlas", exact: true });
  const signals = dashboard.getByRole("button", { name: "Señales sin registrar", exact: true });
  await coverage.click();
  await expect(coverage).toHaveAttribute("aria-pressed", "true");
  await signals.click();
  await expect(signals).toHaveAttribute("aria-pressed", "true");
  await expect(coverage).toHaveAttribute("aria-pressed", "false");
  await expect(iguazu).toHaveAttribute("aria-pressed", "true");
  await expect(iguazu).toHaveAccessibleName(/\d+ señales sin registrar de \d+ activas/);

  await detail.getByRole("button", { name: "Ver en el mapa" }).click();
  await expect(page).toHaveURL(/\?region=iguazu&view=world$/);
  await expect(page.getByRole("heading", { name: "Selva de Iguazú" })).toBeVisible();
});

test("opens a saved analysis view on mobile when a destination's weather is unavailable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(NOW);
  await mockWeather(page, { iguazuUnavailable: true });
  const failedForecast = page.waitForResponse((response) =>
    WEATHER_URL.test(response.url()) && response.status() === 503,
  );

  await page.goto("/?region=iguazu&view=analysis");
  const dashboard = page.getByRole("main", { name: "Análisis de expediciones" });
  await expect(dashboard.getByRole("heading", { name: "Análisis de expediciones" })).toBeVisible();
  await expect(dashboard.getByRole("button", { name: /Selva de Iguazú/ })).toHaveAttribute("aria-pressed", "true");
  await failedForecast;
  await expect(dashboard.getByRole("button", { name: "Tipos activos", exact: true })).toHaveAttribute("aria-pressed", "true");
  await dashboard.getByRole("link", { name: "Ver detalle" }).click();
  await expect(page).toHaveURL(/#analysis-selected-destination$/);
  const detail = dashboard.getByRole("region", { name: "Selva de Iguazú" });
  await expect(detail.getByText(/Hora local estimada.*12:00.*Día/)).toBeVisible();
  const signals = dashboard.getByRole("button", { name: "Señales sin registrar", exact: true });
  await signals.click();
  await expect(signals).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth &&
    Array.from(document.querySelectorAll("main, main section")).every((element) =>
      element.scrollWidth <= element.clientWidth,
    ),
  )).toBe(true);

  await dashboard.getByRole("button", { name: "Ver en el mapa" }).click();
  await expect(page).toHaveURL(/\?region=iguazu&view=world$/);
});
