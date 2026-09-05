import { AutomationSection } from "./automation-section"
import { FeaturesSection } from "./features-section"
import { InsightsSection } from "./insights-section"
import { LandingFaq, LandingFooter } from "./landing-footer"
import { LandingHeader } from "./landing-header"
import { LandingHero } from "./landing-hero"
import { LandingSmoothScroll } from "./landing-smooth-scroll"
import { LandingStatement } from "./landing-statement"
import { PricingSection } from "./pricing-section"
import { WorkflowSection } from "./workflow-section"
import { ProductTour } from "./product-tour"
import styles from "./landing.module.css"

export function LandingPage() {
  return (
    <LandingSmoothScroll>
      <div className={styles.page}>
        <a
          href="#main-content"
          className="sr-only fixed top-3 left-3 z-[100] rounded-lg bg-white px-4 py-3 text-sm focus:not-sr-only"
        >
          İçeriğe geç
        </a>
        <LandingHeader />
        <main id="main-content">
          <LandingHero />
          <LandingStatement />
          <WorkflowSection />
          <ProductTour />
          <FeaturesSection />
          <AutomationSection />
          <InsightsSection />
          <PricingSection />
          <LandingFaq />
        </main>
        <LandingFooter />
      </div>
    </LandingSmoothScroll>
  )
}
