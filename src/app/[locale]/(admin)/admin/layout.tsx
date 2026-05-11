import { requireRole } from "@/lib/authz";
import { AdminToaster } from "@/components/admin/AdminToaster";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function AdminLayout({ children, params }: Props) {
  const { locale } = await params;
  await requireRole(["ADMIN", "EDITOR"], locale);

  return (
    <main className="flex flex-1 flex-col p-8">
      {children}
      {/*
        Toaster montado al final del layout admin. `sonner` portalea su
        contenedor a `document.body`, así que la posición visual no
        depende del orden en el árbol — solo del position prop. Lo
        ponemos acá para que cualquier route admin pueda llamar a
        `toast.success(...)` sin re-montar el provider.
      */}
      <AdminToaster />
    </main>
  );
}
