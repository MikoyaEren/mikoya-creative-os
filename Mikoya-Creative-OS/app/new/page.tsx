import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { NewGenerationForm } from "@/components/generation/new-generation-form";

export const metadata: Metadata = { title: "Create Ads" };

export default function NewGenerationPage() {
  return (
    <PageContainer className="max-w-[1080px]">
      <PageHeader
        eyebrow="New generation"
        title="Create Ads"
        description="Turn one product into dozens of creative concepts — each delivered in 1:1 and 9:16."
      />
      <NewGenerationForm />
    </PageContainer>
  );
}
