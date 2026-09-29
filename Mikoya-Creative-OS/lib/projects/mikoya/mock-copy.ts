import type { MechanismId } from "@/lib/types";
import type { CopyLine, MockCopyBank } from "@/lib/mock/concept-templates";

/**
 * MIKOYA PROJECT DATA — hand-written mock concept copy.
 *
 * Simulates what the concept writer would return for Mikoya. It is project
 * data, not application logic: other projects use the generic templates in
 * lib/mock/concept-templates.ts. `p` = product name, `b` = brand name.
 */
type CopyFn = (p: string, b: string) => CopyLine[];

const COPY: Record<MechanismId, CopyFn> = {
  x_post: (p) => [
    { hook: "switched my 3pm coffee for matcha and suddenly i'm the calm one in the group chat", sub: `${p} — the calm kind of energy.` },
    { hook: "nobody talks about how matcha people just have their life together", sub: "Join them. It starts with one whisk." },
  ],
  imessage: (p) => [
    { hook: "ok what are you drinking every morning, you seem different", sub: `it's ${p} lol. i'll send you the link` },
    { hook: "wait is this the matcha from your story??", sub: "yes and I'm not sharing my tin, buy your own 🍵" },
  ],
  dont_buy_this: () => [
    { hook: "Don't buy this.", sub: "Unless you want mornings that feel like yours again." },
    { hook: "Seriously, don't.", sub: "You'll never go back to jittery coffee. We warned you." },
  ],
  notes_app: () => [
    { hook: "things that fixed my mornings", sub: "1. phone stays in the kitchen\n2. 10 min walk\n3. matcha instead of coffee #2" },
    { hook: "2026 non-negotiables", sub: "- sleep before 11\n- move daily\n- ceremonial matcha, not the dusty stuff" },
  ],
  dm_conversation: (p) => [
    { hook: "hiii where is your matcha from? it looks SO green", sub: `${p}! code in bio 💚` },
    { hook: "be honest is it worth it", sub: "i've reordered 4 times. that's my review." },
  ],
  search_bar: () => [
    { hook: "how to have energy without coffee crash", sub: "matcha vs coffee · calm focus drink · best ceremonial matcha" },
    { hook: "why does matcha taste like grass", sub: "because yours isn't ceremonial grade" },
  ],
  lock_screen: (p) => [
    { hook: "Reminder: your 8am matcha ritual 🍵", sub: `${p} · now` },
    { hook: "Your tin is running low", sub: "Restock before Monday hits." },
  ],
  pov: () => [
    { hook: "POV: you finally found a morning ritual you actually look forward to", sub: "Whisk. Sip. Breathe." },
    { hook: "POV: it's 3pm and you're still focused", sub: "No crash. Just calm." },
  ],
  confession: () => [
    { hook: "Confession: I used to think matcha was just a trend.", sub: "Then I tried ceremonial grade. Different story." },
    { hook: "I didn't quit coffee. I just stopped needing it.", sub: "Matcha did that quietly." },
  ],
  hot_take: () => [
    { hook: "Hot take: your morning coffee is making you more tired.", sub: "Swap one cup. See what happens." },
    { hook: "Hot take: bad matcha ruined matcha for everyone.", sub: "Taste what it's supposed to be." },
  ],
  red_green_flag: () => [
    { hook: "🚩 matcha that tastes bitter · 🟢 matcha that tastes like umami", sub: "Know your flags." },
    { hook: "🚩 3 coffees before noon · 🟢 one bowl of matcha", sub: "Upgrade your ritual." },
  ],
  starter_pack: () => [
    { hook: "The 'I have my life together' starter pack", sub: "Linen set · pilates · ceremonial matcha" },
    { hook: "The slow morning starter pack", sub: "Whisk · ceramic bowl · 10 quiet minutes" },
  ],
  checklist: () => [
    { hook: "Your morning, upgraded", sub: "✓ calm energy\n✓ no crash\n✓ 2 minutes to make\n✓ tastes smooth" },
    { hook: "What's in a good matcha?", sub: "✓ shade-grown\n✓ stone-ground\n✓ first harvest\n✓ vivid green" },
  ],
  receipt: () => [
    { hook: "TOTAL: one better morning", sub: "calm focus ×1\nno 3pm crash ×1\nritual ×30 days" },
    { hook: "Cost per cup: less than your oat latte", sub: "30 servings · ceremonial grade · 0 regrets" },
  ],
  breaking_news: (p) => [
    { hook: "BREAKING: Local woman stops needing a second coffee", sub: `Sources confirm: ${p} involved.` },
    { hook: "BREAKING: Matcha that actually tastes good exists", sub: "More at 8am." },
  ],
  missing_poster: () => [
    { hook: "MISSING: my afternoon crash", sub: "Last seen before I switched to matcha. Not looking for it." },
    { hook: "MISSING: my coffee jitters", sub: "If found, please keep them." },
  ],
  dictionary: () => [
    { hook: "match·a·ry (n.)", sub: "The state of calm, clear focus after your morning bowl." },
    { hook: "whisk·ful (adj.)", sub: "Looking forward to tomorrow morning already." },
  ],
  choose_your_fighter: () => [
    { hook: "Choose your fighter", sub: "Iced matcha latte · Classic usucha · Matcha tonic" },
    { hook: "Which matcha girl are you?", sub: "Morning ritual · Desk hero · Post-pilates" },
  ],
  things_that_make_sense: () => [
    { hook: "Things that just make sense", sub: "Sunday resets · clean sheets · matcha at 8am" },
    { hook: "Some things just go together", sub: "Oat milk + ceremonial matcha. Obviously." },
  ],
  friend_recommendation: () => [
    { hook: "My friend made me try this and now I'm annoying about it", sub: "Consider this your sign." },
    { hook: "Me recommending matcha to everyone I've ever met", sub: "It's a public service at this point." },
  ],
  unpopular_opinion: () => [
    { hook: "Unpopular opinion: matcha is better than coffee.", sub: "We'll wait while you try it." },
    { hook: "Unpopular opinion: a slow morning is productive.", sub: "Start it with a whisk." },
  ],
  relationship_status: (p) => [
    { hook: "Relationship status: committed", sub: `Me & ${p}, every morning since March.` },
    { hook: "It's not a phase. It's a relationship.", sub: "Coffee knows. Coffee's fine." },
  ],
  warning_label: () => [
    { hook: "WARNING", sub: "May cause: calm focus, unsolicited recommendations, fewer coffee runs." },
    { hook: "SIDE EFFECTS", sub: "Glowing mornings · a new favourite ritual · friends asking what changed" },
  ],
  membership_card: (_p, b) => [
    { hook: `${b} Matcha Club`, sub: "Member since today · Morning ritual tier" },
    { hook: "The Slow Morning Society", sub: "Perks: calm energy, zero crash, better days" },
  ],
  us_vs_them: () => [
    { hook: "Old morning vs. new morning", sub: "Scrolling in bed → one bowl, one whisk, ten quiet minutes." },
  ],
  calendar: () => [
    { hook: "30 mornings, 30 matchas", sub: "Watch the habit build itself." },
    { hook: "Day 1 vs Day 30", sub: "Consistency tastes better." },
  ],
  review: () => [
    { hook: "“I didn't expect to cry over matcha but here we are.”", sub: "★★★★★ — Lena, verified buyer" },
    { hook: "“Smooth, zero bitterness. Replaced my coffee in a week.”", sub: "★★★★★ — Marie, verified buyer" },
  ],
  product_hero: (p) => [
    { hook: "Grown in shade. Ground in stone.", sub: p },
    { hook: "The green you've been missing.", sub: `${p} — first harvest.` },
  ],
  lifestyle: () => [
    { hook: "Mornings, but slower.", sub: "Your ritual, reimagined." },
    { hook: "The 8am pause.", sub: "Made for mornings that matter." },
  ],
  claymation: () => [
    { hook: "A sleepy clay coffee cup gets replaced by a glowing matcha bowl", sub: "Calm energy, handmade." },
    { hook: "Clay characters whisking matcha on a tiny tea ceremony set", sub: "Tiny ritual, big mornings." },
  ],
  ai_ugc: (p) => [
    { hook: "“Okay I need to talk about the matcha that replaced my coffee…”", sub: `Creator unboxes ${p} and makes her first bowl.` },
    { hook: "“3 reasons I stopped drinking coffee (and what I drink instead)”", sub: "Talking-head, kitchen counter, morning light." },
  ],
};

export const MIKOYA_MOCK_COPY: MockCopyBank = Object.fromEntries(
  Object.entries(COPY).map(([id, fn]) => [id, (c: { product: string; brand: string }) => fn(c.product, c.brand)]),
);

export const MIKOYA_MOCK_CTAS = [
  "Start your ritual",
  "Shop the ritual",
  "Try it for 30 days",
  "Find your matcha",
];
