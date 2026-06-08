import { PageHeader } from "@/components/page-header"
import { HomeOverview } from "@/components/home/overview"

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <PageHeader>
        <h1 className="text-sm font-semibold">Home</h1>
      </PageHeader>
      <HomeOverview />
    </div>
  )
}
