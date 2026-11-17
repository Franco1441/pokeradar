import { test, expect } from "@playwright/test";

test("registers a Pokémon, preserves the team, and shares the encounter", async ({
  page,
}) => {
  await page.route("https://pokeapi.co/api/v2/pokemon/25/", (route) =>
    route.fulfill({
      json: {
        id: 25,
        name: "pikachu",
        height: 4,
        weight: 60,
        types: [{ type: { name: "electric" } }],
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
  await page.route("https://pokeapi.co/api/v2/pokemon-species/25/", (route) =>
    route.fulfill({
      json: {
        flavor_text_entries: [
          { flavor_text: "Un Pokémon eléctrico.", language: { name: "es" } },
        ],
      },
    }),
  );
  await page.goto("/?region=nikko");
  await page
    .getByRole("complementary", { name: "Expedición y avistamientos" })
    .getByRole("button", { name: /Pikachu/ })
    .click();
  const detail = page.getByRole("dialog", { name: "Ficha de Pikachu" });
  await expect(detail.getByText("Estadísticas base")).toBeVisible();
  await detail.getByRole("button", { name: "Registrar avistamiento" }).click();
  await detail.getByRole("button", { name: "Añadir a mi equipo" }).click();
  await expect(page).toHaveURL(/region=nikko&encounter=nikko-pikachu/);
  await page.reload();
  await expect(
    detail.getByRole("button", { name: "Quitar de mi equipo" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();
  await page.getByRole("button", { name: "Mi atlas" }).click();
  await page.getByRole("checkbox", { name: "Registrados" }).check();
  await expect(
    page.getByRole("button", { name: /Pikachu.*Registrado/ }),
  ).toBeVisible();
});

test("keeps the latest selection when a previous request is delayed", async ({
  page,
}) => {
  await page.route("https://pokeapi.co/api/v2/pokemon/1/", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.fulfill({ status: 503 }).catch(() => {});
  });
  await page.route("https://pokeapi.co/api/v2/pokemon/25/", (route) =>
    route.fulfill({ status: 503 }),
  );
  await page.goto("/?region=nikko");
  const list = page.getByRole("complementary", {
    name: "Expedición y avistamientos",
  });
  await list.getByRole("button", { name: /Bulbasaur/ }).click();
  await page
    .getByRole("dialog", { name: "Ficha de Bulbasaur" })
    .getByRole("button", { name: /Volver/ })
    .click();
  await list.getByRole("button", { name: /Pikachu/ }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Ficha de Pikachu" })
      .getByRole("button", { name: /Reintentar/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Ficha de Bulbasaur" }),
  ).toHaveCount(0);
});

test("opens regional sightings from the globe without WebGL", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type.startsWith("webgl") || type === "experimental-webgl")
        return null;
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const globe = page.getByRole("region", { name: "El mundo Pokémon te espera." });
  await expect(
    globe.getByRole("button", { name: "Ver avistamientos" }),
  ).toBeVisible();
  await globe
    .getByRole("button", { name: "Enfocar Selva de Iguazú, Argentina" })
    .click();
  await globe.getByRole("button", { name: "Ver avistamientos" }).click();

  await expect(page).toHaveURL(/\?region=iguazu$/);
  const expedition = page.getByRole("complementary", {
    name: "Expedición y avistamientos",
  });
  await expect(
    expedition.getByRole("heading", { name: "En esta expedición" }),
  ).toBeFocused();
  await expedition.getByRole("button", { name: /Aipom/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Ficha de Aipom" }),
  ).toBeVisible();
});
