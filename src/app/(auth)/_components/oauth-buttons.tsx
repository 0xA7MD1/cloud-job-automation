import { Button } from "@/components/ui/button";
import { oauthAction } from "../actions";

const PROVIDERS = [
  { id: "google", label: "المتابعة بـGoogle" },
  { id: "microsoft", label: "المتابعة بـMicrosoft" },
] as const;

export function OAuthButtons({ next }: { next: string }) {
  return (
    <div className="flex flex-col gap-2">
      {PROVIDERS.map((provider) => (
        <form key={provider.id} action={oauthAction}>
          <input type="hidden" name="provider" value={provider.id} />
          <input type="hidden" name="next" value={next} />
          <Button type="submit" variant="outline" className="w-full">
            {provider.label}
          </Button>
        </form>
      ))}
    </div>
  );
}
