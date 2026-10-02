"use client";

import { useState, useEffect } from "react";

export function useCoverColor(imageUrl?: string | null) {
  const [dominantRgb, setDominantRgb] = useState<string>("20, 184, 166");

  useEffect(() => {
    if (!imageUrl) {
      setDominantRgb("20, 184, 166");
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = 1;
        canvas.height = 1;
        // Skalowanie całego obrazu do 1x1 piksela daje idealną średnią barwę okładki
        ctx.drawImage(img, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;

        // Jeśli kolor jest za ciemny, lekko go podbijamy
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        if (brightness < 40) {
          setDominantRgb(`${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 70)}`);
        } else {
          setDominantRgb(`${r}, ${g}, ${b}`);
        }
      } catch {
        // W razie restrykcji CORS na CDN Youtube/Spotify
        setDominantRgb("20, 184, 166");
      }
    };
  }, [imageUrl]);

  return dominantRgb;
}