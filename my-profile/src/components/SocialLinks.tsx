import type { ComponentType } from "react";
import { SOCIALS } from "@/lib/site";
import { GitHubIcon, LinkedInIcon } from "@/components/icons";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  LinkedIn: LinkedInIcon,
  GitHub: GitHubIcon,
};

type Variant = "icons" | "menu";

export default function SocialLinks({ variant = "icons" }: { variant?: Variant }) {
  if (variant === "menu") {
    return (
      <div className="mt-2 grid grid-cols-2 gap-2">
        {SOCIALS.map((s) => {
          const Icon = ICONS[s.label];
          return (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-text-secondary border border-border rounded-md px-3 py-2 hover:text-amber-600 hover:border-amber-500/60 transition-colors"
            >
              {Icon && <Icon className="w-4 h-4" />}
              {s.label}
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {SOCIALS.map((s) => {
        const Icon = ICONS[s.label];
        return (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.label}
            title={s.label}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary hover:text-amber-600 hover:border-amber-500/60 transition-colors"
          >
            {Icon && <Icon className="w-4 h-4" />}
          </a>
        );
      })}
    </div>
  );
}
