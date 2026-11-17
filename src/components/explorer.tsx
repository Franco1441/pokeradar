"use client";

/* eslint-disable @next/next/no-img-element -- Small remote pixel sprites need unmodified rendering. */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import dynamic from "next/dynamic";
import { preload } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useReducedMotion,
  type Variants,
} from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Binoculars,
  BookOpen,
  CheckCircle2,
  ChartNoAxesColumnIncreasing,
  Compass,
  Globe2,
  Leaf,
  LocateFixed,
  MapPin,
  Radar,
  Search,
  Sprout,
  Users,
  X,
  CloudSun,
  Share2,
  Info,
  CheckCheck,
} from "lucide-react";
import { EXPEDITIONS } from "@/lib/expeditions";
import { buildExpeditionPostcard } from "@/lib/expedition-postcard";
import { getFieldSite } from "@/lib/field-sites";
import { getSafariPanoramaSource, SAFARI_ZONES } from "@/lib/safari-zones";
import { getExpeditionCatalog } from "@/lib/safari-roster";
import { spriteUrl, TYPE_LABELS } from "@/lib/pokemon";
import { fetchWeather, weatherInfo } from "@/lib/weather";
import {
  getSafariSnapshot,
  SAFARI_CLOCK_MS,
  SAFARI_INTERVAL_MS,
  type SafariMode,
} from "@/lib/safari";
import {
  expeditionProgress,
  registerEncounter,
  toggleTeam,
} from "@/lib/research";
import { useResearch } from "@/lib/use-research";
import { useLocation } from "@/lib/use-location";
import type { Encounter, PokemonType } from "@/lib/types";
import PokemonDetailPanel from "./pokemon-detail";
import ExpeditionPostcard from "./expedition-postcard";
import WeatherPanel from "./weather-panel";
import SafariPanel from "./safari-panel";
import WorldDirectory from "./world-directory";
import MapLoading from "./map-loading";
import AtlasPanel from "./atlas-panel";
import "./journey.css";

const ExpeditionAnalysis = dynamic(() => import("./expedition-analysis"));

const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => <MapLoading world />,
});
const FieldScene = dynamic(() => import("./field-scene"), {
  ssr: false,
  loading: () => (
    <div className="field-loading" role="status">
      Preparando la vista del terreno…
    </div>
  ),
});

const SafariWalk = dynamic(() => import("./safari-walk"), {
  ssr: false,
  loading: () => (
    <div className="field-loading" role="status">
      Preparando el safari…
    </div>
  ),
});

type TerrainView = "field" | "safari";
const FIELD_LANDING_DURATION = 1520;
type LandingPhase = "approach" | "covered" | "reveal" | "complete";
type Landing = {
  expeditionId: string;
  origin: string;
  phase: LandingPhase;
  view: TerrainView;
  duration: number;
};
const veilMotion: Variants = {
  approach: ({ duration, view }: Landing) => ({
    opacity: [0, 0, view === "field" ? 0.38 : 0.25, 1],
    scale: view === "field" ? [1, 1, 1.05, 1.2] : [1, 1, 1.04, 1.08],
    transition: {
      duration: duration / 1000,
      times: view === "field" ? [0, 0.32, 0.66, 1] : [0, 0.35, 0.71, 1],
      ease: "easeIn",
    },
  }),
  covered: ({ view }: Landing) => ({
    opacity: 1,
    scale: view === "field" ? 1.2 : 1.08,
    transition: { duration: 0 },
  }),
  reveal: ({ view }: Landing) => ({
    opacity: 0,
    scale: view === "field" ? 1.42 : 1.12,
    transition: {
      duration: view === "field" ? 0.8 : 0.38,
      ease: [0.2, 0.68, 0.3, 1],
    },
  }),
};

type MapTab = "explore" | "atlas";
type Tab = MapTab | "analysis" | "radar";

function getClockWindow() {
  return Math.floor(Date.now() / SAFARI_INTERVAL_MS) * SAFARI_INTERVAL_MS;
}

function getSafariClock() {
  return Math.floor(Date.now() / SAFARI_CLOCK_MS) * SAFARI_CLOCK_MS;
}

function subscribeToClock(onChange: () => void) {
  const timer = window.setInterval(onChange, 1000);
  return () => window.clearInterval(timer);
}

const inactiveClock = () => () => {};
const serverClock = () => null;
const CATALOG_SIZE = EXPEDITIONS.reduce(
  (total, region) => total + getExpeditionCatalog(region).length,
  0,
);
const NAV = [
  { id: "explore" as const, label: "Mapa", icon: Compass },
  { id: "atlas" as const, label: "Mi atlas", icon: BookOpen },
  { id: "analysis" as const, label: "Análisis", icon: ChartNoAxesColumnIncreasing },
];

