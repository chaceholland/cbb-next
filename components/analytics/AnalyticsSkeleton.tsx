import { Skeleton } from '@/components/ui/Skeleton';

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-8">
      {/* Conference filter skeleton */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 dark:bg-slate-800 dark:border-slate-700">
        <Skeleton className="h-3 w-24 mb-2" />
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((stat) => (
          <div
            key={stat}
            className="rounded-2xl border-2 border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"
          >
            <Skeleton className="h-3 w-20 mb-1" />
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Roster sizes chart skeleton */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 dark:bg-slate-800 dark:border-slate-700">
          <Skeleton className="h-5 w-48 mb-4" />
          <div className="space-y-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-4 flex-1 rounded-full" />
                <Skeleton className="h-3 w-6" />
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Position distribution skeleton */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 dark:bg-slate-800 dark:border-slate-700">
            <Skeleton className="h-5 w-40 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <div className="flex justify-between mb-1">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-3 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Class year breakdown skeleton */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 dark:bg-slate-800 dark:border-slate-700">
            <Skeleton className="h-5 w-36 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i}>
                  <div className="flex justify-between mb-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-3 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Conference table skeleton */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 dark:bg-slate-800 dark:border-slate-700">
        <Skeleton className="h-5 w-48 mb-4" />
        <div className="space-y-2">
          {/* Table header */}
          <div className="flex items-center border-b border-slate-100 pb-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16 ml-auto mr-4" />
            <Skeleton className="h-3 w-16 mr-4" />
            <Skeleton className="h-3 w-16" />
          </div>
          {/* Table rows */}
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center py-2.5 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <Skeleton className="h-2.5 w-2.5 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-4 w-8 ml-auto mr-4" />
              <Skeleton className="h-4 w-12 mr-4" />
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
