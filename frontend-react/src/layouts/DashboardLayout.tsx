import { Outlet } from 'react-router-dom'

export function DashboardLayout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            ResearchTools Dashboard
          </h1>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}