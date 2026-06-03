import { PublicFooter, PublicHeader } from "@/components/public";
import { TooltipProvider } from "@/components/ui";

/*
  Layout publico — wrapper de PublicHeader + main + PublicFooter para
  todas las paginas bajo el route group (public).

  TooltipProvider envuelve el arbol entero porque componentes publicos
  como TranslationDisclaimer (commit 6 + M6 fix) usan Radix Tooltip y
  funcionan con defaults coordinados (delayDuration, dismiss-on-pointer
  compartido) cuando hay Provider.

  delayDuration 300ms — match con el patron del admin.
*/
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <PublicHeader />
      <main className="flex flex-1 flex-col">{children}</main>
      <PublicFooter />
    </TooltipProvider>
  );
}
