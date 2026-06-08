import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { WorkspaceProvider } from "@/lib/store"

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Meetspace — Teams & Tasks",
  description:
    "A calm, fast home for your team's work. Organize teams, plan tasks, and ship together.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <WorkspaceProvider>
            <TooltipProvider delayDuration={300}>
              <SidebarProvider>
                <AppSidebar />
                <SidebarInset className="min-w-0">{children}</SidebarInset>
              </SidebarProvider>
              <Toaster />
            </TooltipProvider>
          </WorkspaceProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
