import { expect, test } from "@playwright/test";

const spriteOrigin = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
const transparentPixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==",
  "base64",
);

test("a missing animation falls back to the static Pokémon sprite", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  let requestedAnimation = false;
  await page.route(`${spriteOrigin}/other/showdown/1.gif`, (route) => {
    requestedAnimation = true;
    return route.abort();
  });
  await page.route(`${spriteOrigin}/1.png`, (route) =>
    route.fulfill({ contentType: "image/png", body: transparentPixel }),
  );

  await page.goto("/?region=nikko&view=field");
  const sprite = page.locator('.field-scene img[data-pokemon-sprite="1"]');
  await expect(sprite).toHaveAttribute("src", `${spriteOrigin}/1.png`);
  expect(requestedAnimation).toBe(true);
  await expect(sprite).toHaveJSProperty("complete", true);
  await expect(sprite).toHaveJSProperty("naturalWidth", 1);
});

test("reduced-motion users receive static sprites without downloading the GIF", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let requestedAnimation = false;
  page.on("request", (request) => {
    if (request.url().includes("/other/showdown/")) requestedAnimation = true;
  });
  await page.route(`${spriteOrigin}/1.png`, (route) =>
    route.fulfill({ contentType: "image/png", body: transparentPixel }),
  );

  await page.goto("/?region=nikko&view=field");
  const sprite = page.locator('.field-scene img[data-pokemon-sprite="1"]');
  await expect(sprite).toHaveJSProperty("currentSrc", `${spriteOrigin}/1.png`);
  await expect(sprite).toHaveJSProperty("naturalWidth", 1);
  expect(requestedAnimation).toBe(false);
});
