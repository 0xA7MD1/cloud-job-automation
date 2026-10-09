"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAV } from "@/components/app-nav";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

/** الروابط بدون تمييز الصفحة الحالية: تظهر في الغلاف الثابت لين يوصل المسار. */
export function NavLinksView({ pathname }: { pathname: string | null }) {
  const { isMobile, setOpenMobile } = useSidebar();
  return APP_NAV.map((group) => (
    <SidebarGroup key={group.label}>
      <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {group.items.map(({ href, label, icon: Icon }) => {
            const active = !!pathname && (pathname === href || pathname.startsWith(`${href}/`));
            return (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  className="h-9 rounded-lg data-active:bg-foreground/10"
                >
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => isMobile && setOpenMobile(false)}
                  >
                    <Icon aria-hidden />
                    <span>{label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ));
}

/** usePathname قيمة وقت الطلب في المسارات الديناميكية ⇒ داخل <Suspense> في الغلاف. */
export function NavLinks() {
  return <NavLinksView pathname={usePathname()} />;
}
