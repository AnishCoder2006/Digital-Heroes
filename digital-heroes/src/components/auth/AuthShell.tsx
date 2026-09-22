import { LogoMark } from "../Logo";

export function AuthShell({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[0.8fr_1.2fr] lg:py-16">
      <aside className="relative hidden overflow-hidden rounded-blob bg-violet p-10 text-white lg:block">
        <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-marigold" aria-hidden="true" />
        <div className="absolute -bottom-10 -left-10 h-44 w-44 rounded-full bg-rose" aria-hidden="true" />
        <div className="relative flex h-full flex-col justify-end">
          <LogoMark size={48} />
          <p className="mt-6 font-display text-4xl font-extrabold leading-tight">Every round can do some good.</p>
        </div>
      </aside>
      <div className="rounded-blob bg-white p-8 shadow-sm ring-1 ring-ink/5 sm:p-12">
        <h1 className="text-4xl font-extrabold">{title}</h1>
        <p className="mt-2 text-ink-soft">{intro}</p>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
