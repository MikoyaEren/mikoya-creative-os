import { BatchResultsView } from "@/components/creative/batch-results-view";

export default async function GenerationResultPage({ params, searchParams }: PageProps<"/generations/[id]">) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  return <BatchResultsView id={id} isNew={isNew === "1"} />;
}
