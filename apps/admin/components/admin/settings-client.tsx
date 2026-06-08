"use client"

import * as React from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const NOTIFICATIONS = [
  { id: "n1", label: "Failed payments", description: "Alert when a workspace payment fails.", on: true },
  { id: "n2", label: "New enterprise signups", description: "Notify the team about large new accounts.", on: true },
  { id: "n3", label: "Trial ending soon", description: "Daily digest of trials expiring this week.", on: false },
  { id: "n4", label: "Security events", description: "Suspensions, key rotations, and login anomalies.", on: true },
]

export function SettingsClient() {
  const [name, setName] = React.useState("Meetspace")
  const [supportEmail, setSupportEmail] = React.useState("support@meetspace.app")
  const [region, setRegion] = React.useState("us-east")
  const [tagline, setTagline] = React.useState(
    "A calm, fast home for your team's work.",
  )
  const [notifications, setNotifications] = React.useState(NOTIFICATIONS)

  const toggleNotification = (id: string) =>
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, on: !n.on } : n)),
    )

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Platform identity and defaults.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Platform name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Support email</Label>
              <Input
                id="email"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Textarea
              id="tagline"
              rows={2}
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">Default region</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger id="region" className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="us-east">US East</SelectItem>
                <SelectItem value="us-west">US West</SelectItem>
                <SelectItem value="eu-west">EU West</SelectItem>
                <SelectItem value="ap-south">AP South</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Choose which platform events reach the admin team.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-border divide-y p-0">
          {notifications.map((n) => (
            <div key={n.id} className="flex items-center gap-4 px-6 py-4">
              <div className="flex-1 space-y-0.5">
                <Label className="text-sm font-medium">{n.label}</Label>
                <p className="text-muted-foreground text-sm">{n.description}</p>
              </div>
              <Switch
                checked={n.on}
                onCheckedChange={() => toggleNotification(n.id)}
                aria-label={`Toggle ${n.label}`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>
            Irreversible actions that affect the whole platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Enable maintenance mode</p>
              <p className="text-muted-foreground text-sm">
                Temporarily take the platform offline for all users.
              </p>
            </div>
            <Button variant="outline" size="sm">
              Enable
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Purge deleted data</p>
              <p className="text-muted-foreground text-sm">
                Permanently remove soft-deleted records older than 30 days.
              </p>
            </div>
            <Button variant="destructive" size="sm">
              Purge
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button>Save changes</Button>
      </div>
    </div>
  )
}
