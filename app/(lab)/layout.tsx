import LabSidebar from '@/components/LabSidebar'
import { TitleBar } from '@/app/TitleBar'

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <TitleBar />
      <div className="flex flex-1 min-h-0">
        <LabSidebar />
        <main className="flex-1 min-w-0 dot-grid overflow-auto">
          <div className="p-6 max-w-[1400px] mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
