import { requireRole } from "@/lib/authz";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function AdminLayout({ children, params }: Props) {
  const { locale } = await params;
  await requireRole(["ADMIN", "EDITOR"], locale);

  return <main className="flex flex-1 flex-col p-8">{children}</main>;
}
