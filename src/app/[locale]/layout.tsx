import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";

/**
 * Tipografía — ViajarPaís
 * - Fraunces (display): serif editorial con personalidad. Headings, marca,
 *   tags institucionales (e.g. "VERIFICADO"). Soft mode + óptica 9pt para
 *   sentido de "letterpress" sin caer en lo retro.
 * - Inter (body / UI): neutral, óptimo en tablas densas del admin y forms.
 *
 * Ambas con display: swap para evitar FOIT.
 */
const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
  display: "swap",
  // Variable font: omit `weight` so we can use the SOFT + opsz axes
  // for the editorial letterpress feel. weight + axes is mutually
  // exclusive in next/font/google.
  axes: ["SOFT", "opsz"],
});

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ViajarPaís",
  description: "Directorio nacional de turismo argentino",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
      data-density="comfortable"
    >
      <body className="min-h-full flex flex-col font-sans bg-canvas text-fg">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
