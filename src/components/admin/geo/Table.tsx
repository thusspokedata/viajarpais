import * as React from "react";

/*
  Helpers de tabla compartidos por los listados admin de geo
  (regions/provinces/departments/localities). Antes vivían inline en
  `provinces/page.tsx` y se duplicaban como strings de clase en los
  otros listados. Los lifteamos acá para que las 4 pantallas usen el
  mismo Th/Td y queden alineadas visualmente sin esfuerzo.

  Diseño: variantes mínimas. `className` se acumula al fondo (no
  reemplaza) para que el caller pueda agregar `text-right` o `max-w-xs`
  sin pelearse con los tokens base. No abstraemos el `<table>` ni
  `<tbody>` — quedan en cada page para que el shape del row (qué
  columnas, qué orden, qué links) sea explícito en el archivo del
  listado.
*/

export function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`text-left font-medium px-4 py-2.5 text-[10px] font-display uppercase tracking-[var(--tracking-caps)] ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 align-top ${className ?? ""}`}>{children}</td>
  );
}
