interface SkeletonProps {
    className?: string
}

const Skeleton = ({ className = '' }: SkeletonProps) => (
    <div className={`animate-pulse bg-zinc-800/50 rounded ${className}`} />
)

export const StatsCardSkeleton = () => (
    <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
            <Skeleton className="w-4 h-4 rounded-full" />
            <Skeleton className="w-20 h-3" />
        </div>
        <Skeleton className="w-24 h-8 mb-1" />
        <Skeleton className="w-32 h-3" />
    </div>
)

export const ProfileCardSkeleton = () => (
    <div className="p-3 rounded-md border border-border bg-background">
        <div className="flex items-center gap-3">
            <Skeleton className="w-4 h-4 rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                    <Skeleton className="w-32 h-4" />
                    <Skeleton className="w-16 h-6 rounded-full" />
                </div>
                <Skeleton className="w-48 h-3" />
            </div>
        </div>
    </div>
)

export const SettingRowSkeleton = () => (
    <div className="flex items-center justify-between py-3">
        <div className="flex-1">
            <Skeleton className="w-40 h-4 mb-2" />
            <Skeleton className="w-64 h-3" />
        </div>
        <Skeleton className="w-11 h-6 rounded-full" />
    </div>
)

export const GraphSkeleton = () => (
    <div className="bg-surface border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
            <Skeleton className="w-32 h-5" />
            <Skeleton className="w-24 h-4" />
        </div>
        <div className="space-y-2">
            <Skeleton className="w-full h-40 rounded" />
            <div className="flex justify-between">
                <Skeleton className="w-16 h-3" />
                <Skeleton className="w-16 h-3" />
                <Skeleton className="w-16 h-3" />
                <Skeleton className="w-16 h-3" />
            </div>
        </div>
    </div>
)

export const LoadingSkeleton = {
    StatsCard: StatsCardSkeleton,
    ProfileCard: ProfileCardSkeleton,
    SettingRow: SettingRowSkeleton,
    Graph: GraphSkeleton
}
