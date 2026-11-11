import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("discovers a Pokémon on foot and keeps it in the atlas", async ({
  page,
}) => {
  await page.route("https://pokeapi.co/api/v2/pokemon/1/", (route) =>
    route.fulfill({
      json: {
        id: 1,
        name: "bulbasaur",
        height: 7,
        weight: 69,
        types: [{ type: { name: "grass" } }, { type: { name: "poison" } }],
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
  await page.route("https://pokeapi.co/api/v2/pokemon-species/1/", (route) =>
    route.fulfill({
      json: {
        flavor_text_entries: [
          {
            flavor_text: "La semilla de su lomo crece con él.",
            language: { name: "es" },
          },
        ],
      },
    }),
  );

  await page.goto("/");
  const directory = page.getByRole("region", {
    name: "El mundo por explorar.",
  });
  await directory.getByRole("button", { name: /Bosques de Nikkō/ }).click();
  await expect(page).toHaveURL(/[?&]region=nikko/);

  const expedition = page.getByRole("complementary", {
    name: "Expedición y avistamientos",
  });
  await expedition.getByRole("button", { name: /Explorar a pie/ }).click();
  const field = page.getByRole("main", {
    name: "Exploración en primera persona",
  });
  await expect(field).toBeVisible();
  await field
    .getByRole("button", {
      name: "Examinar: Movimiento entre los helechos",
      exact: true,
    })
    .click();
  const discovery = field.getByRole("region", {
    name: "Avistamiento de Bulbasaur",
  });
  await expect(
    discovery.getByRole("heading", { name: "Bulbasaur" }),
  ).toBeVisible();
  await discovery.getByRole("button", { name: "Abrir ficha" }).click();

  const detail = page.getByRole("dialog", { name: "Ficha de Bulbasaur" });
  await expect(detail.getByText("Estadísticas base")).toBeVisible();
  await detail.getByRole("button", { name: "Registrar avistamiento" }).click();
  await expect(
    detail.getByRole("button", { name: /Añadir a mi equipo/ }),
  ).toBeVisible();

  await detail.getByRole("button", { name: "Volver a explorar" }).click();
  await expect(detail).toBeHidden();
  await expect(field.getByText("1 de 3 registrados")).toBeVisible();
  await field.getByRole("button", { name: "Volver al mapa" }).click();
  await expect(field).toBeHidden();
  await expect(page).toHaveURL(/\?region=nikko$/);

  await page.reload();
  await page.getByRole("button", { name: "Mi atlas" }).click();
  await page.getByRole("checkbox", { name: "Registrados" }).check();
  await expect(
    page.getByRole("button", { name: /Bulbasaur.*Registrado/ }),
  ).toBeVisible();
});
