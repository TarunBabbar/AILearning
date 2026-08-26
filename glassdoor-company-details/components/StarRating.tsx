"use client";

import { useId } from "react";

/**
 * StarRating renders rating (0–5) as SVG stars, supporting half-fill via an
 * inline clip path with a unique gradient id per instance.
 */
export default function StarRating({
  rating,
  size = 16,
  showValue = true,
}: {
  rating: number;
  size?: number;
  showValue?: boolean;
}) {
  const uid = useId();
  const clipId = `star-clip-${uid.replace(/[:]/g, "")}`;
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex" role="img" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <svg
            key={i}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            className="relative"
            aria-hidden="true"
          >
            {/* base (empty) star */}
            <path
              d="M12 2l2.9 6.26 6.6.72-4.9 4.49 1.34 6.53L12 16.77 6.06 20l1.34-6.53-4.9-4.49 6.6-.72L12 2z"
              fill="#ddd0af"
            />
            {/* filled overlay clipped to pct width */}
            <clipPath id={clipId}>
              <rect width={size * (pct / 100)} height={size} x={0} y={0} />
            </clipPath>
            <g clipPath={`url(#${clipId})`}>
              <path
                d="M12 2l2.9 6.26 6.6.72-4.9 4.49 1.34 6.53L12 16.77 6.06 20l1.34-6.53-4.9-4.49 6.6-.72L12 2z"
                fill="#e0a63e"
              />
            </g>
          </svg>
        ))}
      </span>
      {showValue && (
        <span className="text-sm font-semibold text-coffee">{rating.toFixed(1)}</span>
      )}
    </span>
  );
}