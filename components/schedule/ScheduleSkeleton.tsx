import { Skeleton } from '@/components/ui/Skeleton';

export function ScheduleSkeleton() {
  return (
    <div className="space-y-6">
      {/* Search + filter controls skeleton */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Week header skeleton */}
      {[1, 2, 3].map((week) => (
        <div key={week} className="space-y-3">
          {/* Week title */}
          <div className="flex items-center gap-3 w-full">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-px flex-1" />
            <Skeleton className="h-4 w-4" />
          </div>

          {/* Game cards skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((game) => (
              <div
                key={game}
                className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="space-y-3">
                  {/* Date/status */}
                  <Skeleton className="h-4 w-32" />

                  {/* Away team */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <Skeleton className="h-5 w-32" />
                    </div>
                    <Skeleton className="h-6 w-8" />
                  </div>

                  {/* Home team */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <Skeleton className="h-5 w-32" />
                    </div>
                    <Skeleton className="h-6 w-8" />
                  </div>

                  {/* Venue */}
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
