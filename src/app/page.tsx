import AppointmentForm from "@/components/AppointmentForm";
import ChapterDots from "@/components/ChapterDots";
import HelixPoster from "@/components/HelixPoster";
import LogoMark from "@/components/Logo";
import MobileNav from "@/components/MobileNav";
import MotionToggle from "@/components/MotionToggle";
import Portrait from "@/components/Portrait";
import Reveals from "@/components/Reveals";
import SequenceRuler from "@/components/SequenceRuler";
import SplitHeading from "@/components/SplitHeading";
import Stage from "@/components/Stage";

const SITE_URL = "https://helix-labs-3d.vercel.app";

// Structured data: a website and the (fictional) organisation behind it. Deliberately not MedicalClinic.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: "Helix Labs", url: SITE_URL },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: "Helix Labs",
      url: SITE_URL,
      description: "Concept project — fictional brand.",
    },
  ],
};

const NAV = [
  { href: "#services", label: "Services" },
  { href: "#process", label: "Process" },
  { href: "#lab", label: "The lab" },
  { href: "#team", label: "Team" },
  { href: "#faq", label: "FAQ" },
];

const SERVICES = [
  {
    id: "sequencing",
    name: "Genome Sequencing",
    strap: "All 3.1 billion base pairs, read at 30× depth.",
    body: "We sequence your whole genome — not a sample of it — and our geneticists translate it into what matters for you today: medicines, risks and family planning.",
    points: [
      "Pharmacogenomics for 140+ common medicines",
      "Carrier screening for 300+ inherited conditions",
      "Your raw data to keep: FASTQ, BAM and VCF files",
    ],
    price: "from €890",
    form: "Replication fork — the strand unzips to be read",
    accent: "coral",
  },
  {
    id: "cell-therapy",
    name: "Cell Therapy",
    strap: "Your own cells, prepared to do more.",
    body: "For patients whose oncologist is considering cell-based treatment, we handle collection, cryo-banking and trial matching, and stay in step with your care team.",
    points: [
      "Autologous cell banking at −196 °C",
      "Clinical-trial matching across 40 partner centres",
      "One coordinator between you and your oncology team",
    ],
    price: "by referral",
    form: "A cell — strands become membrane and nucleus",
    accent: "teal",
  },
  {
    id: "diagnostics",
    name: "Precision Diagnostics",
    strap: "Small signals, read in context.",
    body: "Liquid biopsy and targeted panels pick up changes long before a scan can, and a specialist walks you through every result in person.",
    points: [
      "Circulating tumour DNA monitoring",
      "Hereditary cancer panels, including BRCA1/2 and Lynch syndrome",
      "45-minute results consultation",
    ],
    price: "from €420",
    form: "A plasmid ring — a closed loop we can test against",
    accent: "indigo",
  },
  {
    id: "longevity",
    name: "Longevity Programme",
    strap: "A yearly baseline that learns your biology.",
    body: "Each year we compare your epigenetic age, bloods and lifestyle data with last year's, and adjust one plan that you and your clinician own together.",
    points: ["Epigenetic age assay", "Quarterly bloods with trend lines", "Plan reviewed every three months"],
    price: "€1,650 / year",
    form: "The real helix re-forms, atom by atom — renewal",
    accent: "amber",
  },
];

const STEPS = [
  {
    title: "Consult",
    time: "45 min",
    body: "A 45-minute conversation about your history and what you want to know. No test is ordered until you're sure.",
  },
  {
    title: "Sample",
    time: "4 min",
    body: "A saliva kit at home or a 10 ml blood draw in clinic. It takes four minutes.",
  },
  {
    title: "Sequence & review",
    time: "~11 days",
    body: "Our lab reads the sample; two independent geneticists review every reportable finding.",
  },
  {
    title: "Plan",
    time: "1 year of questions",
    body: "You get a written plan in plain language and a follow-up call — and you can ask questions for a full year.",
  },
];

const NUMBERS = [
  { value: "48,000+", label: "genomes read" },
  { value: "99.9%", label: "variant call accuracy" },
  { value: "11 days", label: "median turnaround" },
  { value: "0", label: "records ever sold" },
];

const TEAM = [
  {
    initials: "IV",
    name: "Dr Inès Varga",
    role: "Clinical geneticist, lead",
    bio: "Fifteen years in hereditary cancer genetics; believes every result deserves a conversation.",
  },
  {
    initials: "TO",
    name: "Dr Tomás Okafor",
    role: "Haematology & cell therapy",
    bio: "Coordinates cell collection and trial referrals with hospitals across the region.",
  },
  {
    initials: "MH",
    name: "Mira Hollis, MSc",
    role: "Genetic counsellor",
    bio: "Helps families decide what to test, what to share and when.",
  },
];

