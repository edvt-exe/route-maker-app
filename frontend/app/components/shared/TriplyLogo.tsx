import Link from "next/link";

export default function TriplyLogo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.24em] text-white">
      <span className="grid size-9 place-items-center rounded-full border border-cyan-300/40 bg-cyan-300/10 text-cyan-200 transition-transform duration-300 group-hover:rotate-12">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-current" strokeWidth="1.8">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M8.5 15.5 10.3 10l5.2-1.8-1.8 5.3-5.2 2Z" />
          <circle cx="12" cy="12" r="1.2" className="fill-current stroke-none" />
        </svg>
      </span>
      Triply
    </Link>
  );
}
