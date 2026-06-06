"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"
import { useMediaQuery } from "@/lib/use-media-query"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  // 탭바·FAB가 있는 lg 미만에서는 토스트를 FAB 위로 띄운다 — 우하단 토스트의
  // "되돌리기" 버튼이 FAB(bottom 4.5rem + 3rem 높이)에 가려지는 문제 방지
  // (모바일 UX 재평가 2026-06-07). 데스크톱은 기존 bottom-right 그대로.
  const hasTabBar = useMediaQuery("(max-width: 1023px)")
  const liftedOffset = { bottom: "calc(8.5rem + env(safe-area-inset-bottom))" }

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      offset={hasTabBar ? liftedOffset : undefined}
      mobileOffset={hasTabBar ? liftedOffset : undefined}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
