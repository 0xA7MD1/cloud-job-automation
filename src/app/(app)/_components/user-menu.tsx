import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { signOutAction } from "../../(auth)/actions";

export async function UserMenu() {
  const user = await requireUser();
  const initial = (user.name || user.email || "؟").trim().charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-2 rounded-xl border border-hairline bg-background/50 p-2">
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-sm font-semibold text-background"
      >
        {initial}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        {user.name && <span className="truncate text-sm font-medium">{user.name}</span>}
        <span className="truncate text-xs text-muted-foreground" dir="ltr">
          {user.email}
        </span>
      </div>
      <form action={signOutAction}>
        <Button type="submit" variant="ghost" size="icon-sm" aria-label="خروج" title="خروج">
          <LogOutIcon className="rtl:-scale-x-100" aria-hidden />
        </Button>
      </form>
    </div>
  );
}
