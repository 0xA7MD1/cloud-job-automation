import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { signOutAction } from "../../(auth)/actions";

export async function UserMenu() {
  const user = await requireUser();
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden text-muted-foreground sm:inline" dir="ltr">
        {user.email}
      </span>
      <form action={signOutAction}>
        <Button type="submit" variant="ghost" size="sm">
          <LogOutIcon data-icon="inline-start" aria-hidden />
          خروج
        </Button>
      </form>
    </div>
  );
}
