import type { Metadata } from "next"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

export const metadata: Metadata = {
  title: "循证保研 · 把每次准备都落到证据上",
  description: "面向计算机保研考核的调查、训练与复测工作台",
  icons: { icon: "/favicon.svg" },
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
