import type { Encounter, Expedition, WeatherSnapshot } from "./types";
import { weatherInfo } from "./weather";

export type SafariMode = "live" | "day" | "night";
export const SAFARI_INTERVAL_MS = 60_000;
const MAX_SIGNALS = 4;

export interface SafariSignal {
  encounter: Encounter;
  reason: string;
  boosted: boolean;
}

export interface SafariSnapshot {
  isDay: boolean;
  source: "live" | "preview" | "estimated";
  timeLabel: string;
  weatherLabel: string;
  signals: SafariSignal[];
  nextRefreshAt: number;
}

interface SafariOptions {
  weather?: WeatherSnapshot;
  mode: SafariMode;
  now: number;
}

function rotate<T>(items: T[], offset: number): T[] {
  if (items.length === 0) return items;
  const index = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(index), ...items.slice(0, index)];
}

export function getSafariSnapshot(
  expedition: Expedition,
  { weather, mode, now }: SafariOptions,
): SafariSnapshot {
  const clock = new Intl.DateTimeFormat("es-AR", {
    timeZone: expedition.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const localHour = Number(
    clock.formatToParts(now).find(({ type }) => type === "hour")?.value,
  );
  const estimatedDay = localHour >= 6 && localHour < 18;
  const isDay =
    mode === "live" ? (weather?.isDay ?? estimatedDay) : mode === "day";
  const period = isDay ? "day" : "night";
  const conditions = weather ? weatherInfo(weather) : undefined;
  const favors = (encounter: Encounter) =>
    encounter.types.some((type) => conditions?.types.includes(type));
  const slot = Math.floor(now / SAFARI_INTERVAL_MS);
  // A stable offset lets each destination rotate its own catalog without changing encounter IDs.
  const destinationOffset = [...expedition.id].reduce(
    (offset, character) => (31 * offset + character.charCodeAt(0)) >>> 0,
    0,
  );
  const offset = slot + destinationOffset;
  const eligible = expedition.encounters.filter(
    ({ activity }) => !activity || activity === "any" || activity === period,
  );

  // Reserve room for distinct day/night wildlife, then guarantee a climate-favored
  // sighting when one is active. Other eligible encounters rotate through the remaining slots.
  const featured = rotate(
    eligible.filter(({ activity }) => activity === period),
    offset,
  ).slice(0, 2);
  const remaining = rotate(
    eligible.filter((encounter) => !featured.includes(encounter)),
    offset,
  );
  const weatherSignal = featured.some(favors)
    ? undefined
    : remaining.find(favors);
  const selected = [
    ...featured,
    ...(weatherSignal ? [weatherSignal] : []),
    ...remaining.filter((encounter) => encounter !== weatherSignal),
  ].slice(0, MAX_SIGNALS);

  return {
    isDay,
    source: mode !== "live" ? "preview" : weather ? "live" : "estimated",
    timeLabel: clock.format(now),
    weatherLabel: conditions?.label ?? "Clima no disponible",
    nextRefreshAt: (slot + 1) * SAFARI_INTERVAL_MS,
    signals: selected.map((encounter) => {
      const boosted = favors(encounter);
      const activity =
        encounter.activity === "day"
          ? "Actividad diurna"
          : encounter.activity === "night"
            ? "Actividad nocturna"
            : "Presencia en el bioma";
      return {
        encounter,
        reason: boosted ? `${activity} · clima favorable` : activity,
        boosted,
      };
    }),
  };
}
