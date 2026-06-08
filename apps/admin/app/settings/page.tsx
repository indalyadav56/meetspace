import type { Metadata } from "next"

import { PageHeader } from "@/components/admin/page-header"
import { SettingsClient } from "@/components/admin/settings-client"

export const metadata: Metadata = { title: "Settings · Meetspace Admin" }

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure the platform and admin console."
      />
      <SettingsClient />
    </>
  )
}
