'use client'

import LabSidebar from '@/components/LabSidebar'
import { TitleBar } from '@/app/TitleBar'

export function RootClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <TitleBar />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <LabSidebar />
        <main className="flex-1 min-w-0 overflow-auto dot-grid">
          {children}
        </main>
      </div>
    </div>
  )
}
