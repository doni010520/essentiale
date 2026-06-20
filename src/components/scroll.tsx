export function Scroll({ children }: { children: React.ReactNode }) {
  return <div className="h-full overflow-y-auto px-6 pb-8">{children}</div>;
}
