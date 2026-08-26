import LegalPage, { LegalSection } from "@/components/LegalPage";

export default function Privacy() {
  return (
    <LegalPage
      eyebrow="Your information"
      title="Privacy Policy"
      summary="This policy explains what SONIC CHECK collects, why we use it, who helps us process it and the choices available to you. It applies to soniccheck.io and the protected SONIC CHECK application."
      updated="26 August 2026"
    >
      <LegalSection title="1. What we collect">
        <p>
          We collect account information such as your name, email address, whether your email was verified by an identity provider, and account identifiers assigned by Clerk and your chosen sign-in provider. This verifies an account or email address; it is not proof of a person's real-world identity.
        </p>
        <p>
          If you choose Google sign-in, Clerk requests the <code>openid</code>, <code>email</code> and <code>profile</code> scopes. Depending on your Google profile, this can provide a stable Google account identifier, your email address and email-verification status, your name and a profile image. SONIC CHECK does not receive your Google password and does not request access to your Gmail, Google Drive, contacts or calendar.
        </p>
        <p>
          When you use the service, we may collect the audio, lyrics, titles, artist information and regional context you submit; the resulting evidence records and reports; your plan, entitlement and transaction status; support communications; and security, device and service-usage logs.
        </p>
      </LegalSection>

      <LegalSection title="2. How we use information">
        <p>
          We use information to create and protect accounts, provide originality-evidence screening, keep submissions and results associated with the correct customer, manage entitlements, provide support, prevent fraud and misuse, diagnose faults, maintain audit and security records, comply with law and improve the controlled-beta service.
        </p>
        <p>
          Identity-provider information is used for authentication and account security. It is not an input to audio matching, similarity scoring or evidence conclusions.
        </p>
      </LegalSection>

      <LegalSection title="3. Google sign-in data">
        <p>
          Clerk performs the Google OAuth exchange and manages the sign-in session. SONIC CHECK receives the resulting Clerk account subject, verified primary email and available name to create or synchronise the correct customer account. We use this information only for sign-in, account linking, account security, fraud prevention, customer support and displaying your account name.
        </p>
        <p>
          Clerk processes and stores the provider connection and session data needed to supply authentication. SONIC CHECK stores the corresponding internal account identifier, email, available name and provider-link metadata needed to maintain your account. Google sign-in data is not sold, used for advertising or shared with unrelated third parties. It is disclosed to Clerk, Google and our service infrastructure only as needed for these stated purposes, security or legal obligations.
        </p>
        <p>
          You can revoke SONIC CHECK's Google connection from your Google Account. Revocation prevents future use of that connection but does not by itself delete your SONIC CHECK account or information already retained for the purposes above. To request account-data deletion, contact us using the details below; the current beta deletion limits in section 5 apply.
        </p>
      </LegalSection>

      <LegalSection title="4. Audio, lyrics and public evidence records">
        <p>
          Raw audio and full lyric text are treated as private service inputs. The service is designed to restrict them to authenticated, account-owned routes and operational access controls. We do not intentionally add raw customer submissions to the public web application or a public reference catalogue.
        </p>
        <p>
          If you choose <strong>Share record</strong> and confirm publication, SONIC CHECK creates a public link that anyone with the link can view. It shows the submitted title and artist or creator name, regional context, whether audio or lyrics were submitted, screening status, analysis version, screening timestamp and public record or badge ID. It does not expose the raw audio, full lyric text or your account email. Avoid publishing a record whose displayed metadata you do not want to share.
        </p>
      </LegalSection>

      <LegalSection title="5. Retention and deletion during beta">
        <p>
          SONIC CHECK is in controlled private beta, and retention and physical-deletion evidence are not yet certified end to end. Deleting a scan or approving an account-data deletion request removes or tombstones the information from active customer access and triggers the available deletion process. Limited copies may remain temporarily in backups, security logs or provider systems for recovery, fraud prevention, dispute handling or legal obligations. We do not promise immediate physical erasure from every underlying system.
        </p>
        <p>
          We retain information only for as long as reasonably needed for the service, account security, documented evidence integrity and applicable obligations. You may ask about or request deletion of account data and associated public badge links; we will explain the action taken, any current technical limitation and any information that must still be retained.
        </p>
      </LegalSection>

      <LegalSection title="6. Service providers and overseas processing">
        <p>
          Our main providers include Clerk for identity and sessions; Google or GitHub when you choose their sign-in method; Cloudflare and GitHub Pages for web delivery and security; Render and contracted database or object-storage services for the protected application; Stripe for hosted payments; and authorised audio or metadata evidence services when a screening method requires them. They process information only for the relevant function, security or legal requirement. Their own obligations supplement and do not replace SONIC CHECK's responsibilities under applicable law.
        </p>
        <p>
          Information is processed in Australia and the United States and can transit or be processed in other countries where Google, Cloudflare or another named provider operates its distributed infrastructure. Hosting regions and sub-processors can change during beta. You may contact us for the current provider and location information relevant to your account. We limit information shared to what is reasonably required for the relevant service.
        </p>
      </LegalSection>

      <LegalSection title="7. Payments">
        <p>
          Where paid access is offered, payment-card details are entered directly into Stripe's hosted checkout. SONIC CHECK receives payment, customer and subscription identifiers and status, but not the complete card number or card security code. Paid public checkout remains closed unless the application expressly shows that it is available.
        </p>
      </LegalSection>

      <LegalSection title="8. Security and your choices">
        <p>
          We use authentication, encrypted connections, private-resource ownership checks and access controls intended to protect customer information. No online service can promise absolute security, so please use a secure account and tell us promptly if you suspect unauthorised access.
        </p>
        <p>
          You may request access to, correction of or deletion of personal information, withdraw from optional communications, or raise a privacy concern by emailing <a className="text-[#D4FF00] hover:underline" href="mailto:info@soniccheck.io">info@soniccheck.io</a>. We may need to verify your identity before acting on a request.
        </p>
      </LegalSection>

      <LegalSection title="9. Updates and contact">
        <p>
          We may update this policy as the beta, providers or legal obligations change. The effective date above identifies the current version. Material changes will be presented through the service or another reasonable channel.
        </p>
        <p>
          SONIC CHECK is a registered business name of Luke Damion Jobson, an Australian sole trader (ABN 96 117 672 789), with its main business location in Victoria 3072, Australia. Privacy questions, requests or complaints can be sent to <a className="text-[#D4FF00] hover:underline" href="mailto:info@soniccheck.io">info@soniccheck.io</a>.
        </p>
        <p>
          We will ordinarily acknowledge a privacy complaint within seven days and aim to provide a substantive response within 30 days. If more time is reasonably needed, we will explain why and provide an updated timeframe. If you remain dissatisfied, you may be able to complain to the Office of the Australian Information Commissioner.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
