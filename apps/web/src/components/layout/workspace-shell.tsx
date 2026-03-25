"use client"

import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import { AppShell } from "@/src/components/layout/app-shell"

function getPageCopy(pathname: string) {
  if (pathname === "/") {
    return {
      title: "厨房采购台",
      description: "把最近买过的商品、购物记录和回购判断放到同一个工作区里。"
    }
  }

  if (pathname === "/imports/new") {
    return {
      title: "导入订单",
      description: "上传订单截图后，系统会自动解析订单内容，确认后即可完成导入。"
    }
  }

  if (pathname.startsWith("/imports/")) {
    return {
      title: "导入订单",
      description: "确认平台、下单时间和商品内容后，一键完成订单导入。"
    }
  }

  if (pathname === "/products/new") {
    return {
      title: "新增商品",
      description: "手动补录商品主档，作为后续订单和截图导入的统一归档对象。"
    }
  }

  if (pathname.endsWith("/edit") && pathname.startsWith("/products/")) {
    return {
      title: "编辑商品",
      description: "维护商品分类、标签、库存和备注，保持商品主库稳定可用。"
    }
  }

  if (pathname.startsWith("/products/")) {
    return {
      title: "商品详情",
      description: "查看这个商品的基础档案、最近订单和各平台最近一次已知成交价。"
    }
  }

  if (pathname.startsWith("/products")) {
    return {
      title: "商品库",
      description: "按分类、平台、标签和库存状态浏览统一商品主库。"
    }
  }

  if (pathname === "/orders/new") {
    return {
      title: "新增订单",
      description: "手动补录一次购物记录，把价格与商品关联沉淀下来。"
    }
  }

  if (pathname.endsWith("/edit") && pathname.startsWith("/orders/")) {
    return {
      title: "编辑订单",
      description: "当前版本只维护订单级字段，商品项仍保持为原始订单事实。"
    }
  }

  if (pathname.startsWith("/orders/")) {
    return {
      title: "订单详情",
      description: "回看某次采购买了什么、花了多少钱，以及原始订单截图。"
    }
  }

  if (pathname.startsWith("/orders")) {
    return {
      title: "购物记录",
      description: "按时间和平台浏览每次购物，快速回看采购内容。"
    }
  }

  return {
    title: "工作区",
    description: "继续管理你的商品库与购物记录。"
  }
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const copy = getPageCopy(pathname)
  const hideWorkspaceHeader = pathname === "/" || pathname === "/imports/new" || pathname.startsWith("/imports/")

  return (
    <AppShell
      title={copy.title}
      description={copy.description}
      hideWorkspaceHeader={hideWorkspaceHeader}
    >
      {children}
    </AppShell>
  )
}
