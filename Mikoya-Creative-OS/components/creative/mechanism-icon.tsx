import {
  AtSign, Ban, BookOpen, Box, CalendarDays, Clapperboard, Eye, Flag, Flame, Heart, IdCard, Lightbulb,
  ListChecks, Megaphone, MessageCircle, MessageSquareQuote, Newspaper, Package, Receipt, Scale, Search,
  SearchX, Send, Columns2, Smartphone, Star, StickyNote, Sun, Swords, TriangleAlert, Video, type LucideIcon,
} from "lucide-react";
import type { MechanismId } from "@/lib/types";

export const MECHANISM_ICONS: Record<MechanismId, LucideIcon> = {
  x_post: AtSign,
  imessage: MessageCircle,
  dont_buy_this: Ban,
  notes_app: StickyNote,
  dm_conversation: Send,
  search_bar: Search,
  lock_screen: Smartphone,
  pov: Eye,
  confession: MessageSquareQuote,
  hot_take: Flame,
  red_green_flag: Flag,
  starter_pack: Package,
  checklist: ListChecks,
  receipt: Receipt,
  breaking_news: Newspaper,
  missing_poster: SearchX,
  dictionary: BookOpen,
  choose_your_fighter: Swords,
  things_that_make_sense: Lightbulb,
  friend_recommendation: Megaphone,
  unpopular_opinion: Scale,
  relationship_status: Heart,
  warning_label: TriangleAlert,
  membership_card: IdCard,
  us_vs_them: Columns2,
  calendar: CalendarDays,
  review: Star,
  product_hero: Box,
  lifestyle: Sun,
  claymation: Clapperboard,
  ai_ugc: Video,
};

export function MechanismIcon({ id, className }: { id: MechanismId; className?: string }) {
  const Icon = MECHANISM_ICONS[id];
  return <Icon className={className} />;
}
