import { Skeleton } from "@/components/ui/skeleton";
export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      <Skeleton className="h-8 w-48" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_,i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      {[...Array(rows)].map((_,i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
    </div>
  );
}
