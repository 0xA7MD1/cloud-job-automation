import { Faq } from "./_components/faq";
import { Features } from "./_components/features";
import { FinalCta } from "./_components/final-cta";
import { Hero } from "./_components/hero";
import { HowItWorks } from "./_components/how-it-works";
import { Security } from "./_components/security";
import { WatchItApply } from "./_components/watch-it-apply";
import { WorksWith } from "./_components/works-with";

export default function Home() {
  return (
    <>
      <Hero />
      <WorksWith />
      <HowItWorks />
      <WatchItApply />
      <Features />
      <Security />
      <Faq />
      <FinalCta />
    </>
  );
}
