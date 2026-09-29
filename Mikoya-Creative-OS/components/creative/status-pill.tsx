import { CircleAlert, Hourglass, LoaderCircle } from "lucide-react";
import type { BatchStatus, VariantStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

const LABELS: Record<BatchStatus | VariantStatus, string> = {
  draft: "Draft",
  planned: "Planned",
  queued: "Queued",
  generating: "Generating",
  rendering: "Rendering",
  provider_pending: "Provider pending",
  complete: "Complete",
  failed: "Failed",
};

export function StatusPill({ status }: { status: BatchStatus | VariantStatus }) {
  if (status === "complete") {
    return (
      <Badge tone="forest">
        <span className="size-1.5 rounded-full bg-forest" />
        {LABELS[status]}
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge tone="danger">
        <CircleAlert />
        {LABELS[status]}
      </Badge>
    );
  }
  if (status === "provider_pending") {
    return (
      <Badge tone="warning">
        <Hourglass />
        {LABELS[status]}
      </Badge>
    );
  }
  return (
    <Badge tone="warning">
      <LoaderCircle className="animate-spin" />
      {LABELS[status]}
    </Badge>
  );
}
