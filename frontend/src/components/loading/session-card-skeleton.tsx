'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function SessionCardSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-4 w-full mt-2" />
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm mb-4">
          <div className="flex items-center gap-1">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 w-16" />
        </div>
      </CardContent>
    </Card>
  )
}

export function SessionListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <SessionCardSkeleton key={i} />
      ))}
    </div>
  )
}