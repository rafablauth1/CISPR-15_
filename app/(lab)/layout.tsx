export default function LabLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[1300px] mx-auto animate-fade-in">
      {children}
    </div>
  )
}
