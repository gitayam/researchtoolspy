/**
 * Public Cross Table Page
 *
 * Read-only view of a shared cross table accessed via public token.
 * Full implementation will come with Task #10 (ResultsPanel).
 */

import { useParams } from 'react-router-dom'
import { Table2, Loader2 } from 'lucide-react'

export default function PublicCrossTablePage() {
  const { token } = useParams()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-gray-50">
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-8 max-w-lg w-full">
        <div className="rounded-full bg-muted p-6 mb-6 mx-auto w-fit">
          <Table2 className="h-12 w-12 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold mb-2">Shared Cross Table</h1>
        <p className="text-muted-foreground text-sm">
          This shared view is being built. The full results will be available here soon.
        </p>
      </div>
    </div>
  )
}