function PokemonSprite({
  id,
  name,
  className = "",
}: {
  id: number;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span className={`sprite-fallback ${className}`}>{name.slice(0, 2)}</span>
  ) : (
    <img
      className={className}
      src={spriteUrl(id)}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}

function ExpeditionApp() {
  const { params, navigate } = useLocation();
  const expedition =
    EXPEDITIONS.find((item) => item.id === params.get("region")) ??
    EXPEDITIONS[0];
  const selected =
    getExpeditionCatalog(expedition).find((item) => item.id === params.get("encounter")) ??
    null;
  const { progress, update, storageError } = useResearch();
  const [activeTab, setTab] = useState<MapTab>("explore");
  const view = params.get("view");
  const tab: Tab = view === "analysis" || view === "radar" ? view : activeTab;
  const terrainView = view === "field" || view === "safari" ? view : undefined;
  const safariOpen = terrainView === "safari";
  const [entryElapsed, setEntryElapsed] = useState(false);
  const [initialMapReady, setInitialMapReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setEntryElapsed(true), 2000);
    return () => window.clearTimeout(timer);
  }, []);
  const entryActive = tab !== "analysis" && !terrainView && (!entryElapsed || !initialMapReady);
  const [safariMode, setSafariMode] = useState<SafariMode>("live");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<PokemonType | "">("");
  const [atlasRegion, setAtlasRegion] = useState("all");
  const [atlasOnlyRegistered, setAtlasOnlyRegistered] = useState(false);
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const weatherOpener = useRef<HTMLButtonElement>(null);
  const worldView =
    view === "world" ||
    (!terrainView && view !== "radar" && view !== "analysis" && !params.has("region"));
  useEffect(() => {
    if (!worldView) return;
    preload("/map/earth-day.webp", { as: "image", fetchPriority: "high" });
    preload("/map/earth-night.webp", { as: "image", fetchPriority: "high" });
  }, [worldView]);
  const worldDetail = worldView && tab === "explore" ? selected : null;
  const focusedDestinationId =
    worldView && params.has("region") ? expedition.id : undefined;
  const trackingSafari = tab === "radar" || safariOpen;
  const clockWindow = useSyncExternalStore<number | null>(
    (worldView && tab === "explore") || trackingSafari
      ? subscribeToClock
      : inactiveClock,
    trackingSafari ? getSafariClock : getClockWindow,
    serverClock,
  );
  const localTime =
    clockWindow === null
      ? undefined
      : new Intl.DateTimeFormat("es-AR", {
          timeZone: expedition.timeZone,
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(clockWindow);
  const fieldSite = getFieldSite(expedition.id);
  const fieldOpen = Boolean(fieldSite && terrainView);
  const reducedMotion = useReducedMotion();
  const [landing, setLanding] = useState<Landing | null>(null);
  const currentLocation = params.toString();
  const currentLanding =
    landing &&
    (landing.phase === "approach"
      ? landing.origin === currentLocation
      : fieldOpen &&
        landing.view === terrainView &&
        landing.expeditionId === expedition.id)
      ? landing
      : null;
  const landingSite = currentLanding
    ? getFieldSite(currentLanding.expeditionId)
    : undefined;
  const landingBusy =
    currentLanding !== null && currentLanding.phase !== "complete";
  const [expanded, setExpanded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originFocus = useRef<HTMLElement | null>(null);
  const worldDetailRef = useRef<HTMLElement>(null);
  const previousWorldDetail = useRef<string | null>(null);
  const [confirmationRequest, setConfirmationRequest] = useState<{
    encounterId: string;
    sequence: number;
  }>();
  const confirmationSequence = useRef(0);
  const [openPostcard, setOpenPostcard] = useState<{
    expeditionId: string;
    celebrate: boolean;
  } | null>(null);
  const postcardOpener = useRef<HTMLButtonElement | null>(null);
  const fieldOrigin = useRef<HTMLElement | null>(null);
  const fieldWasOpen = useRef(false);
  const preparedImage = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    function handleHistoryChange() {
      setLanding(null);
      setConfirmationRequest(undefined);
    }
    window.addEventListener("popstate", handleHistoryChange);
    return () => window.removeEventListener("popstate", handleHistoryChange);
  }, []);

  useEffect(() => {
    if (currentLanding?.phase !== "covered") return;
    const timeout = window.setTimeout(() => {
      setLanding((value) =>
        value === currentLanding ? { ...value, phase: "reveal" } : value,
      );
    }, currentLanding.view === "field" ? 1800 : 950);
    return () => window.clearTimeout(timeout);
  }, [currentLanding]);

  useEffect(() => {
    if (currentLanding?.phase !== "approach") return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setLanding(null);
      requestAnimationFrame(() => fieldOrigin.current?.focus());
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [currentLanding]);

  useEffect(() => {
    if (!fieldOpen && fieldWasOpen.current) {
      const target = fieldOrigin.current?.isConnected
        ? fieldOrigin.current
        : document.getElementById("expedition-panel");
      target?.focus();
    }
    fieldWasOpen.current = fieldOpen;
  }, [fieldOpen]);
  const worldDetailId = worldDetail?.id ?? null;
  useEffect(() => {
    const previous = previousWorldDetail.current;
    previousWorldDetail.current = worldDetailId;

    if (worldDetailId) {
      worldDetailRef.current?.focus();
    } else if (previous && worldView && tab === "explore") {
      const target = document.querySelector<HTMLButtonElement>(
        `[data-world-encounter="${previous}"]`,
      );
      const panel = document.getElementById("expedition-panel");
      const detailsToggle = panel?.querySelector<HTMLButtonElement>(".world-preview-toggle");
      if (target?.getClientRects().length) target.focus();
      else if (detailsToggle?.getClientRects().length) detailsToggle.focus();
      else panel?.focus();
    }
  }, [worldDetailId, worldView, tab]);

  const weather = useQuery({
    queryKey: ["weather", expedition.id],
    enabled: tab !== "analysis",
    queryFn: ({ signal }) => fetchWeather(expedition, signal),
    staleTime: 15 * 60 * 1000,
    refetchInterval:
      (tab === "radar" || safariOpen) && safariMode === "live"
        ? SAFARI_INTERVAL_MS
        : false,
    retry: 1,
  });
  const currentWeather = weather.isError ? undefined : weather.data;
  const weatherSummary = currentWeather ? weatherInfo(currentWeather) : null;
  const safariSnapshot = getSafariSnapshot(expedition, {
    weather: currentWeather,
    mode: safariMode,
    now: clockWindow ?? 0,
  });
  const boostedTypes = weatherSummary?.types ?? [];
  const registeredIds = useMemo(
    () => progress.records.map((record) => record.pokemonId),
    [progress.records],
  );
  const goal = expeditionProgress(expedition, progress);
  const postcards = useMemo(
    () =>
      EXPEDITIONS.flatMap((region) => {
        const postcard = buildExpeditionPostcard(region, progress);
        return postcard ? [postcard] : [];
      }),
    [progress],
  );
  const activePostcard =
    postcards.find(
      ({ expedition }) => expedition.id === openPostcard?.expeditionId,
    ) ?? null;
  const allEncounters = useMemo(
    () =>
      EXPEDITIONS.flatMap((region) =>
        getExpeditionCatalog(region).map((encounter) => ({ encounter, region })),
      ),
    [],
  );
  const availableTypes = [
    ...new Set(
      expedition.encounters
        .filter((encounter) => !encounter.safariOnly)
        .flatMap((encounter) => encounter.types),
    ),
  ];
  const visibleEncounters = expedition.encounters.filter(
    (encounter) =>
      !encounter.safariOnly &&
      encounter.name.toLowerCase().includes(search.toLowerCase().trim()) &&
      (!type || encounter.types.includes(type)),
  );
  const encountersInView =
    tab === "radar"
      ? safariSnapshot.signals.map(({ encounter }) => encounter)
      : tab === "explore"
        ? visibleEncounters
        : expedition.encounters;
  const mapEncounters =
    selected && !encountersInView.some(({ id }) => id === selected.id)
      ? [...encountersInView, selected]
      : encountersInView;

  const atlasEntries = allEncounters.filter(
    ({ encounter, region }) =>
      (atlasRegion === "all" || region.id === atlasRegion) &&
      encounter.name.toLowerCase().includes(search.toLowerCase().trim()) &&
      (!type || encounter.types.includes(type)) &&
      (!atlasOnlyRegistered || registeredIds.includes(encounter.pokemonId)),
  );

  function announce(message: string) {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(""), 4500);
  }
  function changeTab(next: Exclude<Tab, "radar">) {
    if (next === "analysis") {
      if (tab !== "analysis") {
        setTab("explore");
        navigate(expedition.id, undefined, false, "analysis");
      }
    } else {
      if (selected || tab === "radar" || tab === "analysis") {
        navigate(
          expedition.id,
          undefined,
          tab !== "analysis" && Boolean(selected),
          worldView || tab === "analysis" ? "world" : undefined,
        );
      }
      setTab(next);
    }
    setSearch("");
    setType("");
    setExpanded(false);
  }

  function openMapFromAnalysis(id: string) {
    setTab("explore");
    navigate(id, undefined, false, "world");
  }
  function openRadar() {
    setLanding(null);
    setExpanded(false);
    setTab("explore");
    navigate(expedition.id, undefined, false, "radar");
    requestAnimationFrame(() =>
      document.getElementById("expedition-panel")?.focus(),
    );
  }
  function changeExpedition(id: string, next: "explore" | "radar" = "explore") {
    setConfirmationRequest(undefined);
    navigate(id, undefined, false, next === "radar" ? "radar" : undefined);
    setNotice("");
    setSearch("");
    setType("");
    setDestinationOpen(false);
    setExpanded(false);
    setTab("explore");
  }
  function openDestinationFromGlobe(id: string) {
    changeExpedition(id);
    if (mapError) {
      setExpanded(true);
      requestAnimationFrame(() =>
        document.getElementById("regional-sightings")?.focus(),
      );
    }
  }
  function showWorld() {
    setConfirmationRequest(undefined);
    navigate(expedition.id, undefined, false, "world");
    setNotice("");
    setDestinationOpen(false);
    setExpanded(false);
    setTab("explore");
  }
  function prepareField(id: string, terrain: TerrainView = "field") {
    const site = getFieldSite(id);
    if (!site) return;
    const source = terrain === "safari"
      ? getSafariPanoramaSource(SAFARI_ZONES[id]?.[0]?.image ?? site.image)
      : site.image;
    if (!preparedImage.current?.src.endsWith(source)) {
      const image = new window.Image();
      image.src = source;
      preparedImage.current = image;
    }
    const component =
      terrain === "safari" ? import("./safari-walk") : import("./field-scene");
    void component.catch(() => undefined);
  }
  function focusDestination(id: string) {
    if (focusedDestinationId === id) setMapAttempt((value) => value + 1);
    if (focusedDestinationId !== id || selected)
      navigate(id, undefined, true, "world");
    prepareField(id);
  }
  function enterField(id = expedition.id, terrain: TerrainView = "field") {
    if (!getFieldSite(id) || landingBusy) return;
    fieldOrigin.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setConfirmationRequest(undefined);
    setTab("explore");
    setWeatherOpen(false);
    prepareField(id, terrain);
    if (reducedMotion || mapError) {
      navigate(id, undefined, false, terrain);
      return;
    }
    setLanding({
      expeditionId: id,
      origin: currentLocation,
      phase: "approach",
      view: terrain,
      duration:
        terrain === "field" ? FIELD_LANDING_DURATION : worldView ? 1180 : 650,
    });
  }
  function advanceLanding(phase: string) {
    if (!currentLanding || phase !== currentLanding.phase) return;
    if (phase === "approach") {
      setLanding({ ...currentLanding, phase: "covered" });
      navigate(
        currentLanding.expeditionId,
        undefined,
        false,
        currentLanding.view,
      );
    } else if (phase === "reveal") {
      setLanding({ ...currentLanding, phase: "complete" });
    }
  }
  function revealLanding() {
    setLanding((value) =>
      value?.phase === "covered" ? { ...value, phase: "reveal" } : value,
    );
  }
  function closeDetail() {
    setConfirmationRequest(undefined);
    navigate(
      expedition.id,
      undefined,
      true,
      terrainView ??
        (tab === "radar" ? "radar" : worldView ? "world" : undefined),
    );
  }
  function selectEncounter(encounter: Encounter, region = expedition) {
    originFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const detailView =
      terrainView ??
      (tab === "radar"
        ? "radar"
        : worldView && tab === "explore"
          ? "world"
          : undefined);

    if (!terrainView && detailView !== "world") {
      setConfirmationRequest({
        encounterId: encounter.id,
        sequence: ++confirmationSequence.current,
      });
    }
    navigate(
      region.id,
      encounter.id,
      !!selected && region.id === expedition.id,
      detailView,
    );
    setTeamOpen(false);
  }
  function observeInTerrain(encounterId: string) {
    const encounter = getExpeditionCatalog(expedition).find(
      (item) => item.id === encounterId,
    );
    if (encounter) selectEncounter(encounter);
  }
  function leaveTerrain() {
    setLanding(null);
    navigate(expedition.id, undefined, true);
  }
  function registerSelected() {
    if (!selected) return;
    const next = update((current) =>
      registerEncounter(current, expedition, selected),
    );
    const completed =
      !goal.complete && expeditionProgress(expedition, next).complete;
    if (completed) {
      postcardOpener.current = null;
      setNotice("");
      setOpenPostcard({ expeditionId: expedition.id, celebrate: true });
    } else {
      announce(`${selected.name} se sumó a tu diario de campo.`);
    }
  }
  function toggleSelectedTeam() {
    if (!selected) return;
    const wasInTeam = progress.team.includes(selected.pokemonId);
    update((current) => toggleTeam(current, selected.pokemonId));
    announce(
      wasInTeam
        ? `${selected.name} salió de tu equipo.`
        : `${selected.name} se sumó a tu equipo.`,
    );
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      announce("Enlace copiado. Compartí este descubrimiento.");
    } catch {
      announce(
        "Podés compartir la dirección de esta página desde tu navegador.",
      );
    }
  }

  const detailContent = selected && (
    <>
      <PokemonDetailPanel
        key={selected.id}
        encounter={selected}
        expedition={expedition}
        registered={registeredIds.includes(selected.pokemonId)}
        inTeam={progress.team.includes(selected.pokemonId)}
        teamFull={progress.team.length >= 6}
        onRegister={registerSelected}
        onToggleTeam={toggleSelectedTeam}
        onClose={closeDetail}
        boostedTypes={boostedTypes}
        inWorld={Boolean(worldDetail)}
        worldConditions={
          worldDetail
            ? [
                currentWeather && weatherSummary
                  ? `${Math.round(currentWeather.temperature)}° · ${weatherSummary.label}`
                  : undefined,
                localTime && `${localTime} h local`,
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
      />
      <button className="share-detail" onClick={share}>
        <Share2 size={14} />
        Compartir encuentro
      </button>
    </>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="expedition-app"
        inert={fieldOpen || landingBusy || entryActive}
        data-landing={currentLanding?.phase === "approach"}
        data-landing-view={currentLanding?.view}
      >
        <a className="skip-link" href="#expedition-panel">
          {tab === "explore"
            ? worldView
              ? "Ir a los destinos"
              : "Ir a los avistamientos"
            : "Ir al panel"}
        </a>
        <header className="app-header">
          <Link href="/" className="brand" aria-label="PokéRadar, inicio">
            <span className="brand-mark">
              <Radar size={25} strokeWidth={1.6} />
            </span>
            <span className="brand-word">
              poké<span>radar</span>
              <small>DIARIO DE EXPEDICIÓN</small>
            </span>
          </Link>
          <nav className="main-nav" aria-label="Navegación principal">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => changeTab(id)}
                aria-current={
                  tab === id || (tab === "radar" && id === "explore")
                    ? "page"
                    : undefined
                }
                className={
                  tab === id || (tab === "radar" && id === "explore")
                    ? "active"
                    : ""
                }
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <button className="team-header" onClick={() => setTeamOpen(true)}>
              <Users size={17} />
              <span>Mi equipo</span>
              <b>{progress.team.length}/6</b>
            </button>
          </div>
        </header>

        {tab === "analysis" && (
          <ExpeditionAnalysis
            progress={progress}
            regionId={expedition.id}
            onSelectRegion={(id) => {
              if (id !== expedition.id) navigate(id, undefined, true, "analysis");
            }}
            onOpenMap={openMapFromAnalysis}
            onOpenSafari={(id) => navigate(id, undefined, false, "safari")}
          />
        )}
        {tab !== "analysis" && (
        <main
          className={`map-stage ${worldView ? "map-stage-world" : ""}`}
          style={
            {
              "--expedition-color": expedition.color,
              "--site-accent": fieldSite?.accent,
            } as CSSProperties
          }
        >
          <MapView
            recenterKey={mapAttempt}
            expedition={expedition}
            encounters={mapEncounters}
            safariPeriod={
              tab === "radar"
                ? safariSnapshot.isDay
                  ? "day"
                  : "night"
                : undefined
            }
            selectedId={fieldOpen || worldView ? null : (selected?.id ?? null)}
            confirmationRequest={confirmationRequest}
            registeredIds={registeredIds}
            boostedTypes={boostedTypes}
            worldView={worldView}
            onSelect={selectEncounter}
            onExpedition={worldView ? focusDestination : changeExpedition}
            focusedDestinationId={focusedDestinationId}
            landingSite={
              currentLanding?.phase === "approach" ? landingSite : undefined
            }
            landingDuration={currentLanding?.duration}
            onMapError={setMapError}
            onInitialMapReady={() => setInitialMapReady(true)}
            onEnterField={fieldSite && tab !== "radar" ? enterField : undefined}
          />
          <div className="map-toolbar">
            <button
              className={worldView ? "map-back-to-region selected" : ""}
              title={
                worldView
                  ? "Volver a la expedición"
                  : "Ver todas las expediciones"
              }
              aria-label={
                worldView
                  ? "Volver a la expedición"
                  : "Ver todas las expediciones"
              }
              aria-pressed={worldView}
              onClick={
                worldView
                  ? () =>
                      changeExpedition(focusedDestinationId ?? expedition.id)
                  : showWorld
              }
            >
              <Globe2 size={20} />
            </button>
            {!worldView && (
              <button
                title="Centrar expedición"
                aria-label="Centrar expedición"
                onClick={() => setMapAttempt((value) => value + 1)}
              >
                <LocateFixed size={19} />
              </button>
            )}
          </div>
          <aside
            tabIndex={-1}
            id="expedition-panel"
            className={`field-panel ${tab === "radar" ? "safari-sheet" : ""} ${expanded ? "is-expanded" : ""} ${selected && !worldDetail ? "panel-behind-detail" : ""}`}
            aria-label={
              tab === "explore"
                ? "Expedición y avistamientos"
                : tab === "atlas"
                  ? "Atlas de descubrimientos"
                  : "Radar Safari"
            }
          >
            <button
              className="sheet-handle"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              aria-label={expanded ? "Reducir panel" : "Expandir panel"}
            >
              <span />
            </button>
            {tab === "explore" && worldView && (
              <WorldDirectory
                activeId={focusedDestinationId ?? expedition.id}
                mapUnavailable={Boolean(mapError)}
                onFocusDestination={focusDestination}
                onChoose={openDestinationFromGlobe}
                onLand={(id) => enterField(id)}
                onSafari={(id) => enterField(id, "safari")}
                weather={currentWeather}
                weatherPending={weather.isPending}
                localTime={localTime}
                onPreviewEncounter={(encounter) => selectEncounter(encounter)}
                detail={
                  worldDetail && (
                    <section
                      key={worldDetail.id}
                      ref={worldDetailRef}
                      className="world-encounter-detail"
                      aria-label={`Ficha de ${worldDetail.name}`}
                      tabIndex={-1}
                      onKeyDown={(event) => {
                        if (event.key === "Escape" && !event.defaultPrevented) {
                          event.preventDefault();
                          closeDetail();
                        }
                      }}
                    >
                      {detailContent}
                    </section>
                  )
                }
              />
            )}
            {tab === "explore" && !worldView && (
              <>
                <div className="expedition-cover">
                  <Image
                    src={fieldSite?.image ?? expedition.image}
                    alt={`Paisaje ilustrativo de ${expedition.biome.toLowerCase()}`}
                    fill
                    priority
                    sizes="(max-width: 700px) 100vw, 360px"
                  />
                  <div className="cover-shade" />
                  <span className="biome-label">
                    <Leaf size={13} />
                    {expedition.biome}
                  </span>
                  <button
                    onClick={() => setDestinationOpen(true)}
                    className="change-destination"
                  >
                    Cambiar destino
                    <ArrowUpRight size={14} />
                  </button>
                  <div className="cover-title">
                    <span>{expedition.country}</span>
                    <h1>{expedition.name}</h1>
                  </div>
                </div>
                <div className="panel-body">
                  {fieldSite && (
                    <div className="regional-mode-actions">
                      <button
                        type="button"
                        className="field-enter"
                        onPointerEnter={() => prepareField(expedition.id)}
                        onFocus={() => prepareField(expedition.id)}
                        onClick={() => enterField()}
                      >
                        <Binoculars size={20} aria-hidden="true" />
                        <span>
                          <strong>{fieldSite.action}</strong>
                          <small>Encuentros fijos</small>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="field-enter"
                        onPointerEnter={() => prepareField(expedition.id, "safari")}
                        onFocus={() => prepareField(expedition.id, "safari")}
                        onClick={() => enterField(expedition.id, "safari")}
                      >
                        <Radar size={20} aria-hidden="true" />
                        <span>
                          <strong>Safari</strong>
                          <small>Avistamientos rotativos</small>
                        </span>
                      </button>
                    </div>
                  )}
                  <div className="map-side-actions">
                    <button type="button" onClick={openRadar}>
                      <Radar size={16} aria-hidden="true" /> Ver radar
                    </button>
                    <button
                      type="button"
                      ref={weatherOpener}
                      aria-label="Ver clima local"
                      onClick={() => setWeatherOpen(true)}
                    >
                      <CloudSun size={16} aria-hidden="true" />
                      {currentWeather
                        ? `${Math.round(currentWeather.temperature)}° · ${weatherSummary?.label}`
                        : "Clima local"}
                    </button>
                  </div>
                  <div
                    className={`mission-card ${goal.complete ? "mission-complete" : ""}`}
                  >
                    <div className="mission-icon">
                      {goal.complete ? (
                        <CheckCheck size={20} />
                      ) : (
                        <Compass size={20} />
                      )}
                    </div>
                    <div>
                      <h2 className="mission-heading">
                        {goal.complete
                          ? "Expedición completada"
                          : "Tu misión de campo"}
                      </h2>
                      {goal.complete ? (
                        <p>Sumaste un sello a tu atlas.</p>
                      ) : (
                        <div className="mission-goals">
                          <label>
                            <span>
                              Especies <b>{Math.min(goal.registered, 3)}/3</b>
                            </span>
                            <progress
                              value={Math.min(goal.registered, 3)}
                              max={3}
                            />
                          </label>
                          <label>
                            <span>
                              Tipos <b>{Math.min(goal.typeCount, 2)}/2</b>
                            </span>
                            <progress
                              value={Math.min(goal.typeCount, 2)}
                              max={2}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="section-heading">
                    <h2 id="regional-sightings" tabIndex={-1}>
                      En esta expedición
                    </h2>
                    <span>{visibleEncounters.length} especies</span>
                  </div>
                  <div className="search-field">
                    <Search size={16} />
                    <input
                      aria-label="Buscar Pokémon en la expedición"
                      placeholder="Buscar Pokémon…"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    {search && (
                      <button
                        aria-label="Limpiar búsqueda"
                        onClick={() => setSearch("")}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className="type-filters">
                    <button
                      className={!type ? "active" : ""}
                      onClick={() => setType("")}
                    >
                      Todos
                    </button>
                    {availableTypes.map((value) => (
                      <button
                        key={value}
                        className={type === value ? "active" : ""}
                        onClick={() => setType(type === value ? "" : value)}
                      >
                        {TYPE_LABELS[value]}
                      </button>
                    ))}
                  </div>
                  <div className="encounter-list">
                    {visibleEncounters.map((encounter) => (
                      <button
                        className="encounter-row"
                        key={encounter.id}
                        onClick={() => selectEncounter(encounter)}
                      >
                        <span className="encounter-portrait">
                          <PokemonSprite
                            id={encounter.pokemonId}
                            name={encounter.name}
                          />
                        </span>
                        <span className="encounter-info">
                          <strong>
                            {encounter.name}
                            {registeredIds.includes(encounter.pokemonId) && (
                              <CheckCircle2 size={13} aria-label="Registrado" />
                            )}
                          </strong>
                          <span>
                            {encounter.types
                              .map((value) => TYPE_LABELS[value])
                              .join(" · ")}
                          </span>
                        </span>
                        <span className="encounter-right">
                          {encounter.types.some((value) =>
                            boostedTypes.includes(value),
                          ) && (
                            <CloudSun size={15} aria-label="Clima favorable" />
                          )}
                          <span>
                            #{String(encounter.pokemonId).padStart(3, "0")}
                          </span>
                          <ArrowUpRight size={14} />
                        </span>
                      </button>
                    ))}
                  </div>
                  {!visibleEncounters.length && (
                    <div className="empty-state">
                      <Search />
                      <h3>Sin avistamientos para ese filtro</h3>
                      <button
                        className="text-button"
                        onClick={() => {
                          setSearch("");
                          setType("");
                        }}
                      >
                        Ver todas las especies
                      </button>
                    </div>
                  )}
                  <p className="panel-footnote">
                    <MapPin size={12} />
                    Ubicaciones simuladas
                  </p>
                </div>
              </>
            )}
            {tab === "atlas" && (
              <AtlasPanel
                progress={progress}
                catalogSize={CATALOG_SIZE}
                entries={atlasEntries}
                postcards={postcards}
                search={search}
                type={type}
                regionFilter={atlasRegion}
                onlyRegistered={atlasOnlyRegistered}
                onSearchChange={setSearch}
                onTypeChange={setType}
                onRegionChange={setAtlasRegion}
                onOnlyRegisteredChange={setAtlasOnlyRegistered}
                onOpenPostcard={(id, opener) => {
                  postcardOpener.current = opener;
                  setOpenPostcard({ expeditionId: id, celebrate: false });
                }}
                onSelectEncounter={selectEncounter}
                renderSprite={(id, name) => <PokemonSprite id={id} name={name} />}
              />
            )}
            {tab === "radar" && (
              <SafariPanel
                expedition={expedition}
                snapshot={safariSnapshot}
                mode={safariMode}
                registeredIds={registeredIds}
                onModeChange={setSafariMode}
                onSelect={selectEncounter}
                onChangeDestination={() => setDestinationOpen(true)}
              />
            )}
          </aside>
        </main>
        )}
        <footer className="app-footer">
          <span>
            <span className="status-dot" />
            {EXPEDITIONS.length} expediciones · {CATALOG_SIZE} especies
          </span>
          <button onClick={() => setAboutOpen(true)}>
            <Info size={12} />
            Acerca del proyecto
          </button>
          <span className="footer-credit">
            PokéAPI · OpenFreeMap · Open-Meteo
          </span>
        </footer>
        <Dialog.Root
          open={tab !== "analysis" && !!selected && !worldDetail}
          onOpenChange={(open) => {
            if (!open) closeDetail();
          }}
          modal={false}
        >
          <Dialog.Portal>
            {tab !== "analysis" && selected && !worldDetail && (
              <Dialog.Content
                className={`detail-dialog ${fieldOpen ? "detail-dialog-field" : ""}`}
                aria-describedby={undefined}
                onInteractOutside={(event) => event.preventDefault()}
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  const trigger = originFocus.current;
                  if (trigger?.isConnected && !trigger.matches(":disabled")) {
                    trigger.focus();
                  } else if (safariOpen) {
                    document.querySelector<HTMLElement>(".safari-walk-viewport")?.focus();
                  }
                }}
              >
                <Dialog.Title className="sr-only">
                  Ficha de {selected.name}
                </Dialog.Title>
                {detailContent}
              </Dialog.Content>
            )}
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root open={weatherOpen} onOpenChange={setWeatherOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="modal-overlay" />
            <Dialog.Content
              className="weather-dialog"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                weatherOpener.current?.focus();
              }}
            >
              <Dialog.Title className="sr-only">
                Clima local en {expedition.name}
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                Consultá las condiciones que influyen en el Safari.
              </Dialog.Description>
              <Dialog.Close className="modal-close" aria-label="Cerrar clima">
                <X size={20} />
              </Dialog.Close>
              <WeatherPanel
                expedition={expedition}
                weather={weather.data}
                isLoading={weather.isFetching}
                error={weather.isError}
                onRetry={() => void weather.refetch()}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root open={destinationOpen} onOpenChange={setDestinationOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="modal-overlay" />
            <Dialog.Content className="destination-modal">
              <Dialog.Close
                className="modal-close"
                aria-label="Cerrar destinos"
              >
                <X size={20} />
              </Dialog.Close>
              <span className="eyebrow">{EXPEDITIONS.length} expediciones</span>
              <Dialog.Title>¿Dónde empieza tu próxima historia?</Dialog.Title>
              <Dialog.Description>
                Elegí una expedición. Cada paisaje guarda sus propios
                encuentros.
              </Dialog.Description>
              <div className="destination-grid">
                {EXPEDITIONS.map((region) => (
                  <button
                    className={`destination-card ${region.id === expedition.id ? "current" : ""}`}
                    key={region.id}
                    onClick={() =>
                      changeExpedition(
                        region.id,
                        tab === "radar" ? "radar" : "explore",
                      )
                    }
                  >
                    <div className="destination-image">
                      <Image
                        src={getFieldSite(region.id)?.image ?? region.image}
                        alt={`Paisaje ilustrativo de ${region.biome}`}
                        fill
                        sizes="(max-width: 640px) 90vw, 260px"
                      />
                      <span>{region.biome}</span>
                      {expeditionProgress(region, progress).complete && (
                        <CheckCircle2 size={22} />
                      )}
                    </div>
                    <div>
                      <span>{region.country}</span>
                      <h3>{region.name}</h3>
                      <p>
                        {getExpeditionCatalog(region).length} especies ·{" "}
                        {expeditionProgress(region, progress).registered}{" "}
                        registradas
                        <ArrowUpRight size={18} />
                      </p>
                    </div>
                  </button>
                ))}
              </div>
              <button className="world-button" onClick={showWorld}>
                <Globe2 size={17} />
                Ver las expediciones en el mapa
              </button>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root open={teamOpen} onOpenChange={setTeamOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="modal-overlay" />
            <Dialog.Content className="team-modal">
              <Dialog.Close className="modal-close" aria-label="Cerrar equipo">
                <X size={20} />
              </Dialog.Close>
              <span className="eyebrow">COMPAÑEROS DE VIAJE</span>
              <Dialog.Title>Tu equipo de expedición</Dialog.Title>
              <Dialog.Description>
                Guardá hasta seis de tus descubrimientos favoritos.
              </Dialog.Description>
              <div className="team-modal-grid">
                {progress.team.map((id) => {
                  const found = allEncounters.find(
                    ({ encounter }) => encounter.pokemonId === id,
                  );
                  if (!found) return null;
                  return (
                    <div className="team-member" key={id}>
                      <button
                        className="remove-member"
                        aria-label={`Quitar a ${found.encounter.name} del equipo`}
                        onClick={() =>
                          update((current) => toggleTeam(current, id))
                        }
                      >
                        <X size={14} />
                      </button>
                      <button
                        onClick={() =>
                          selectEncounter(found.encounter, found.region)
                        }
                      >
                        <PokemonSprite id={id} name={found.encounter.name} />
                        <strong>{found.encounter.name}</strong>
                        <span>{found.region.country}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
              {progress.team.length === 0 && (
                <div className="empty-team">
                  <span>
                    <Sprout size={36} />
                  </span>
                  <h3>Los mejores viajes se comparten.</h3>
                  <p>
                    Registrá un Pokémon en tu diario y agregalo a tu equipo
                    desde su ficha.
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => {
                      setTeamOpen(false);
                      changeTab("explore");
                    }}
                  >
                    Buscar mi primer compañero
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
              {progress.team.length > 0 && (
                <button
                  className="primary-button"
                  onClick={() => {
                    setTeamOpen(false);
                    changeTab("atlas");
                  }}
                >
                  Elegir más compañeros
                  <BookOpen size={16} />
                </button>
              )}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root open={aboutOpen} onOpenChange={setAboutOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="modal-overlay" />
            <Dialog.Content className="about-modal">
              <Dialog.Close
                className="modal-close"
                aria-label="Cerrar información"
              >
                <X size={20} />
              </Dialog.Close>
              <span className="brand-mark">
                <Radar size={27} />
              </span>
              <Dialog.Title>Un mundo por descubrir.</Dialog.Title>
              <Dialog.Description>
                PokéRadar es un diario de expedición interactivo creado por
                Franco para el desafío frontend de DataInt.
              </Dialog.Description>
              <p>
                Los avistamientos y su afinidad con el clima forman parte de una
                simulación. Las características de los Pokémon provienen de
                PokéAPI y las condiciones meteorológicas de Open-Meteo.
              </p>
              <p>
                Tu diario se guarda en este navegador. Las fotografías ilustran
                los hábitats. Pokémon y sus personajes pertenecen a sus
                respectivos titulares.
              </p>
              <div className="about-sources">
                <a href="https://pokeapi.co/" target="_blank" rel="noreferrer">
                  PokéAPI
                  <ArrowUpRight size={14} />
                </a>
                <a
                  href="https://openfreemap.org/"
                  target="_blank"
                  rel="noreferrer"
                >
                  OpenFreeMap
                  <ArrowUpRight size={14} />
                </a>
                <a
                  href="https://open-meteo.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open-Meteo
                  <ArrowUpRight size={14} />
                </a>
                <a
                  href="https://unsplash.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Fotos de Unsplash
                  <ArrowUpRight size={14} />
                </a>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
      <ExpeditionPostcard
        postcard={activePostcard}
        open={Boolean(openPostcard && activePostcard)}
        celebrate={openPostcard?.celebrate}
        onOpenChange={(open) => {
          if (!open) setOpenPostcard(null);
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => {
            const target = postcardOpener.current?.isConnected
              ? postcardOpener.current
              : document.querySelector<HTMLButtonElement>(".detail-back");
            (target ?? document.getElementById("expedition-panel"))?.focus();
          });
        }}
      />
      {storageError && (
        <div className="storage-warning" role="status">
          El navegador no permite guardar. Tu progreso dura esta sesión.
        </div>
      )}
      <AnimatePresence>
        {notice && (
          <motion.div
            className={`toast ${fieldOpen ? "toast-field" : ""}`}
            role="status"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <CheckCircle2 size={18} />
            {notice}
            <button aria-label="Cerrar aviso" onClick={() => setNotice("")}>
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {fieldOpen && fieldSite && (
        <main
          className="field-route"
          aria-label={
            safariOpen
              ? "Safari en primera persona"
              : "Exploración en primera persona"
          }
        >
          {safariOpen ? (
            <SafariWalk
              key={expedition.id}
              expedition={expedition}
              site={fieldSite}
              snapshot={safariSnapshot}
              mode={safariMode}
              onModeChange={setSafariMode}
              registeredIds={registeredIds}
              detailOpen={Boolean(selected)}
              onObserve={observeInTerrain}
              onExit={leaveTerrain}
              onOpenRadar={openRadar}
              onReady={revealLanding}
            />
          ) : (
            <FieldScene
              key={expedition.id}
              expedition={expedition}
              site={fieldSite}
              cinematicArrival={Boolean(currentLanding)}
              onPanoramaReady={revealLanding}
              registeredIds={registeredIds}
              detailOpen={Boolean(selected)}
              onObserve={observeInTerrain}
              onExit={leaveTerrain}
            />
          )}
        </main>
      )}
      {landingBusy && landingSite && (
        <div
          className="landing-overlay"
          data-phase={currentLanding.phase}
          data-view={currentLanding.view}
        >
          <span className="sr-only" role="status">
            Viajando a {landingSite.name}
          </span>
          <motion.div
            className="landing-veil"
            aria-hidden="true"
            style={{ "--arrival-accent": landingSite.accent } as CSSProperties}
            initial={{ opacity: 0, scale: 1 }}
            animate={currentLanding.phase}
            variants={veilMotion}
            custom={currentLanding}
            onAnimationComplete={(phase) => {
              if (typeof phase === "string") advanceLanding(phase);
            }}
          />
          {currentLanding.phase === "approach" && (
            <motion.p
              className="landing-destination"
              aria-hidden="true"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -8] }}
              transition={{
                duration: currentLanding.duration / 1000,
                times: [0, 0.21, 0.55, 0.86],
              }}
            >
              <MapPin size={17} /> {landingSite.name}
            </motion.p>
          )}
        </div>
      )}
      <MapLoading world active={entryActive} fullscreen />
    </MotionConfig>
  );
}

export default function Explorer() {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <ExpeditionApp />
    </QueryClientProvider>
  );
}
