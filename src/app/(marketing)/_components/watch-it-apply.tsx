import { Stage } from "@/components/stage";
import { SectionHeading } from "./section-heading";
import { WatchDemo } from "./watch-demo";

export function WatchItApply() {
  return (
    <section id="watch" aria-labelledby="watch-title" className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
      <SectionHeading
        id="watch-title"
        eyebrow="شوفه يقدّم"
        title={
          <>
            توافق على الطلب.
            <br />
            وتشوفه يتقدّم.
          </>
        }
        description="كل خطوة تظهر لك وهي تصير. ولو طلب الموقع كود أو طلعت كابتشا ما انحلت، يوقف ويخليك تكمّل من البث الحي."
      />
      <div data-reveal className="mt-12">
        <Stage className="p-3 sm:p-6">
          <WatchDemo />
        </Stage>
      </div>
    </section>
  );
}
