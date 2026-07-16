import CompilerNav from "./CompilerNav";

export default function CompilerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto max-w-5xl px-6 pt-12 pb-24">
      <CompilerNav />
      {children}
    </div>
  );
}
