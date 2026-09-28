import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { buttonClasses } from "@/components/ui/button";
import { GenerationsList } from "@/components/generations/generations-list";

export const metadata: Metadata = { title: "Generations" };

export default function GenerationsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="History"
        title="Generations"
        description="Every creative batch you've run, newest first."
        actions={
          <Link href="/new" className={buttonClasses({ variant: "secondary" })}>
            <Plus /> New generation
          </Link>
        }
      />
      <GenerationsList />
    </PageContainer>
  );
}
