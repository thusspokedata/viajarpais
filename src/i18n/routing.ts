import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "en", "pt-BR"] as const,
  defaultLocale: "es",
  localePrefix: "as-needed",
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
