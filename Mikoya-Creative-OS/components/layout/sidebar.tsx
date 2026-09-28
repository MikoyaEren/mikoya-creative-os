"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBatches } from "@/lib/store/generations-store";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

export function Logo() {
  return (
    <Link href="/new" className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-[9px] bg-forest font-serif text-lg leading-none text-cream">
        m
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[13px] font-semibold tracking-[0.14em] text-ink">MIKOYA</span>
        <span className="mt-1 text-[11px] tracking-wide text-muted">Creative OS</span>
      </span>
    </Link>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const batches = useBatches();
  const recent = batches.slice(0, 4);

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-6 pb-8">
        <Logo />
      </div>

      <nav aria-label="Main" className="flex flex-col gap-0.5 px-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] transition-colors",
                active ? "bg-paper font-medium text-ink shadow-[0_1px_2px_rgba(20,20,19,0.06)] ring-1 ring-line" : "text-ink-soft hover:bg-sand/70 hover:text-ink",
              )}
            >
              <Icon className={cn("size-4", active ? "text-forest" : "text-muted group-hover:text-ink-soft")} />
              <span className="flex-1">{item.label}</span>
              {!item.ready && <span className="text-[10px] tracking-wide text-faint uppercase">Soon</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-10 px-6">
        <p className="text-[11px] font-medium tracking-[0.12em] text-faint uppercase">Recent</p>
        <ul className="mt-3 flex flex-col gap-0.5">
          {recent.map((b) => (
            <li key={b.id}>
              <Link
                href={`/generations/${b.id}`}
                onClick={onNavigate}
                className={cn(
                  "-mx-3 flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] text-ink-soft transition-colors hover:bg-sand/70 hover:text-ink",
                  pathname === `/generations/${b.id}` && "text-ink",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    b.status === "complete" ? "bg-forest" : b.status === "failed" ? "bg-danger" : "bg-faint",
                  )}
                />
                <span className="truncate">{b.product.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto border-t border-line px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-sand text-xs font-medium text-ink-soft">
            MK
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-medium">Mikoya Team</p>
            <p className="text-[11px] text-muted">Internal · v0.1</p>
          </div>
        </div>
      </div>
    </div>
  );
}
