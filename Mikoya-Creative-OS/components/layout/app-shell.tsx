"use client";

import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Logo, SidebarContent } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 border-r border-line bg-cream lg:block">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/25" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-[272px] border-r border-line bg-cream shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
              className="absolute top-5 right-3 flex size-9 items-center justify-center rounded-lg text-muted hover:bg-sand"
            >
              <X className="size-4" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-cream/90 px-4 backdrop-blur lg:hidden">
          <Logo />
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="flex size-9 items-center justify-center rounded-lg text-ink-soft hover:bg-sand"
          >
            <Menu className="size-5" />
          </button>
        </header>
        <main className="flex-1">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
