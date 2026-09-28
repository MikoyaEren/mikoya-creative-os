import { BookMarked, History, Library, Palette, Settings, Sparkles, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  ready: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/new", label: "New Generation", icon: Sparkles, ready: true },
  { href: "/generations", label: "Generations", icon: History, ready: true },
  { href: "/library", label: "Creative Library", icon: Library, ready: false },
  { href: "/recipes", label: "Recipes", icon: BookMarked, ready: false },
  { href: "/brand", label: "Brand", icon: Palette, ready: false },
  { href: "/settings", label: "Settings", icon: Settings, ready: false },
];
