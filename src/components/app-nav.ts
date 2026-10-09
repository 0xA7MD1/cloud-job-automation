import {
  BriefcaseBusinessIcon,
  FileCheck2Icon,
  FolderOpenIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  MessageSquareTextIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react";

// روابط التطبيق بمجموعاتها: الشريط الجانبي في (app)، ونسخة الواجهة الوهمية في الصفحة الرئيسية.
// ملف عادي (مو "use client") عشان مكوّنات الخادم تقرأ القيم نفسها.
export const APP_NAV: readonly { label: string; items: readonly { href: string; label: string; icon: LucideIcon }[] }[] = [
  {
    label: "الشغل",
    items: [
      { href: "/dashboard", label: "الرئيسية", icon: LayoutDashboardIcon },
      { href: "/chat", label: "الشات", icon: MessageSquareTextIcon },
      { href: "/jobs", label: "الوظائف", icon: BriefcaseBusinessIcon },
      { href: "/applications", label: "الطلبات", icon: FileCheck2Icon },
    ],
  },
  {
    label: "الحساب",
    items: [
      { href: "/files", label: "ملفاتي", icon: FolderOpenIcon },
      { href: "/profile", label: "ملفي", icon: UserRoundIcon },
      { href: "/settings/keys", label: "المفاتيح", icon: KeyRoundIcon },
    ],
  },
];
