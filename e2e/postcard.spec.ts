import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("earns a postcard once and reopens it from the atlas after reload", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-12T15:00:00Z"));
  await page.addInitScript(() => {
    if (localStorage.getItem("pokeradar.research.v1")) return;
    localStorage.setItem(
      "pokeradar.research.v1",
      JSON.stringify({
        version: 1,
        team: [],
        records: [
          {
            encounterId: "nikko-bulbasaur",
            pokemonId: 1,
            expeditionId: "nikko",
            registeredAt: "2026-11-11T15:00:00Z",
          },
          {
            encounterId: "nikko-caterpie",
            pokemonId: 10,
            expeditionId: "nikko",
            registeredAt: "2026-11-11T15:01:00Z",
          },
        ],
      }),
    );
  });
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
        ].map((name) => ({ base_stat: 35, stat: { name } })),
      },
    }),
  );

  await page.goto("/?region=nikko&encounter=nikko-pikachu");
  const detail = page.getByRole("dialog", { name: "Ficha de Pikachu" });
  await detail.getByRole("button", { name: "Registrar avistamiento" }).click();
  const postcard = page.getByRole("dialog", { name: /Postal/ });
  await expect(postcard).toBeVisible();
  await expect(
    postcard.locator(".postcard-finding").getByText("Pikachu", { exact: true }),
  ).toBeVisible();
  await postcard.press("Escape");
  await expect(postcard).toBeHidden();
  await expect(
    detail.getByRole("button", { name: "Volver a explorar" }),
  ).toBeFocused();

  await page.reload();
  await expect(detail).toBeVisible();
  await expect(postcard).toBeHidden();
  await detail.getByRole("button", { name: "Volver a explorar" }).click();
  await page.getByRole("button", { name: "Mi atlas" }).click();
  const open = page.getByRole("button", {
    name: "Ver postal de Bosques de Nikkō",
  });
  await open.click();
  await expect(
    postcard.locator(".postcard-finding").getByText("Pikachu", { exact: true }),
  ).toBeVisible();
  await postcard.press("Escape");
  await expect(open).toBeFocused();
});
