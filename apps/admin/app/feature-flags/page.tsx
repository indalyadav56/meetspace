import type { Metadata } from "next"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/admin/page-header"
import { FeatureFlagsClient } from "@/components/admin/feature-flags-client"

export const metadata: Metadata = { title: "Feature flags · Meetspace Admin" }

export default function FeatureFlagsPage() {
  return (
    <>
      <PageHeader
        title="Feature flags"
        description="Roll features out gradually and toggle them across the platform."
      >
        <Button size="sm">
          <Plus />
          New flag
        </Button>
      </PageHeader>

      <FeatureFlagsClient />
    </>
  )
}
