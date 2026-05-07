import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function AdminLayout({ children, params }: Props) {
  const { locale } = await params;
  const prefix = locale === "es" ? "" : `/${locale}`;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect(`${prefix}/admin/login`);
  }

  if (session.user.role !== "ADMIN") {
    redirect(`${prefix}/`);
  }

  return (
    <main className="flex flex-1 flex-col p-8">{children}</main>
  );
}
