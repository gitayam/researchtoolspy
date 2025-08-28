'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function FrameworkCardSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-4 w-full mt-2" />
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <Skeleton className="h-10 w-full mt-4" />
      </CardContent>
    </Card>
  )
}

export function FrameworkListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <FrameworkCardSkeleton key={i} />
      ))}
    </div>
  )
}