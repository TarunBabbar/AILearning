import { Button } from "@/components/ui/Button";
import { ArrowRight } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";

export async function CtaPanel() {
  const user = await getSessionUser();
  const href = user ? "/workspaces" : "/login";

  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-bg-surface to-bg-hover card-shadow-lg p-10 md:p-14 flex flex-col md:flex-row items-start md:items-center gap-8">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">See QAE2E in action</p>
            <h2 className="mt-2.5 text-3xl font-bold text-text-primary leading-tight">
              Turn your next requirement into release-ready QA intelligence.
            </h2>
            <p className="mt-3 max-w-xl text-text-secondary">
              Bring one story, one module, or one release process. Watch the six agents connect the
              dots from intent to evidence — with real, editable artifacts and a release-confidence gauge.
            </p>
          </div>
          <Button href={href} className="shrink-0">
            {user ? "My workspaces" : "Get started"} <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </section>
  );
}
