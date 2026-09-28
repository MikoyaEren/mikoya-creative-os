import type { Metadata } from "next";
import { Library } from "lucide-react";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Creative Library" };

export default function LibraryPage() {
  return (
    <PlaceholderPage
      title="Creative Library"
      description="Every approved creative across all products, searchable by mechanism, angle and performance."
      icon={Library}
      roadmap={[
        { title: "Approved creatives", description: "Save winners from any batch into a shared, tagged library." },
        { title: "Performance data", description: "Pull spend, CTR and ROAS per creative from ad platforms." },
        { title: "Remix winners", description: "Start a new generation from a proven concept and angle." },
      ]}
    />
  );
}
