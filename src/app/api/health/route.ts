/*
  Liveness probe del contenedor. NO toca la DB a proposito.

  El healthcheck de docker-compose apuntaba a `/`, que es force-dynamic
  y corre dos queries Prisma por request. Con interval de 30s eso pegaba
  a Neon 2 veces por minuto las 24hs, y el compute nunca llegaba a
  auto-suspenderse (Neon suspende tras ~5 min de inactividad): facturaba
  continuo hasta agotar la cuota mensual del plan. Ver el incidente del
  14/07/2026 en los logs de la Pi (`XX000: compute time quota`).

  Un liveness check responde "el proceso Node esta vivo y sirviendo
  HTTP", nada mas. Chequear la DB aca seria contraproducente: una caida
  de Neon marcaria el contenedor unhealthy y lo reiniciaria en loop sin
  arreglar nada. La salud de la DB se mira en /admin/health, que es
  on-demand y con sesion.

  `force-dynamic` explicito para que no lo estatice ningun cambio futuro
  de caching (PPR / Cache Components): un health cacheado devolveria 200
  incluso con el server colgado.
*/
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
