import type { Metadata } from "next"
import { Inter, Geist_Mono } from "next/font/google"
import "./globals.css"

import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { CommandMenu } from "@/components/command-menu"
import { WorkspaceProvider } from "@/lib/store"

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Meetspace — Chat & Issues in one place",
  description:
    "A fast, unified workspace for your team — Microsoft Teams style chat and Jira style boards, together.",
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
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
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
              <CommandMenu />
              <Toaster />
            </TooltipProvider>
          </WorkspaceProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
