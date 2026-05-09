"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import { Button, cn } from "@/components/ui";

export function ListingsPagination({
  page,
  pageCount,
  total,
  pageSize,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (pageCount <= 1) {
    return (
      <div className="text-[var(--text-xs)] text-[var(--text-muted)] py-1">
        {total} ficha{total === 1 ? "" : "s"}
      </div>
    );
  }

  function goTo(p: number) {
    const next = new URLSearchParams(searchParams.toString());
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    const qs = next.toString();
    router.push(qs ? `/admin/listings?${qs}` : "/admin/listings");
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const pages = pageNumbers(page, pageCount);

  return (
    <div className="flex items-center justify-between gap-4 py-2 text-[var(--text-xs)] text-[var(--text-muted)]">
      <span>
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={page === 1}
          onClick={() => goTo(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span
              key={`gap-${i}`}
              className="px-2 text-[var(--text-muted)] select-none"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => goTo(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                "min-w-7 h-7 px-2 rounded-[var(--radius-sm)] text-[var(--text-xs)] font-medium",
                "transition-colors focus:outline-none focus-visible:shadow-[var(--shadow-focus)]",
                p === page
                  ? "bg-[var(--brand-muted)] text-[var(--brand-muted-fg)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]",
              )}
            >
              {p}
            </button>
          ),
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={page === pageCount}
          onClick={() => goTo(page + 1)}
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function pageNumbers(current: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const result: Array<number | "…"> = [1];
  if (current > 3) result.push("…");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    result.push(p);
  }
  if (current < total - 2) result.push("…");
  result.push(total);
  return result;
}