const FAQ = [
  {
    q: "Do I need a referral?",
    a: "No. You can book directly; if you have a referral letter, bring it and we'll coordinate with your doctor.",
  },
  {
    q: "Who can see my genetic data?",
    a: "You, the clinicians on your case and the lab team that processes it. Nobody else, unless you give written consent.",
  },
  {
    q: "Will results affect my insurance?",
    a: "We never share results with insurers. Rules differ by country, so your counsellor will explain what applies to you before you test.",
  },
  {
    q: "How long until I get results?",
    a: "Median 11 days for sequencing and 7 for diagnostic panels. We call you when they're ready — results are never just emailed.",
  },
  {
    q: "Can I get my raw data?",
    a: "Yes. Genome sequencing includes your FASTQ, BAM and VCF files, downloadable for 12 months.",
  },
];

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="site-header">
        <div className="wrap site-header__inner">
          <a className="brand" href="#top" aria-label="Helix Labs, back to top">
            <LogoMark />
            <span className="brand__name">Helix Labs</span>
          </a>
          <nav className="site-nav" aria-label="Main">
            <ul>
              {NAV.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="site-header__actions">
            <a className="btn btn--primary btn--small site-header__cta" href="#book">
              <span className="btn__label">Book a visit</span>
            </a>
            <MobileNav items={NAV} />
          </div>
        </div>
        <div className="progress" aria-hidden="true" />
      </header>

      <Stage />
      <ChapterDots />

      <main id="main" tabIndex={-1}>
        {/* ---------------------------------------------------------------- Hero */}
        <section id="top" className="hero" data-form-anchor="0" aria-labelledby="hero-title">
          <div className="wrap hero__grid">
            <div className="hero__copy">
              <p className="tag">HX—00 · Genomic medicine clinic</p>
              <h1 id="hero-title" className="display">
                Read the code you were <em>born with.</em>
              </h1>
              <p className="lead">
                Whole-genome sequencing, cell therapy and precision diagnostics under one roof — interpreted by a clinician
                who sits down with you, not a PDF in your inbox.
              </p>
              <div className="hero__ctas">
                <a className="btn btn--primary" href="#book">
                  <span className="btn__label">Book a consultation</span>
                </a>
                <a className="btn btn--line" href="#services">
                  Explore services
                </a>
              </div>
              <dl className="hero__stats">
                <div>
                  <dt>Whole-genome depth</dt>
                  <dd>30×</dd>
                </div>
                <div>
                  <dt>Median turnaround</dt>
                  <dd>11 days</dd>
                </div>
                <div>
                  <dt>Clinician, start to finish</dt>
                  <dd>1</dd>
                </div>
              </dl>
              <MotionToggle className="hero__motion" />
            </div>
            <div className="hero__visual" aria-hidden="true">
              <HelixPoster className="hero__poster" />
              <SequenceRuler />
              <p className="stage-status">
                <span className="stage-status__loading">Sequencing…</span>
                <span className="stage-status__static">Static view</span>
              </p>
              <p className="hero__caption">Real B-DNA structure · PDB 1BNA</p>
            </div>
          </div>
          <a className="hero__scroll" href="#services">
            <span>Scroll to unwind</span>
            <span className="hero__scroll-line" aria-hidden="true" />
          </a>
        </section>

        {/* ------------------------------------------------------------ Services */}
        <section id="services" className="services" aria-labelledby="services-title">
          <div className="wrap services__intro" data-reveal>
            <p className="tag">HX—01 · Services</p>
            <SplitHeading id="services-title" lead="Four services," em="one strand." />
            <p className="lead">Scroll, and the helix unwinds into each one.</p>
          </div>

          {SERVICES.map((s, i) => (
            <article
              key={s.id}
              id={s.id}
              className="chapter"
              data-form-anchor={i + 1}
              aria-labelledby={`${s.id}-title`}
            >
              <div className="wrap">
                <div className={`chapter__card chapter__card--${s.accent}`} data-reveal>
                  {/* outlined numeral drawn from data-n by CSS (decoration, not read out) */}
                  <span className="chapter__numeral" data-n={String(i + 1).padStart(2, "0")} aria-hidden="true" />
                  <p className="chapter__index">
                    <span>{String(i + 1).padStart(2, "0")}</span> / 04
                  </p>
                  <h3 id={`${s.id}-title`} className="chapter__title">
                    {s.name}
                  </h3>
                  <p className="chapter__strap">{s.strap}</p>
                  <p className="chapter__body">{s.body}</p>
                  <ul className="chapter__points">
                    {s.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  <div className="chapter__foot">
                    <p className="chapter__price">{s.price}</p>
                    <a className="link-arrow" href="#book">
                      Book {s.name.toLowerCase()}
                    </a>
                  </div>
                  <p className="chapter__form">
                    <span aria-hidden="true">◍</span> On screen: {s.form}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>

        {/* ------------------------------------------------------------- Process */}
        <section id="process" className="process band" aria-labelledby="process-title">
          <div className="wrap">
            <div className="section-head" data-reveal>
              <p className="tag">HX—02 · Process</p>
              <SplitHeading id="process-title" lead="How a visit" em="works." />
            </div>
            <ol className="steps">
              {STEPS.map((step, i) => (
                <li key={step.title} className="step" data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
                  <p className="step__num">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="step__title">{step.title}</h3>
                  <p className="step__time">{step.time}</p>
                  <p className="step__body">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ----------------------------------------------------------------- Lab */}
        <section id="lab" className="lab" aria-labelledby="lab-title">
          <div className="wrap">
            <div className="section-head" data-reveal>
              <p className="tag">HX—03 · The lab</p>
              <SplitHeading id="lab-title" lead="A lab you can" em="ask questions." />
            </div>
            <dl className="numbers">
              {NUMBERS.map((n) => (
                <div key={n.label} className="numbers__item" data-reveal>
                  <dt>{n.label}</dt>
                  <dd>{n.value}</dd>
                </div>
              ))}
            </dl>
            <div className="lab__grid">
              <blockquote className="promise" data-reveal>
                <p>
                  Your genome is never sold, pooled or used for research without a separate consent you can withdraw at any
                  time. You can ask us to delete it — and we send you the confirmation.
                </p>
                <footer>— The Helix Labs data promise</footer>
              </blockquote>
              <ul className="standards" data-reveal>
                <li>
                  <span className="standards__mark standards__mark--teal" aria-hidden="true" />
                  Accredited clinical laboratory
                </li>
                <li>
                  <span className="standards__mark standards__mark--indigo" aria-hidden="true" />
                  Data stored in-region, encrypted at rest
                </li>
                <li>
                  <span className="standards__mark standards__mark--coral" aria-hidden="true" />
                  Double-reviewed reports
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- Team */}
        <section id="team" className="team band" aria-labelledby="team-title">
          <div className="wrap">
            <div className="section-head" data-reveal>
              <p className="tag">HX—04 · Clinicians</p>
              <SplitHeading id="team-title" lead="The people who" em="read your results." />
            </div>
            <ul className="people">
              {TEAM.map((p, i) => (
                <li key={p.name} className="person" data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
                  <Portrait initials={p.initials} variant={i} />
                  <h3 className="person__name">{p.name}</h3>
                  <p className="person__role">{p.role}</p>
                  <p className="person__bio">{p.bio}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------------------------------------------------------- Book */}
        <section id="book" className="booking" aria-labelledby="book-title">
          <div className="wrap booking__grid">
            <div className="booking__aside" data-reveal>
              <p className="tag tag--on-ink">HX—05 · Appointments</p>
              <SplitHeading id="book-title" lead="Book a" em="consultation." />
              <p className="lead">
                Tell us a little about what you&rsquo;re looking for. A coordinator replies within one working day to confirm
                a time.
              </p>
              <dl className="booking__facts">
                <div>
                  <dt>Clinic</dt>
                  <dd>14 Meridian Row, Port Calder</dd>
                </div>
                <div>
                  <dt>Hours</dt>
                  <dd>Mon–Fri 08:00–18:00 · Sat 09:00–13:00</dd>
                </div>
                <div>
                  <dt>First visit</dt>
                  <dd>45 minutes · €120, credited to any test</dd>
                </div>
              </dl>
            </div>
            <div className="booking__panel">
              <AppointmentForm />
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------------- FAQ */}
        <section id="faq" className="faq" aria-labelledby="faq-title">
          <div className="wrap faq__grid">
            <div className="section-head" data-reveal>
              <p className="tag">HX—06 · FAQ</p>
              <SplitHeading id="faq-title" lead="Questions," em="answered." />
            </div>
            <div className="faq__list">
              {FAQ.map((item) => (
                <details key={item.q} className="faq__item">
                  <summary>
                    <h3 className="faq__q">{item.q}</h3>
                    <span className="faq__icon" aria-hidden="true" />
                  </summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap site-footer__grid">
          <div>
            <a className="brand brand--footer" href="#top" aria-label="Helix Labs, back to top">
              <LogoMark />
              <span className="brand__name">Helix Labs</span>
            </a>
            <p className="site-footer__tagline">Genomic medicine, explained in person.</p>
          </div>
          <div>
            <h2 className="site-footer__label">Visit</h2>
            <p>
              14 Meridian Row, Port Calder
              <br />
              Mon–Fri 08:00–18:00 · Sat 09:00–13:00
            </p>
          </div>
          <div>
            <h2 className="site-footer__label">Design &amp; build</h2>
            <p>
              <a href="https://alhassan-portfolio-sigma.vercel.app" rel="noopener">
                Alhassan Alfarran
              </a>
              <br />
              <a href="https://github.com/kyan9400" rel="noopener">
                GitHub
              </a>
              {" · "}
              <a href="mailto:kyan775909@gmail.com">Email</a>
              {" · "}
              <a href="https://t.me/hassan_9400" rel="noopener">
                Telegram
              </a>
            </p>
          </div>
          <div className="site-footer__motion">
            <h2 className="site-footer__label">Motion</h2>
            <MotionToggle />
          </div>
        </div>
        <div className="wrap site-footer__base">
          <p>© 2026 Alhassan Alfarran</p>
          <p>Concept project — fictional brand.</p>
        </div>
      </footer>

      <Reveals />
    </>
  );
}
