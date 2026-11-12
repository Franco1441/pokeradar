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
  await directory
    .getByRole("button", { name: /^Ver (mapa|avistamientos)$/ })
    .click();
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
  const nextClue = field.getByRole("button", {
    name: "Buscar la siguiente pista",
  });
  await expect(nextClue).toBeFocused();
  await nextClue.press("Enter");
  await expect(
    field.getByRole("button", {
      name: "Examinar pista enfocada: Hojas que se mueven",
    }),
  ).toBeFocused();
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

for (const destination of [
  {
    id: "nikko",
    title: "Bosques de Nikkō",
    species: ["Bulbasaur", "Caterpie", "Hoothoot"],
  },
  {
    id: "reykjanes",
    title: "Tierras de fuego",
    species: ["Charmander", "Geodude", "Vulpix"],
  },
  {
    id: "namib",
    title: "Dunas del Namib",
    species: ["Sandshrew", "Cacnea", "Sandile"],
  },
  {
    id: "zermatt",
    title: "Cumbres de Zermatt",
    species: ["Sneasel", "Swinub", "Delibird"],
  },
  {
    id: "heron",
    title: "Arrecife de Heron",
    species: ["Squirtle", "Corsola", "Horsea"],
  },
  {
    id: "iguazu",
    title: "Selva de Iguazú",
    species: ["Aipom", "Lotad", "Tropius"],
  },
  {
    id: "everglades",
    title: "Humedales de Everglades",
    species: ["Totodile", "Croagunk", "Ducklett"],
  },
]) {
  test(`opens the panorama and all three sightings in ${destination.title}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page
      .getByRole("region", { name: "El mundo por explorar." })
      .getByRole("button", { name: new RegExp(destination.title) })
      .click();
    await page
      .getByRole("button", { name: /^Ver (mapa|avistamientos)$/ })
      .click();
    const expedition = page.getByRole("complementary", {
      name: "Expedición y avistamientos",
    });
    await expedition
      .getByRole("button", { name: /Explorar a pie|Explorar bajo el agua/ })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`[?&]region=${destination.id}&view=field`),
    );
    const field = page.getByRole("main", {
      name: "Exploración en primera persona",
    });
    const panorama = field.locator(".field-backdrop");
    await expect(panorama).toHaveAttribute(
      "src",
      `/expeditions/${destination.id}-field.webp`,
    );
    await expect
      .poll(() =>
        panorama.evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);

    for (const [index, name] of destination.species.entries()) {
      if (index > 0)
        await field.getByRole("button", { name: "Mirar a la derecha" }).click();
      await field
        .getByRole("button", { name: /Examinar pista enfocada/ })
        .click();
      await expect(
        field.getByRole("heading", { name, exact: true }),
      ).toBeVisible();
    }

    await field.getByRole("button", { name: "Volver al mapa" }).click();
    await expect(
      expedition.getByRole("heading", { name: destination.title, exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`\\?region=${destination.id}$`));
  });
}

test("lands from the globe with a continuous transition and returns to the correct map", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const directory = page.getByRole("region", {
    name: "El mundo por explorar.",
  });
  await directory
    .getByRole("button", { name: "Enfocar Arrecife de Heron, Australia" })
    .click();
  await directory
    .getByRole("button", { name: "Explorar bajo el agua" })
    .click();
  await expect(page.locator(".landing-overlay")).toHaveAttribute(
    "data-phase",
    "approach",
  );
  const field = page.getByRole("main", {
    name: "Exploración en primera persona",
  });
  await expect(
    field.getByRole("heading", { name: "Jardín de coral" }),
  ).toBeVisible();
  await expect(page.locator(".landing-overlay")).toHaveCount(0);
  await field.getByRole("button", { name: /Examinar pista enfocada/ }).click();
  await expect(field.getByRole("heading", { name: "Squirtle" })).toBeVisible();
  await expect(field.locator(".field-backdrop")).toBeVisible();
  await field.getByRole("button", { name: "Volver al mapa" }).click();
  await expect(page).toHaveURL(/\?region=heron$/);
  await expect(
    page.getByRole("heading", { name: "Arrecife de Heron", exact: true }),
  ).toBeVisible();
});
