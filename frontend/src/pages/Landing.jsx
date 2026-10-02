import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LANDING } from "@/constants/testIds";
import CommercialLicenseNotice from "@/components/CommercialLicenseNotice";
import { api } from "@/lib/api";
import { commercialLicenseState } from "@/lib/productContract.mjs";
import { mountResonanceEffects } from "@/lib/resonanceEffects";
import sculpture from "@/assets/resonance-sculpture.webp";
import "@/pages/Resonance.css";

const asset = path => `${process.env.PUBLIC_URL || ""}${path}`;
const aud = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });
// Research inventory, 22 September 2026; never used as the active coverage count.
const RESEARCH_CATALOGUE = { acousticRecords: 7541578, symbolicReferences: 71196, additions: 70, vectorsPerView: 1011117 };

export default function Landing() {
  const rootRef = useRef(null);
  const { isSignedIn } = useAuth();
  const [contract, setContract] = useState(null);
  const [catalogue, setCatalogue] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => mountResonanceEffects(rootRef.current), []);
  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([
      api.get("/product-contract", { signal: controller.signal }),
      api.get("/catalogue/manifest", { signal: controller.signal }),
    ]).then(([contractResult, catalogueResult]) => {
      if (controller.signal.aborted) return;
      if (contractResult.status === "fulfilled") setContract(contractResult.value.data);
      if (catalogueResult.status === "fulfilled") setCatalogue(catalogueResult.value.data);
      setDataLoaded(true);
    });
    return () => controller.abort();
  }, []);

  const plans = contract?.pricing?.plans || [];
  const activeProfiles = catalogue?.coverage_summary?.comparison_eligible_entries;
  const paidOpen = commercialLicenseState(contract).checkoutOpen;

  return (
<div ref={rootRef} id="sc-resonance-positioning">

<svg className="sc-warp-defs" xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true" focusable="false" style={{"position": "absolute", "width": "0", "height": "0", "overflow": "hidden"}}>
<defs>
<filter id="sc-hero-weight" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
<feMorphology in="SourceGraphic" operator="dilate" radius="0.45" />
</filter>
<filter id="sc-resonance-detail" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
<feConvolveMatrix order="3" kernelMatrix="0 -0.15 0 -0.15 1.6 -0.15 0 -0.15 0" divisor="1" edgeMode="duplicate" preserveAlpha="true" />
</filter>
</defs>
</svg>
<div className="sc-review"><b>Controlled private beta</b><span>Candidate evidence · Human review required</span></div>

<main>

<section className="sc-hero sc-wrap" id="sc4-home" aria-labelledby="sc4-title">
<p className="sc-overline">Audio analytics for the pre-release stage.</p>
<h1 className="sc-heading" id="sc4-title">Originality,<br /><span>Verified.</span></h1>
<p className="sc-hero-intro">Audio analytics for musically minded creators. Our HARRY analyser flags potential similarities to existing works in available reference catalogues, helping you document evidence for qualified human review before release.</p>
<div className="sc-actions">
              <Link className="sc-button" to={isSignedIn ? "/app/scan/new" : "/join"} data-testid={LANDING.heroCta}>{isSignedIn ? "Open the analyser" : "Join SONIC CHECK"}</Link>
              <Link className="sc-button sc-button-secondary" to={isSignedIn ? "/app" : "/login"} data-testid={LANDING.heroSecondaryCta}>{isSignedIn ? "My dashboard" : "Log in"}</Link>
              <a className="sc-explore-link" href="#sc4-analyzer">Explore the analyser</a>
            </div>
<figure className="sc-orbit"><div className="sc-orbit-visual" aria-hidden="true"><div className="sc-orbit-core"><img className="sc-orbit-image" src={sculpture} width="1254" height="1254" alt="" aria-hidden="true" /><div className="sc-neural-field" aria-hidden="true">
<i style={{"--node-x": "25.28%", "--node-y": "27.91%", "--node-delay": "-1.8s"}}></i>
<i style={{"--node-x": "51.20%", "--node-y": "10.40%", "--node-delay": "-3.4s"}}></i>
<i style={{"--node-x": "64.67%", "--node-y": "49.44%", "--node-delay": "-.7s"}}></i>
<i style={{"--node-x": "82.14%", "--node-y": "53.75%", "--node-delay": "-2.7s"}}></i>
<i style={{"--node-x": "46.97%", "--node-y": "77.59%", "--node-delay": "-4.4s"}}></i>
<i style={{"--node-x": "36.44%", "--node-y": "66.03%", "--node-delay": "-.2s"}}></i>
</div>
<div className="sc-orbit-tint"></div><div className="sc-orbit-stage-tint"></div></div><span className="sc-neural-halo" aria-hidden="true"></span>
</div><figcaption><span>SONIC CHECK V37<br />Music evidence analysis</span><span>Six components<br />One contextual view</span></figcaption></figure>
<div className="sc-orbit-tools" aria-label="Resonance colour and motion preview">
<div className="sc-orbit-state-row">
<p className="sc-orbit-state" id="sc4-colour-state" role="status" aria-live="polite">11-colour breathing spectrum · colour preview</p>
<button className="sc-motion-button" id="sc4-pause-shape" type="button" aria-pressed="false">Pause effects</button>
</div>
<details className="sc-stage-preview">
<summary>Preview analysis-stage colours</summary>
<p>Preview component colours or play the sequence. No analysis is running.</p>
<div className="sc-stage-fields">
<label htmlFor="sc4-stage-select">Colour mode
        <select id="sc4-stage-select" aria-describedby="sc4-colour-state">
<option value="ambient">11-colour breathing spectrum</option>
<option value="recording_identity">Recording identity · teal</option>
<option value="lyric_overlap">Exact lyric overlap · gold</option>
<option value="composition_similarity">Composition similarity · blue</option>
<option value="relational_specificity">Relational Specificity · mint</option>
<option value="lyric_order_recovery">Lyric Order Recovery · lilac</option>
<option value="interval_path_specificity">Interval Path Specificity · rose</option>
</select>
</label>
<button className="sc-stage-play" id="sc4-play-stages" type="button" aria-pressed="false">Play stage preview</button>
</div>
</details>
</div>
</section>

<section className="sc-chapter sc-light" id="sc4-about" aria-labelledby="sc4-about-title"><div className="sc-wrap">
<div className="sc-chapter-head"><p className="sc-overline">01 / About SONIC CHECK</p><h2 id="sc4-about-title"><span className="sc-chromatic">Built for creators.<br />Before the release.</span></h2></div>
<div className="sc-about-grid"><p className="sc-about-note">Understand possible similarities before your music reaches the world.</p><div>
<div className="sc-prose"><div><p>SONIC CHECK is an audio analytics software developer created to assist musically minded creators: songwriters, performers, producers, students and creative teams.</p><p>Designed for the pre-release stage, our HARRY analyser checks submitted audio—and lyrics when supplied—against available reference catalogues. It flags potential similarities to existing recordings and musical works.</p></div><div><p>Candidate matches and alignments can be inspected, documented and referred for qualified human review, helping you make informed decisions about your next steps.</p><p>SONIC CHECK was born from a deep desire to protect creative integrity and intellectual property. Our ambition is to connect creators with relevant evidence from historical and contemporary music worldwide.</p></div></div>
<p className="sc-founder">Founded by Luke Damion. Guided by creative respect, accountability and integrity: clear methods, traceable evidence and room for human judgement.</p>
</div></div>
<div className="sc-audiences"><div><h3>For artists &amp; songwriters</h3><p>Check your draft before release.</p></div><div><h3>For producers &amp; teams</h3><p>Document candidate matches for your team.</p></div><div><h3>For students &amp; educators</h3><p>Study how audio and lyric similarity are measured.</p></div></div>
</div></section>
<section className="sc-chapter" id="sc4-process" aria-labelledby="sc4-process-title"><div className="sc-wrap">
<div className="sc-chapter-head"><p className="sc-overline">02 / The process</p><h2 id="sc4-process-title">Check before release.<br />Decide with evidence.</h2></div>
<div className="sc-process-grid">
<article className="sc-step"><span className="sc-step-num">01 — INPUT</span><h3>Bring your material</h3><p>Supply audio, lyrics or both, with details identifying the work you want to check.</p></article>
<article className="sc-step"><span className="sc-step-num">02 — ANALYSIS</span><h3>Screen for similarities</h3><p>HARRY compares supported features with available references, keeping recording, lyric and musical evidence distinct.</p></article>
<article className="sc-step"><span className="sc-step-num">03 — CONTEXT</span><h3>Inspect the flags</h3><p>Examine each candidate similarity, its source and method, and any incomplete evidence.</p></article>
<article className="sc-step"><span className="sc-step-num">04 — REVIEW</span><h3>Document for review</h3><p>Use available reports to preserve findings, reference context and the analysis version for qualified human review.</p></article>
</div>
</div></section>

<section className="sc-chapter sc-analyzer" id="sc4-analyzer" aria-labelledby="sc4-analyzer-title"><span id="method" className="sc-anchor" aria-hidden="true"></span><div className="sc-wrap">
<div className="sc-chapter-head"><p className="sc-overline">03 / HARRY · SONIC CHECK V37</p><h2 id="sc4-analyzer-title">Six checks.<br />One evidence-led review.</h2></div>
<p className="sc-analyzer-intro">Inside HARRY: six complementary checks for potential similarity. Open a component for its method, useful findings and limitations.</p>
<div className="sc-analyzer-bar"><p>MODEL ALLOCATIONS · Evidence weights, not accuracy percentages</p><button className="sc-text-button" id="sc4-toggle-methods" type="button" aria-controls="sc4-methods" aria-expanded="false">Expand all six methods +</button></div>
<div id="sc4-methods"><details className="sc-method" id="sc4-recording_identity" open>
<summary><span className="sc-method-no">01</span><span><span className="sc-method-title">Recording identity</span><span className="sc-method-question">Does the submitted recording resemble an indexed recording?</span></span><span className="sc-method-tag">18% allocation</span></summary>
<div className="sc-method-content"><ul className="sc-science-points"><li>Builds an acoustic fingerprint to seek candidate recordings through permitted recognition services.</li><li>Uses permitted recording-recognition services. Provider observations and any available MusicBrainz identity context remain visible in the evidence record.</li><li>Shows candidate identifiers, provider observations and whether each request completed.</li><li>Recognition depends on reference coverage and audio quality; it does not establish composition similarity or ownership.</li></ul></div>
</details>
<details className="sc-method" id="sc4-lyric_overlap">
<summary><span className="sc-method-no">02</span><span><span className="sc-method-title">Exact lyric overlap</span><span className="sc-method-question">Which distinctive phrases appear in both texts?</span></span><span className="sc-method-tag">18% allocation</span></summary>
<div className="sc-method-content"><ul className="sc-science-points"><li>Compares submitted and permitted reference lyrics after normalising case, punctuation and Unicode text.</li><li>Finds identical phrases of four to twelve words, reducing emphasis on generic expressions.</li><li>Shows shared wording, word counts and how much of each text each phrase covers.</li><li>Requires text and available references; it does not detect paraphrase, translate lyrics or transcribe singing.</li></ul></div>
</details>
<details className="sc-method" id="sc4-composition_similarity">
<summary><span className="sc-method-no">03</span><span><span className="sc-method-title">Composition similarity</span><span className="sc-method-question">How do the musical features compare with a named reference?</span></span><span className="sc-method-tag">24% allocation</span></summary>
<div className="sc-method-content"><ul className="sc-science-points"><li>Measures harmonic pitch-class energy, dominant pitch-class movement, rhythmic onsets and broad harmonic development.</li><li>Compares uploaded audio with eligible reference audio or compatible feature profiles, allowing a global key change.</li><li>Shows feature agreement, reference identity, analysed duration and signal quality.</li><li>These are musical proxies, not melody transcription; common patterns and dense mixes can affect the result.</li></ul></div>
</details>
<details className="sc-method" id="sc4-relational_specificity">
<summary><span className="sc-method-no">04</span><span><span className="sc-method-title">Relational Specificity</span><span className="sc-method-question">Do harmonic and rhythmic events stay related in time?</span></span><span className="sc-method-tag">10% allocation</span></summary>
<div className="sc-method-content"><ul className="sc-science-points"><li>Examines how harmony and rhythmic events relate across time, using existing composition candidates.</li><li>Fits a shared key and timing alignment, then measures agreement on separate blocks.</li><li>Shows agreement above controls that deliberately shift rhythm relative to harmony.</li><li>Shared audio is not independent evidence; arbitrary excerpts and local tempo changes remain limitations.</li></ul></div>
</details>
<details className="sc-method" id="sc4-lyric_order_recovery">
<summary><span className="sc-method-no">05</span><span><span className="sc-method-title">Lyric Order Recovery</span><span className="sc-method-question">Does the sequence of words still correspond after small edits?</span></span><span className="sc-method-tag">15% allocation</span></summary>
<div className="sc-method-content"><ul className="sc-science-points"><li>Aligns word sequences to find correspondence despite small spelling changes, insertions or omissions.</li><li>Reduces the influence of repeated and common words, then compares alignment against shuffled references.</li><li>Shows sequence spans, gaps, substitutions and any truncation of the compared text.</li><li>Requires distinctive lyric text; it does not recognise meaning, translate lyrics or align words to audio.</li></ul></div>
</details>
<details className="sc-method" id="sc4-interval_path_specificity">
<summary><span className="sc-method-no">06</span><span><span className="sc-method-title">Interval Path Specificity</span><span className="sc-method-question">Does the ordered movement between pitch classes correspond?</span></span><span className="sc-method-tag">15% allocation</span></summary>
<div className="sc-method-content"><ul className="sc-science-points"><li>Compares ordered pitch-class intervals, helping examine passages even after a global key change.</li><li>Uses bounded alignment or harmonic recovery when needed, with extra checks on weaker evidence.</li><li>Shows the interval measurement, supporting evidence and a separate positive, negative or unavailable decision.</li><li>Mixed audio is not isolated melody; dense polyphony or missing reference audio can leave this unscored.</li></ul></div>
</details></div>
<div className="sc-aggregate"><h3>How the six<br />come together</h3><p>Evidence is combined only for the same eligible candidate; findings from unrelated works are not pooled. Missing evidence stays unscored, with its weight reserved, while an observed zero remains distinct. Allocations describe contributions, not accuracy or probabilities of copying. Components sharing audio or text are related observations, not independent votes; the total supports contextual human review.</p></div>
</div></section>
<section className="sc-chapter" id="sc4-evidence" aria-labelledby="sc4-evidence-title"><div className="sc-wrap sc-evidence-grid">
<div className="sc-evidence-text"><p className="sc-overline">04 / Reading the evidence</p><h2 id="sc4-evidence-title">Flag similarities.<br />Document the evidence.</h2><p>A flag begins an investigation. Inspect the candidate material, understand the measurement and document the relevant context for qualified review.</p><p>Group evidence around the same candidate, and distinguish an observed zero from an unavailable measurement.</p><p>Measurements drawn from the same audio or text may share dependencies.</p></div>
<aside className="sc-record" aria-label="Guide to the evidence record"><div className="sc-record-top"><span>SONIC CHECK</span><span>READING GUIDE</span></div><h3>Follow the connection.</h3><p>The questions to ask of each candidate.</p><dl><div><dt>01 / Identity</dt><dd>Which recording or work is being compared?</dd></div><div><dt>02 / Observation</dt><dd>What language or musical features correspond?</dd></div><div><dt>03 / Provenance</dt><dd>Which reference, provider and method produced it?</dd></div><div><dt>04 / Completeness</dt><dd>What was measured, missing or outside coverage?</dd></div><div><dt>05 / Interpretation</dt><dd>What deserves a closer listen, read or review?</dd></div></dl><div className="sc-record-foot">Report guide only; no scan results.</div></aside>
</div></section>
<section className="sc-chapter sc-light" id="sc4-scope" aria-labelledby="sc4-scope-title"><span id="catalogue" className="sc-anchor" aria-hidden="true"></span><div className="sc-wrap">
<div className="sc-chapter-head"><p className="sc-overline">05 / Reference &amp; research</p><h2 id="sc4-scope-title">Every comparison<br />has a field of view.</h2></div>
<div className="sc-scope-grid"><article className="sc-scope-item"><h3>Recording recognition</h3><p>Authorised recognition services can return candidate recordings. A service being configured is separate from a request being performed and returning a usable result.</p></article>
<article className="sc-scope-item"><h3>Musical reference profiles</h3><p>Eligible reference audio and musical profiles support composition comparison within the active catalogue.</p></article>
<article className="sc-scope-item"><h3>Identity &amp; metadata</h3><p>MusicBrainz supplies identifiers and metadata; recordings and lyrics require separate sources.</p></article>
<article className="sc-scope-item"><h3>Research resources</h3><p>Research datasets support development; their size is separate from active scan coverage.</p></article></div>
<div className="sc-catalogue-live">
        <p>Active scan catalogue: {typeof activeProfiles === "number" ? `${activeProfiles.toLocaleString("en-AU")} comparison-eligible symbolic profiles` : dataLoaded ? "currently unavailable" : "loading the live release manifest…"}.</p>
        <details><summary>Explore the research inventory</summary>
          <dl className="sc-inventory">
            <div><dt>{RESEARCH_CATALOGUE.acousticRecords.toLocaleString("en-AU")}</dt><dd>AcousticBrainz recording-feature records</dd></div>
            <div><dt>{RESEARCH_CATALOGUE.symbolicReferences.toLocaleString("en-AU")}</dt><dd>Symbolic research references, including {RESEARCH_CATALOGUE.additions} additions</dd></div>
            <div><dt>{RESEARCH_CATALOGUE.vectorsPerView.toLocaleString("en-AU")}</dt><dd>Retrieval vectors per symbolic view; two views of the same reference set</dd></div>
          </dl>
          <p>Research inventory and active scan coverage are reported separately. The research inventory is dated 22 September 2026; current scan coverage comes from the live release manifest.</p>
        </details>
      </div><div className="sc-research"><h3>HOEL<br />Understanding related evidence</h3><div><p>HOEL studies shared origins and dependencies between evidence. It is separate from the six scoring components.</p><p>Its catalogue reliability remains unvalidated. SONIC CHECK is a controlled private beta; scientific acceptance is not yet certified.</p></div></div>
</div></section>
<section className="sc-chapter" id="sc4-care" aria-labelledby="sc4-care-title"><div className="sc-wrap sc-care-grid"><div><p className="sc-overline">06 / Your work</p><h2 id="sc4-care-title" style={{"marginTop": "20px"}}>Created by you.<br />Treated with care.</h2></div><div><p>You retain your rights in material you submit. Audio and full lyric text are treated as private service inputs, with authenticated account access and operational controls designed around that separation.</p><p>The recording-recognition path determines what a provider receives: a compact fingerprint and duration on one route, or a bounded audio sample on a separately authorised route. Provider activity belongs in the evidence context.</p><p>Sharing a public record is a separate, confirmed action. Public metadata can be visible to anyone with the link; raw audio, full lyrics and account email are not the public record’s content.</p><div className="sc-policy-links"><Link to="/privacy/">Privacy Policy</Link><Link to="/terms/">Terms of Use</Link></div></div></div></section>
<section className="sc-chapter" id="sc4-faq" aria-labelledby="sc4-faq-title"><div className="sc-wrap sc-faq-grid"><div className="sc-faq-intro"><p className="sc-overline">07 / Good questions</p><h2 id="sc4-faq-title">A little more<br />clarity.</h2></div><div><details className="sc-faq-item"><summary>What does SONIC CHECK do?</summary><p>SONIC CHECK develops audio analytics software for pre-release similarity screening. HARRY compares recording, lyric and musical evidence with available references, highlighting candidates for qualified human review.</p></details>
<details className="sc-faq-item"><summary>Do I need both audio and lyrics?</summary><p>Audio supports recording and musical analysis. Lyric checks require supplied text and an authorised reference.</p></details>
<details className="sc-faq-item"><summary>Does a match mean my work is copied?</summary><p>A match is a reason to inspect the material and context. It is not by itself a determination of copying, authorship, ownership or infringement.</p></details>
<details className="sc-faq-item"><summary>Does no match mean my work is cleared?</summary><p>No. Searches cover the references available to each method; they do not establish originality or clearance, or that every historical and contemporary work has been checked.</p></details>
<details className="sc-faq-item"><summary>What do the percentages mean?</summary><p>Component percentages are scoring allocations. Individual results need their method and reference context; neither is an accuracy rate or legal probability.</p></details>
<details className="sc-faq-item"><summary>Can I keep or share a report?</summary><p>Report tools depend on account entitlement. Publishing a public record is a separate, confirmed choice.</p></details>
<details className="sc-faq-item"><summary>Can I use SONIC CHECK now?</summary><p>SONIC CHECK is in controlled private beta. Contact the team about access; registration, scanning and checkout remain separate.</p></details></div></div></section>
<section className="sc-chapter sc-pricing" id="pricing" aria-labelledby="sc-pricing-title"><div className="sc-wrap">
        <div className="sc-chapter-head"><p className="sc-overline">Access &amp; AUD pricing</p><h2 id="sc-pricing-title">Your next step.<br />On your terms.</h2></div>
        <p className="sc-pricing-intro">Explore the published plans and ask about private-beta access. Registration, scanning entitlement and paid checkout are separate.</p>
        <CommercialLicenseNotice contract={contract} className="sc-license-notice" />
        {plans.length ? <div className="sc-plans">{plans.map(plan => <article key={plan.id} className="sc-plan">
          <h3>{plan.name}</h3><p className="sc-plan-price">{aud.format(plan.price)}</p><p className="sc-plan-period">AUD · {plan.billing_interval === "one-time" ? "one time" : `per ${plan.billing_interval}`}</p>
          <ul>{plan.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
          <Link to={isSignedIn ? "/app/billing" : "/join"} className="sc-button sc-button-secondary">{isSignedIn ? "Plan & billing" : "Join private beta"}</Link>
        </article>)}</div> : <p className="sc-data-status" role="status">{dataLoaded ? "Plan details are currently unavailable. Contact us about beta access." : "Loading current AUD pricing…"}</p>}
        <p className="sc-checkout-status">Paid public checkout: {paidOpen ? "API-authorized" : "closed"}.</p>
      </div></section><section className="sc-contact" id="sc4-contact" aria-labelledby="sc4-contact-title"><div className="sc-wrap"><p className="sc-overline">For the people behind the music</p><h2 id="sc4-contact-title">Create with integrity.<br />Release with insight.</h2><p>Planning a release? Ask about SONIC CHECK, discuss beta access, or tell us what would make your evidence review more useful.</p><a className="sc-button" href="mailto:info@soniccheck.io">Let's talk </a></div></section>
</main>
<footer className="sc-footer sc-wrap"><img className="sc-rainbow-symbol" src={asset("/brand/sonic-rainbow-bar.png")} alt="" aria-hidden="true" /><div className="sc-footer-top"><a className="sc-brand" href="#sc4-home"><img src={asset("/brand/logo-full.png")} alt="SONIC CHECK" className="sc-footer-logo" /><small>EVIDENCE IN EVERY CONNECTION</small></a><nav className="sc-footer-links" aria-label="Footer navigation"><a href="#sc4-about">About</a><a href="#sc4-analyzer">The science</a><a href="#sc4-faq">FAQ</a><a href="mailto:info@soniccheck.io">Contact</a></nav></div><div className="sc-footer-bottom"><span>Evidence for considered creative decisions.</span><span>© SONIC CHECK</span></div><p className="sc-editorial-note">Screening supports qualified human review. A match or an absence of matches does not establish originality, ownership or clearance.</p></footer>
</div>
  );
}
