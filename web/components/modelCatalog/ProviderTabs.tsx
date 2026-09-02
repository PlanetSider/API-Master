import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"

import { CatalogVendorMark } from "./CatalogVendorMark"
import type { ProviderCatalogEntry } from "./types"

interface ProviderTabsProps {
  providers: ProviderCatalogEntry[]
  value: string
  totalCount: number
  unclassifiedCount: number
  children: ReactNode
  onChange: (value: string) => void
}

export function ProviderTabs({
  providers,
  value,
  totalCount,
  unclassifiedCount,
  children,
  onChange,
}: ProviderTabsProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const [scrollState, setScrollState] = useState({ left: false, right: false })
  const updateScrollState = () => {
    const element = listRef.current
    if (!element) return
    setScrollState({
      left: element.scrollLeft > 2,
      right: element.scrollLeft + element.clientWidth < element.scrollWidth - 2,
    })
  }

  useEffect(() => {
    updateScrollState()
    window.addEventListener("resize", updateScrollState)
    return () => window.removeEventListener("resize", updateScrollState)
  }, [providers, totalCount, unclassifiedCount])

  const tabs = [
    {
      value: "",
      label: `所有厂商 (${totalCount})`,
      icon: <LayoutGrid className="size-4" />,
    },
    ...providers.map((provider) => ({
      value: provider.key,
      label: `${provider.label} (${provider.count})`,
      icon: <CatalogVendorMark vendor={provider.label} variant="compact" />,
    })),
    ...(unclassifiedCount > 0
      ? [
          {
            value: "__unclassified__",
            label: `未分类 (${unclassifiedCount})`,
            icon: <CatalogVendorMark variant="compact" />,
          },
        ]
      : []),
  ]

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <button
          type="button"
          aria-label="向左滚动厂商标签"
          disabled={!scrollState.left}
          onClick={() =>
            listRef.current?.scrollBy({ left: -260, behavior: "smooth" })
          }
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-35 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div
          ref={listRef}
          role="tablist"
          onScroll={updateScrollState}
          className="scrollbar-hide flex min-w-0 flex-1 touch-pan-x gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
        >
          {tabs.map((tab) => (
            <button
              key={tab.value || "all"}
              type="button"
              role="tab"
              aria-selected={tab.value === value}
              onClick={() => onChange(tab.value)}
              className={`flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm leading-5 font-medium transition-all ${
                tab.value === value
                  ? "bg-white text-blue-700 shadow dark:bg-gray-900 dark:text-blue-400"
                  : "text-gray-700 hover:bg-white/60 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-900/60 dark:hover:text-white"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="向右滚动厂商标签"
          disabled={!scrollState.right}
          onClick={() =>
            listRef.current?.scrollBy({ left: 260, behavior: "smooth" })
          }
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-35 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      {children}
    </div>
  )
}
