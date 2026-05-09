import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type Role = "ADMIN" | "EDITOR" | "MERCHANT";

/**
 * Resuelve el prefijo de URL según locale para `redirect()` desde Server
 * Components / Server Actions. Con `localePrefix: "as-needed"` el default
 * `es` no lleva prefijo; `en` y `pt-BR` sí.
 */
function localePrefix(locale: string | undefined): string {
  if (!locale || locale === "es") return "";
  return `/${locale}`;
}

export type RequireRoleResult = {
  user: {
    id: string;
    role: Role;
    name: string;
    email: string;
  };
};

/**
 * Helper para layouts del admin: valida sesión + rol y devuelve el usuario.
 * Si no hay sesión → redirige a `/admin/login`.
 * Si el rol no está autorizado → redirige a `/admin/access-denied`.
 *
 * Usalo en cada layout/page que requiera roles específicos:
 *
 * ```ts
 * const { user } = await requireRole(["ADMIN", "EDITOR"], locale);
 * ```
 *
 * Defensa en profundidad: cada server action que mute datos también debe
 * llamar a `requireRole` independientemente — el layout puede no haberse
 * cargado en una invocación POST manual.
 */
export async function requireRole(
  allowed: Role[],
  locale?: string,
): Promise<RequireRoleResult> {
  const prefix = localePrefix(locale);
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect(`${prefix}/admin/login`);
  }

  const role = (session.user.role as Role | undefined) ?? "MERCHANT";
  if (!allowed.includes(role)) {
    redirect(`${prefix}/admin/access-denied`);
  }

  return {
    user: {
      id: session.user.id,
      role,
      name: session.user.name,
      email: session.user.email,
    },
  };
}

/**
 * Versión "soft" — devuelve null en vez de redirigir. Útil cuando una
 * server action quiere fallar con un error específico en vez de redirigir.
 */
export async function getCurrentUser(): Promise<RequireRoleResult["user"] | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const role = (session.user.role as Role | undefined) ?? "MERCHANT";
  return {
    id: session.user.id,
    role,
    name: session.user.name,
    email: session.user.email,
  };
}
