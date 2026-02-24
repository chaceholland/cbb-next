import { Skeleton } from '@/components/ui/Skeleton';

export function RosterSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filter pills skeleton */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Count summary skeleton */}
      <Skeleton className="h-5 w-64 mb-6" />

      {/* Team tiles grid skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((team) => (
          <div
            key={team}
            className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex flex-col items-center gap-2">
              {/* Team logo skeleton */}
              <Skeleton className="h-14 w-14 rounded-full" />

              {/* Team name skeleton */}
              <Skeleton className="h-4 w-full" />

              {/* Pitcher count skeleton */}
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
