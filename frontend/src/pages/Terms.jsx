import LegalPage, { LegalSection } from "@/components/LegalPage";

export default function Terms() {
  return (
    <LegalPage
      eyebrow="Service agreement"
      title="Terms of Use"
      summary="These terms govern access to soniccheck.io and the SONIC CHECK controlled-beta application. By creating an account or using the service, you agree to them."
      updated="26 August 2026"
    >
      <LegalSection title="1. The service">
        <p>
          SONIC CHECK provides traceable candidate evidence across available recording-identity, lyric-overlap and governed composition-screening methods. Outputs support qualified human review. They are not automatic determinations of authorship, originality, ownership, plagiarism, infringement, legal clearance or admissibility.
        </p>
        <p>
          The service is in controlled private beta. Features, providers, catalogue coverage, limits and availability may change as security and evidence controls are fortified. A method that is unavailable or degraded must not be treated as a clean negative result.
        </p>
      </LegalSection>

      <LegalSection title="2. Accounts and security">
        <p>
          You must be at least 18 years old and have legal capacity to agree to these terms. If you use the service for an organisation, you must be authorised to bind it. You must provide accurate account information, take reasonable steps to secure your sign-in methods, use only accounts you are authorised to control and notify us promptly if you suspect unauthorised access.
        </p>
        <p>
          Responsibility for unauthorised activity is allocated according to its cause and applicable law; you are not responsible to the extent it was caused by a SONIC CHECK security failure or another event outside your reasonable control. We may pause or restrict access where reasonably necessary to protect customers, investigate misuse, comply with law or preserve service integrity. Ordinary customer accounts do not receive administrative privileges merely because of the email address or sign-in provider used.
        </p>
      </LegalSection>

      <LegalSection title="3. Your submissions">
        <p>
          You retain your rights in material you submit. You give SONIC CHECK and its service providers a limited permission to receive, store, transform and analyse that material only as reasonably needed to provide, secure and support the service and meet legal obligations.
        </p>
        <p>
          You must have the legal right to submit the material and must not use the service to expose another person's confidential information, distribute unlawful content, evade security controls, overload the service or test material for a prohibited or deceptive purpose.
        </p>
      </LegalSection>

      <LegalSection title="4. Evidence use">
        <p>
          You must review the evidence record, source status, version, confidence and limitations before relying on an output. Do not present a SONIC CHECK result as a legal verdict or as proof that a work is cleared for release. Professional, legal or rights-holder advice may still be required.
        </p>
        <p>
          If you choose <strong>Share record</strong> and confirm publication, the public verification page shows the submitted title and artist or creator name, region, audio and lyric submission flags, screening status, analysis version, screening timestamp and public record or badge ID to anyone with the link. It does not expose the raw audio, full lyric text or account email. Publication does not transfer ownership or certify copyright clearance.
        </p>
      </LegalSection>

      <LegalSection title="5. Plans and payments">
        <p>
          Current plans, AUD prices, inclusions and checkout availability are shown by the service before purchase. Paid public checkout is unavailable unless expressly enabled. If a paid plan is offered, any renewal cadence, cancellation path, taxes and material conditions will be shown before you confirm payment.
        </p>
      </LegalSection>

      <LegalSection title="6. Availability and responsibility">
        <p>
          We aim to provide a secure and dependable service, but beta functionality can be interrupted, delayed or changed. Each party is responsible, to the extent provided by applicable law, for loss caused by its breach, negligence or wilful misconduct. To the maximum extent permitted by law, SONIC CHECK is not responsible for loss caused by your failure to follow stated evidence limitations, by incomplete source coverage that the service clearly identifies, or by events outside its reasonable control.
        </p>
        <p>
          Nothing in these terms excludes, restricts or modifies a consumer guarantee, right or remedy that cannot lawfully be excluded under the Australian Consumer Law or another applicable law.
        </p>
      </LegalSection>

      <LegalSection title="7. Changes, governing law and contact">
        <p>
          We may update these terms prospectively as the service develops. We will provide reasonable advance notice of material changes and will not apply them retrospectively. If you do not agree, you may stop using or cancel the affected service before the change takes effect. Price or renewal changes apply only to a purchase or renewal after the notified effective date. A change required urgently for security or law may take effect sooner only to the extent reasonably necessary.
        </p>
        <p>
          These terms are between you and Luke Damion Jobson, trading as SONIC CHECK (ABN 96 117 672 789). They are governed by the laws of Victoria, Australia. Questions or notices may be sent to <a className="text-[#D4FF00] hover:underline" href="mailto:info@soniccheck.io">info@soniccheck.io</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
