export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="flex flex-1 flex-col">{children}</main>;
}
