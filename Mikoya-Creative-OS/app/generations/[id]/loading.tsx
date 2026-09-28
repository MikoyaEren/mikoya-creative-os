import { PageContainer } from "@/components/layout/page-header";
import { CreativeCardSkeleton } from "@/components/creative/creative-card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageContainer className="max-w-[1400px]">
      <Skeleton className="h-10 w-80" />
      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => <CreativeCardSkeleton key={i} />)}
      </div>
    </PageContainer>
  );
}
