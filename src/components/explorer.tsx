"use client";

/* eslint-disable @next/next/no-img-element -- Small remote pixel sprites need unmodified rendering. */
import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Compass,
  Globe2,
  Leaf,
  LocateFixed,
  MapPin,
  Plus,
  Radar,
  Search,
  SlidersHorizontal,
  Sprout,
  Users,
  X,
  CloudSun,
  Share2,
  Info,
  CheckCheck,
} from "lucide-react";
import { EXPEDITIONS } from "@/lib/expeditions";
import { spriteUrl, TYPE_LABELS } from "@/lib/pokemon";
import { fetchWeather, weatherInfo } from "@/lib/weather";
import {
  expeditionProgress,
  registerEncounter,
  toggleTeam,
} from "@/lib/research";
import { useResearch } from "@/lib/use-research";
import { useLocation } from "@/lib/use-location";
import type { Encounter, PokemonType } from "@/lib/types";
import PokemonDetailPanel from "./pokemon-detail";
import WeatherPanel from "./weather-panel";

const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <Radar size={38} />
      <span>Preparando tu expedición…</span>
    </div>
  ),
});
type Tab = "explore" | "atlas" | "weather";
const NAV = [
  { id: "explore" as const, label: "Explorar", icon: Compass },
  { id: "atlas" as const, label: "Mi atlas", icon: BookOpen },
  { id: "weather" as const, label: "Observatorio", icon: CloudSun },
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
    expedition.encounters.find((item) => item.id === params.get("encounter")) ??
    null;
  const { progress, update, storageError } = useResearch();
  const [tab, setTab] = useState<Tab>("explore");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<PokemonType | "">("");
  const [atlasRegion, setAtlasRegion] = useState("all");
  const [atlasOnlyRegistered, setAtlasOnlyRegistered] = useState(false);
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [worldView, setWorldView] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originFocus = useRef<HTMLElement | null>(null);
  const weather = useQuery({
    queryKey: ["weather", expedition.id],
    queryFn: ({ signal }) => fetchWeather(expedition, signal),
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });
  const weatherSummary = weather.data ? weatherInfo(weather.data) : null;
  const boostedTypes = weatherSummary?.types ?? [];
  const registeredIds = useMemo(
    () => progress.records.map((record) => record.pokemonId),
    [progress.records],
  );
  const goal = expeditionProgress(expedition, progress);
  const allEncounters = useMemo(
    () =>
      EXPEDITIONS.flatMap((region) =>
        region.encounters.map((encounter) => ({ encounter, region })),
      ),
    [],
  );
  const availableTypes = [
    ...new Set(expedition.encounters.flatMap((encounter) => encounter.types)),
  ];
  const visibleEncounters = useMemo(
    () =>
      expedition.encounters.filter(
        (encounter) =>
          encounter.name.toLowerCase().includes(search.toLowerCase().trim()) &&
          (!type || encounter.types.includes(type)),
      ),
    [expedition, search, type],
  );
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
  function changeTab(next: Tab) {
    if (selected) navigate(expedition.id, undefined, true);
    setTab(next);
    setSearch("");
    setType("");
    setExpanded(false);
  }
  function changeExpedition(id: string) {
    navigate(id);
    setSearch("");
    setType("");
    setWorldView(false);
    setDestinationOpen(false);
    setExpanded(false);
    setTab("explore");
  }
  function selectEncounter(encounter: Encounter, region = expedition) {
    originFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    navigate(
      region.id,
      encounter.id,
      !!selected && region.id === expedition.id,
    );
    setWorldView(false);
    setTeamOpen(false);
  }
  function registerSelected() {
    if (!selected) return;
    const next = update((current) =>
      registerEncounter(current, expedition, selected),
    );
    const completed = expeditionProgress(expedition, next).complete;
    announce(
      completed && !goal.complete
        ? "¡Expedición completada! Tu atlas tiene un nuevo sello."
        : `${selected.name} se sumó a tu diario de campo.`,
    );
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

  return (
    <MotionConfig reducedMotion="user">
      <div className="expedition-app">
        <a className="skip-link" href="#expedition-panel">
          Ir a los avistamientos
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
                aria-current={tab === id ? "page" : undefined}
                className={tab === id ? "active" : ""}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <span className="discovery-count">
              <Sprout size={16} />
              <strong>{progress.records.length}</strong>
              <span>descubrimientos</span>
            </span>
            <button className="team-header" onClick={() => setTeamOpen(true)}>
              <Users size={17} />
              <span>Mi equipo</span>
              <b>{progress.team.length}/6</b>
            </button>
          </div>
        </header>

        <main className="map-stage">
          <MapView
            recenterKey={mapAttempt}
            expedition={expedition}
            encounters={
              tab === "explore" ? visibleEncounters : expedition.encounters
            }
            selectedId={selected?.id ?? null}
            registeredIds={registeredIds}
            boostedTypes={boostedTypes}
            worldView={worldView}
            onSelect={selectEncounter}
            onExpedition={changeExpedition}
            onMapError={setMapError}
          />
          <div className="map-topline">
            <span className="simulation-label">
              <span /> Avistamientos simulados
            </span>
            <button
              className="map-location"
              onClick={() => setDestinationOpen(true)}
            >
              <MapPin size={14} />
              {expedition.country}
              <ChevronDown size={13} />
            </button>
          </div>
          <div className="map-toolbar">
            <button
              title="Ver todas las expediciones"
              aria-label="Ver todas las expediciones"
              aria-pressed={worldView}
              onClick={() => setWorldView(!worldView)}
              className={worldView ? "selected" : ""}
            >
              <Globe2 size={20} />
            </button>
            <button
              title="Centrar expedición"
              aria-label="Centrar expedición"
              onClick={() => {
                setWorldView(false);
                setMapAttempt((value) => value + 1);
              }}
            >
              <LocateFixed size={19} />
            </button>
          </div>
          {mapError && (
            <div className="map-error" role="status">
              Podés explorar los avistamientos desde la lista.
            </div>
          )}

          <aside
            tabIndex={-1}
            id="expedition-panel"
            className={`field-panel ${expanded ? "is-expanded" : ""} ${selected ? "panel-behind-detail" : ""}`}
            aria-label={
              tab === "explore"
                ? "Expedición y avistamientos"
                : tab === "atlas"
                  ? "Atlas de descubrimientos"
                  : "Observatorio meteorológico"
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
            {tab === "explore" && (
              <>
                <div className="expedition-cover">
                  <Image
                    src={expedition.image}
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
                  <p className="expedition-intro">{expedition.description}</p>
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
                      <div className="mission-heading">
                        {goal.complete
                          ? "Expedición completada"
                          : "Tu misión de campo"}
                        <span>{Math.min(goal.registered, 3)}/3</span>
                      </div>
                      <p>
                        {goal.complete
                          ? "Un nuevo sello en tu atlas. Seguí explorando."
                          : "Registrá 3 especies de al menos 2 tipos."}
                      </p>
                      <div className="mission-track">
                        <span
                          style={{
                            width: `${Math.min(goal.registered / 3, 1) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="section-heading">
                    <h2>En esta expedición</h2>
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
                    Elegí un Pokémon para investigar su hábitat.
                  </p>
                </div>
              </>
            )}
            {tab === "atlas" && (
              <div className="panel-body atlas-panel">
                <span className="eyebrow">TU CUADERNO DE CAMPO</span>
                <h1>
                  Pequeños encuentros.
                  <br />
                  Grandes descubrimientos.
                </h1>
                <p className="muted">
                  Cada especie, un lugar y una historia para recordar.
                </p>
                <div className="atlas-total">
                  <BookOpen size={24} />
                  <strong>
                    {progress.records.length}
                    <small>/ 30</small>
                  </strong>
                  <span>
                    especies
                    <br />
                    registradas
                  </span>
                </div>
                <div className="atlas-stamps">
                  {EXPEDITIONS.map((region) => (
                    <button
                      key={region.id}
                      onClick={() =>
                        setAtlasRegion(
                          atlasRegion === region.id ? "all" : region.id,
                        )
                      }
                      className={`${expeditionProgress(region, progress).complete ? "earned" : ""} ${atlasRegion === region.id ? "chosen" : ""}`}
                      title={region.name}
                      aria-label={`Filtrar atlas por ${region.name}`}
                    >
                      <Leaf size={18} />
                      <span>{region.country}</span>
                      {expeditionProgress(region, progress).complete && (
                        <Check size={12} />
                      )}
                    </button>
                  ))}
                </div>
                <div className="search-field">
                  <Search size={16} />
                  <input
                    aria-label="Buscar en el atlas"
                    placeholder="Encontrar una especie…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <div className="atlas-filters">
                  <label>
                    <SlidersHorizontal size={14} />
                    <select
                      aria-label="Tipo de Pokémon en el atlas"
                      value={type}
                      onChange={(event) =>
                        setType(event.target.value as PokemonType | "")
                      }
                    >
                      <option value="">Todos los tipos</option>
                      {Object.entries(TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={atlasOnlyRegistered}
                      onChange={(event) =>
                        setAtlasOnlyRegistered(event.target.checked)
                      }
                    />
                    Registrados
                  </label>
                </div>
                <div className="atlas-grid">
                  {atlasEntries.map(({ encounter, region }) => {
                    const record = progress.records.find(
                      (item) => item.pokemonId === encounter.pokemonId,
                    );
                    return (
                      <button
                        className={`atlas-entry ${registeredIds.includes(encounter.pokemonId) ? "registered" : ""}`}
                        key={encounter.id}
                        onClick={() => selectEncounter(encounter, region)}
                      >
                        <span className="atlas-number">
                          #{String(encounter.pokemonId).padStart(3, "0")}
                          {registeredIds.includes(encounter.pokemonId) && (
                            <CheckCircle2 size={12} />
                          )}
                        </span>
                        <PokemonSprite
                          id={encounter.pokemonId}
                          name={encounter.name}
                        />
                        <strong>{encounter.name}</strong>
                        <span>
                          {registeredIds.includes(encounter.pokemonId)
                            ? `Registrado · ${record ? new Date(record.registeredAt).toLocaleDateString("es-AR", { day: "numeric", month: "short" }) : ""}`
                            : region.country}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {!atlasEntries.length && (
                  <div className="empty-state">
                    <Sprout />
                    <h3>Tu próximo descubrimiento te espera</h3>
                    <button
                      className="text-button"
                      onClick={() => {
                        setAtlasOnlyRegistered(false);
                        setAtlasRegion("all");
                        setType("");
                        setSearch("");
                      }}
                    >
                      Explorar el atlas completo
                    </button>
                  </div>
                )}
              </div>
            )}
            {tab === "weather" && (
              <WeatherPanel
                expedition={expedition}
                weather={weather.data}
                isLoading={weather.isPending}
                error={weather.isError}
                onRetry={() => {
                  void weather.refetch();
                }}
              />
            )}
          </aside>

          <button
            className="weather-glance"
            onClick={() => changeTab("weather")}
          >
            <span className="weather-glance-icon">
              <CloudSun size={25} strokeWidth={1.5} />
            </span>
            <span>
              <span className="eyebrow">
                EN {expedition.country.toUpperCase()}
              </span>
              <strong>
                {weather.data
                  ? `${Math.round(weather.data.temperature)}°`
                  : "—"}{" "}
                <small>
                  {weatherSummary?.label ??
                    (weather.isPending
                      ? "Consultando clima"
                      : "Clima no disponible")}
                </small>
              </strong>
            </span>
            <ArrowUpRight size={15} />
          </button>
          <div className="map-bottom">
            <div className="team-dock">
              <div className="dock-label">
                <span>Tu equipo de expedición</span>
                <button onClick={() => setTeamOpen(true)}>
                  {progress.team.length}/6
                  <ArrowUpRight size={13} />
                </button>
              </div>
              <div className="team-slots">
                {Array.from({ length: 6 }, (_, index) => {
                  const id = progress.team[index];
                  const found = allEncounters.find(
                    ({ encounter }) => encounter.pokemonId === id,
                  );
                  return (
                    <button
                      key={index}
                      className={id ? "occupied" : ""}
                      aria-label={
                        found
                          ? `Ver ${found.encounter.name} de tu equipo`
                          : `Lugar ${index + 1} disponible en tu equipo`
                      }
                      onClick={() =>
                        found
                          ? selectEncounter(found.encounter, found.region)
                          : setTeamOpen(true)
                      }
                    >
                      {found ? (
                        <PokemonSprite id={id} name={found.encounter.name} />
                      ) : (
                        <Plus size={17} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
        <footer className="app-footer">
          <span>
            <span className="status-dot" />
            Cinco expediciones · 30 especies
          </span>
          <button onClick={() => setAboutOpen(true)}>
            <Info size={12} />
            Acerca del proyecto
          </button>
          <span className="footer-credit">
            PokéAPI · OpenFreeMap · Open-Meteo
          </span>
        </footer>
        {storageError && (
          <div className="storage-warning" role="status">
            El navegador no permite guardar. Tu progreso dura esta sesión.
          </div>
        )}
        <AnimatePresence>
          {notice && (
            <motion.div
              className="toast"
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

        <Dialog.Root
          open={!!selected}
          onOpenChange={(open) => {
            if (!open) navigate(expedition.id, undefined, true);
          }}
          modal={false}
        >
          <Dialog.Portal>
            {selected && (
              <Dialog.Content
                className="detail-dialog"
                aria-describedby={undefined}
                onInteractOutside={(event) => event.preventDefault()}
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  originFocus.current?.focus();
                }}
              >
                <Dialog.Title className="sr-only">
                  Ficha de {selected.name}
                </Dialog.Title>
                <PokemonDetailPanel
                  key={selected.id}
                  encounter={selected}
                  expedition={expedition}
                  registered={registeredIds.includes(selected.pokemonId)}
                  inTeam={progress.team.includes(selected.pokemonId)}
                  teamFull={progress.team.length >= 6}
                  onRegister={registerSelected}
                  onToggleTeam={toggleSelectedTeam}
                  onClose={() => navigate(expedition.id, undefined, true)}
                  boostedTypes={boostedTypes}
                />
                <button className="share-detail" onClick={share}>
                  <Share2 size={14} />
                  Compartir encuentro
                </button>
              </Dialog.Content>
            )}
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
              <span className="eyebrow">
                CINCO HÁBITATS, UN MUNDO POR DESCUBRIR
              </span>
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
                    onClick={() => changeExpedition(region.id)}
                  >
                    <div className="destination-image">
                      <Image
                        src={region.image}
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
                        6 especies ·{" "}
                        {expeditionProgress(region, progress).registered}{" "}
                        registradas
                        <ArrowUpRight size={18} />
                      </p>
                    </div>
                  </button>
                ))}
              </div>
              <button
                className="world-button"
                onClick={() => {
                  setDestinationOpen(false);
                  setWorldView(true);
                }}
              >
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
