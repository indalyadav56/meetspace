import { PageHeader } from "@/components/page-header"
import { CommandCenter } from "@/components/dashboard/command-center"

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-svh bg-background/50">
      <PageHeader>
        <h1 className="text-sm font-semibold">Home</h1>
      </PageHeader>
      <CommandCenter />
    </div>
  )
}
