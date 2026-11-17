"use client";

import { useState } from "react";
import { animatedSpriteUrl, spriteUrl } from "@/lib/pokemon";

interface PokemonSpriteProps {
  id: number;
  name: string;
  className?: string;
  width?: number;
  height?: number;
  alt?: string;
}

export default function PokemonSprite(props: PokemonSpriteProps) {
  return <SpriteImage key={props.id} {...props} />;
}

function SpriteImage({
  id,
  name,
  className = "",
  width = 80,
  height = 80,
  alt = "",
}: PokemonSpriteProps) {
  const [state, setState] = useState<"animated" | "static" | "failed">("animated");
  const still = spriteUrl(id);

  if (state === "failed") {
    return (
      <span
        className={`sprite-fallback ${className}`}
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
      >
        {name.slice(0, 2)}
      </span>
    );
  }

  return (
    <picture style={{ display: "contents" }}>
      <source media="(prefers-reduced-motion: reduce)" srcSet={still} />
      {/* The picture element preserves GIF animation and selects still frames for reduced motion. */}
      <img
        className={className}
        src={state === "animated" ? animatedSpriteUrl(id) : still}
        alt={alt}
        width={width}
        height={height}
        draggable={false}
        decoding="async"
        data-pokemon-sprite={id}
        onError={(event) => {
          const failedSource = event.currentTarget.currentSrc || event.currentTarget.src;
          setState(failedSource === still ? "failed" : "static");
        }}
      />
    </picture>
  );
}
