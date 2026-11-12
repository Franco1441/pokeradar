"use client";

import { useState } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Compass, MapPin, X } from "lucide-react";
import type { ExpeditionPostcardData } from "@/lib/expedition-postcard";
import { getFieldSite } from "@/lib/field-sites";
import { artworkUrl, spriteUrl } from "@/lib/pokemon";
import type { Encounter, Expedition } from "@/lib/types";
import "./expedition-postcard.css";

export interface ExpeditionPostcardProps {
  postcard: ExpeditionPostcardData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  celebrate?: boolean;
  onCloseAutoFocus?: (event: Event) => void;
}

function PostcardArtwork({ encounter }: { encounter: Encounter }) {
  const [attempt, setAttempt] = useState(0);
  const sources = [
    artworkUrl(encounter.pokemonId),
    spriteUrl(encounter.pokemonId),
  ];
  const source = sources[attempt];

  if (!source) {
    return (
      <span className="postcard-artwork-fallback" aria-hidden="true">
        ?
      </span>
    );
  }

  // Keep the same official artwork → pixel sprite fallback used in field scenes.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={source}
      alt=""
      width={240}
      height={240}
      draggable={false}
      className={attempt === 1 ? "postcard-pixel-art" : undefined}
      onError={() => setAttempt((current) => current + 1)}
    />
  );
}

function PostcardLandscape({ expedition }: { expedition: Expedition }) {
  const [attempt, setAttempt] = useState(0);
  const sources = Array.from(
    new Set(
      [getFieldSite(expedition.id)?.image, expedition.image].filter(
        (source): source is string => Boolean(source),
      ),
    ),
  );
  const source = sources[attempt];

  if (!source) return null;
  return (
    <Image
      src={source}
      alt=""
      fill
      sizes="(max-width: 600px) 100vw, 600px"
      onError={() => setAttempt((current) => current + 1)}
    />
  );
}

export default function ExpeditionPostcard({
  postcard,
  open,
  onOpenChange,
  celebrate = false,
  onCloseAutoFocus,
}: ExpeditionPostcardProps) {
  const reducedMotion = useReducedMotion();
  if (!postcard) return null;
  const { expedition, completingEncounter } = postcard;
  const animateStamp = celebrate && !reducedMotion;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="postcard-overlay" />
        <Dialog.Content
          className="postcard-dialog"
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <div className="postcard-landscape">
            <PostcardLandscape key={expedition.id} expedition={expedition} />
            <div className="postcard-landscape-shade" />
            <span className="postcard-country">
              <MapPin size={13} aria-hidden="true" />
              {expedition.country}
            </span>
            <Dialog.Close className="postcard-close" aria-label="Cerrar postal">
              <X size={19} aria-hidden="true" />
            </Dialog.Close>
            <div className="postcard-location">
              <span>{expedition.biome}</span>
              <Dialog.Title>
                <span className="sr-only">Postal de </span>
                {expedition.name}
              </Dialog.Title>
            </div>
          </div>

          <div className="postcard-paper">
            <div className="postcard-heading">
              <div>
                <span className="postcard-kicker">Tu diario de campo</span>
                <h3>Una expedición para recordar.</h3>
                <Dialog.Description>
                  Registraste las especies y los tipos necesarios para completar
                  esta expedición.
                </Dialog.Description>
              </div>
              <motion.div
                key={`${expedition.id}-${postcard.completedAt}`}
                className="postcard-stamp"
                initial={
                  animateStamp ? { opacity: 0, scale: 1.6, rotate: -24 } : false
                }
                animate={{ opacity: 1, scale: 1, rotate: -10 }}
                transition={{
                  duration: animateStamp ? 0.45 : 0,
                  delay: animateStamp ? 0.12 : 0,
                  ease: [0.2, 0.85, 0.3, 1],
                }}
                aria-label="Expedición completada"
              >
                <span aria-hidden="true">PokéRadar</span>
                <Compass size={27} strokeWidth={1.5} aria-hidden="true" />
                <strong aria-hidden="true">Completada</strong>
              </motion.div>
            </div>

            <div className="postcard-finding">
              <div className="postcard-finding-copy">
                <span>El hallazgo que completó tu misión</span>
                <strong>{completingEncounter.name}</strong>
                <time dateTime={postcard.completedAt}>
                  {postcard.localDate}
                </time>
                <small>Fecha local de {expedition.country}</small>
              </div>
              <div className="postcard-featured-artwork">
                <PostcardArtwork
                  key={completingEncounter.id}
                  encounter={completingEncounter}
                />
              </div>
            </div>

            <ul className="postcard-goals" aria-label="Objetivos completados">
              <li>
                <Check size={15} aria-hidden="true" />
                <span>
                  <strong>{postcard.registeredCount}</strong> especies
                  registradas
                </span>
              </li>
              <li>
                <Check size={15} aria-hidden="true" />
                <span>
                  <strong>{postcard.typeCount}</strong> tipos descubiertos
                </span>
              </li>
            </ul>

            <div className="postcard-collection">
              <h3>Los encuentros de esta postal</h3>
              <ul>
                {postcard.encounters.map((encounter) => (
                  <li key={encounter.id}>
                    <div>
                      <PostcardArtwork encounter={encounter} />
                    </div>
                    <span>{encounter.name}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="postcard-footer">
              <p>Guardada en tu atlas.</p>
              <Dialog.Close className="postcard-continue">
                Seguir explorando <ArrowRight size={16} aria-hidden="true" />
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
