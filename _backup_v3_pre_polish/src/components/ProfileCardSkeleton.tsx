export const ProfileCardSkeleton = () => {
    return (
        <div className="relative bg-black/80 backdrop-blur-sm border border-zinc-800/50 rounded-xl p-4 animate-pulse overflow-hidden">
            {/* Shimmer effect */}
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-zinc-700/10 to-transparent" />

            <div className="relative flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-2.5">
                    {/* Profile Name & Latency */}
                    <div className="flex items-center gap-3">
                        <div className="h-5 w-32 bg-zinc-800/50 rounded" />
                        <div className="h-6 w-16 bg-zinc-800/50 rounded-md" />
                    </div>

                    {/* Address & Protocol */}
                    <div className="flex items-center gap-2.5">
                        <div className="h-7 w-48 bg-zinc-800/50 rounded-md" />
                        <div className="h-6 w-16 bg-zinc-800/50 rounded-md" />
                    </div>

                    {/* Security Info */}
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-zinc-700" />
                        <div className="h-4 w-12 bg-zinc-800/50 rounded" />
                        <div className="w-1 h-1 rounded-full bg-zinc-700" />
                        <div className="h-4 w-12 bg-zinc-800/50 rounded" />
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5">
                    <div className="w-8 h-8 bg-zinc-800/50 rounded-lg" />
                    <div className="w-8 h-8 bg-zinc-800/50 rounded-lg" />
                    <div className="w-8 h-8 bg-zinc-800/50 rounded-lg" />
                    <div className="w-8 h-8 bg-zinc-800/50 rounded-lg" />
                </div>
            </div>
        </div>
    )
}
