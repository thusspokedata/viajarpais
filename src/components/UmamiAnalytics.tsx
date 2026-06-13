import Script from "next/script";

/*
  <UmamiAnalytics /> — tracker de Umami self-hosted en VPS.

  Server Component. Renderea un <Script> que se inyecta en el cliente
  con strategy "afterInteractive" — carga despues de hydration sin
  bloquear el render.

  Gates de visibilidad:

  1. Solo en production. `NODE_ENV` lo setea Next en build. En dev
     (`npm run dev`), staging local (`npm run build` corrido local) o
     CI no se inyecta — evita contar pageviews fake.

  2. data-domains hace que el tracker Umami SOLO emita desde el
     dominio configurado (default `viajarpais.com.ar`). Si la app
     accidentalmente se sirve desde IP, preview, otro dominio, etc.,
     Umami descarta las requests del lado del servidor.

  3. Si no hay `NEXT_PUBLIC_UMAMI_WEBSITE_ID` ni el default
     hardcodeado (caso fork sin Umami), el componente returns null.

  Privacidad: Umami es cookieless por diseno — no setea cookies, no
  guarda IPs, no construye perfiles personales. La pagina de
  privacidad puede mencionarlo (analytics self-hosted en servidor
  propio UE, sin cookies, sin almacenar IPs, solo datos agregados;
  base legal interes legitimo art. 6.1.f).

  Env vars (todas opcionales, defaults hardcoded para que funcione
  out-of-the-box en prod sin config extra):

  - NEXT_PUBLIC_UMAMI_SRC: URL del script. Default
    `https://umami.lahuelladelcaminante.de/script.js`. Override solo
    si se mueve la instancia Umami a otro host.

  - NEXT_PUBLIC_UMAMI_WEBSITE_ID: ID del sitio en el dashboard de
    Umami. Default `c4e449ca-23ed-4399-a599-96d39c661328` para
    viajarpais.com.ar. Override en forks o instancias separadas.

  - NEXT_PUBLIC_UMAMI_DOMAINS: dominios autorizados a emitir
    pageviews. Default `viajarpais.com.ar`. Si el sitio tambien
    sirve en www., setear `viajarpais.com.ar,www.viajarpais.com.ar`.

  Nota: NEXT_PUBLIC_* se congela en BUILD TIME, no runtime. Si el
  pipeline corre `next build` en una maquina distinta a donde estan
  las env vars, hay que setearlas en la build env (Vercel,
  GitHub Actions, Docker BUILD arg, etc.).

  CSP: si en el futuro se agrega Content-Security-Policy via nginx
  o middleware, hay que whitelistear:
    script-src  https://umami.lahuelladelcaminante.de
    connect-src https://umami.lahuelladelcaminante.de
  Sin esto, en enforcement el script no postea pageviews.
*/

const UMAMI_SRC =
  process.env.NEXT_PUBLIC_UMAMI_SRC ??
  "https://umami.lahuelladelcaminante.de/script.js";

const UMAMI_WEBSITE_ID =
  process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ??
  "c4e449ca-23ed-4399-a599-96d39c661328";

const UMAMI_DOMAINS =
  process.env.NEXT_PUBLIC_UMAMI_DOMAINS ?? "viajarpais.com.ar";

export function UmamiAnalytics() {
  if (process.env.NODE_ENV !== "production") return null;
  if (!UMAMI_WEBSITE_ID) return null;

  return (
    <Script
      src={UMAMI_SRC}
      data-website-id={UMAMI_WEBSITE_ID}
      data-domains={UMAMI_DOMAINS}
      strategy="afterInteractive"
    />
  );
}
