import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { Link } from "react-router-dom";
import styles from "./LandingPage.module.css";

const features = [
  {
    icon: "expense",
    title: "Expense Tracking",
    text: "Track every expense in real-time and know where your money goes.",
  },
  {
    icon: "budget",
    title: "Budget Planning",
    text: "Create custom budgets and stay on track to meet your goals.",
  },
  {
    icon: "insights",
    title: "Smart Insights",
    text: "Get AI-powered insights and personalized financial tips.",
  },
  {
    icon: "goals",
    title: "Savings Goals",
    text: "Set goals, track progress, and build a better financial future.",
  },
  {
    icon: "secure",
    title: "Secure & Private",
    text: "Your data is protected with bank-level encryption.",
  },
  {
    icon: "reports",
    title: "Reports & Analytics",
    text: "Visualize trends and analyze your finances with beautiful reports.",
  },
];

const howItWorks = [
  {
    icon: "signup",
    title: "Sign Up",
    description:
      "Create your MoneyMate account in just a few minutes and start with a clean, simple dashboard built to get you moving quickly.",
  },
  {
    icon: "track",
    title: "Track Spending",
    description:
      "Add transactions and monitor your day-to-day spending so you always know where your money is going.",
  },
  {
    icon: "insights",
    title: "Get Insights",
    description:
      "Turn your spending data into clear trends, practical guidance, and better money habits over time.",
  },
];

const faqs = [
  {
    question: "Is MoneyMate free to use?",
    answer:
      "Yes. You can get started for free and use the core budgeting and tracking experience without paying anything upfront.",
  },
  {
    question: "How do I add my expenses?",
    answer:
      "You can log expenses manually and keep your spending organized right from your dashboard.",
  },
  {
    question: "Can I track multiple spending categories?",
    answer:
      "Yes. MoneyMate is designed to help you organize spending across categories so your habits are easier to understand.",
  },
  {
    question: "Are my financial details secure?",
    answer:
      "MoneyMate is built with privacy and security in mind so you can manage your finances with confidence.",
  },
  {
    question: "Does MoneyMate show insights automatically?",
    answer:
      "Yes. Once you track enough activity, MoneyMate highlights patterns and gives you helpful feedback on your money habits.",
  },
  {
    question: "Can I get help if I have a question?",
    answer:
      "Absolutely. You can reach out through the contact section and the team will respond by email.",
  },
];

function FeatureIcon({ type }: { type: string }) {
  if (type === "expense") {
    return (
      <svg aria-hidden="true" viewBox="0 0 48 48">
        <rect x="12" y="7" width="24" height="34" rx="4" />
        <path d="M18 17h12M18 24h12M18 31h8" />
      </svg>
    );
  }

  if (type === "budget") {
    return (
      <svg aria-hidden="true" viewBox="0 0 48 48">
        <path d="M24 24V7a17 17 0 1 0 17 17H24Z" />
        <path d="M29 5v14h14A14 14 0 0 0 29 5Z" />
      </svg>
    );
  }

  if (type === "insights") {
    return (
      <svg aria-hidden="true" viewBox="0 0 48 48">
        <path d="M17 29c-3-2-5-6-5-10a12 12 0 0 1 24 0c0 4-2 8-5 10-2 2-3 4-3 6h-8c0-2-1-4-3-6Z" />
        <path d="M20 40h8M24 11V7M10 13l-4-2M38 13l4-2M9 25l-4 1M39 25l4 1" />
        <path d="M22 20a3 3 0 1 1 4 3v4" />
      </svg>
    );
  }

  if (type === "goals") {
    return (
      <svg aria-hidden="true" viewBox="0 0 48 48">
        <circle cx="23" cy="25" r="16" />
        <circle cx="23" cy="25" r="10" />
        <circle cx="23" cy="25" r="4" />
        <path d="m25 23 12-12M34 8h7v7" />
      </svg>
    );
  }

  if (type === "secure") {
    return (
      <svg aria-hidden="true" viewBox="0 0 48 48">
        <path d="M24 5c6 5 12 6 16 7v11c0 10-6 16-16 20C14 39 8 33 8 23V12c4-1 10-2 16-7Z" />
        <path d="M28 17c-1-1-2-2-4-2-3 0-5 2-5 4s2 3 5 4 5 2 5 5-2 5-5 5c-2 0-4-1-5-2M24 12v24" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 48 48">
      <rect x="8" y="27" width="7" height="14" rx="2" />
      <rect x="20" y="19" width="7" height="22" rx="2" />
      <rect x="32" y="9" width="7" height="32" rx="2" />
    </svg>
  );
}

function GrowthSculpture() {
  return (
    <svg
      aria-hidden="true"
      className={styles.growthSvg}
      viewBox="0 0 1024 1024"
      focusable="false"
    >
      <defs>
        <radialGradient id="growthGlow" cx="50%" cy="44%" r="56%">
          <stop offset="0%" stopColor="#b8fff1" stopOpacity="0.62" />
          <stop offset="38%" stopColor="#49c5b6" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#050d0d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="growthFace" x1="22%" y1="9%" x2="83%" y2="92%">
          <stop offset="0%" stopColor="#9ff7e2" />
          <stop offset="26%" stopColor="#4ad6c3" />
          <stop offset="60%" stopColor="#00a99d" />
          <stop offset="100%" stopColor="#00695f" />
        </linearGradient>
        <linearGradient id="growthDark" x1="8%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00a895" />
          <stop offset="58%" stopColor="#007f75" />
          <stop offset="100%" stopColor="#004c45" />
        </linearGradient>
        <linearGradient id="growthHighlight" x1="8%" y1="0%" x2="86%" y2="88%">
          <stop offset="0%" stopColor="#d8fff2" stopOpacity="0.92" />
          <stop offset="48%" stopColor="#8ff5dd" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#003f3a" stopOpacity="0.2" />
        </linearGradient>
        <filter id="growthShadow" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="18" dy="22" stdDeviation="18" floodColor="#00100e" floodOpacity="0.72" />
          <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#49c5b6" floodOpacity="0.22" />
        </filter>
      </defs>

      <ellipse className={styles.growthGlow} cx="496" cy="500" rx="436" ry="436" fill="url(#growthGlow)" />
      <ellipse className={styles.growthGround} cx="482" cy="833" rx="386" ry="62" />

      {[0, 1, 2, 3].map((bar) => {
        const bars = [
          { x: 172, y: 606, width: 116, height: 195, rx: 26, delay: "0ms" },
          { x: 320, y: 505, width: 116, height: 296, rx: 26, delay: "120ms" },
          { x: 470, y: 402, width: 126, height: 399, rx: 28, delay: "240ms" },
          { x: 622, y: 282, width: 128, height: 519, rx: 28, delay: "360ms" },
        ];
        const item = bars[bar];
        return (
          <g
            className={styles.growthBar}
            key={bar}
            style={{ "--growth-delay": item.delay } as CSSProperties}
          >
            <rect
              x={item.x + 18}
              y={item.y + 16}
              width={item.width}
              height={item.height}
              rx={item.rx}
              fill="#00443f"
              opacity="0.55"
            />
            <rect
              x={item.x}
              y={item.y}
              width={item.width}
              height={item.height}
              rx={item.rx}
              fill="url(#growthFace)"
              stroke="#5df5db"
              strokeWidth="6"
            />
            <path
              d={`M${item.x + 20} ${item.y + 22}h${item.width * 0.44}`}
              stroke="#d9fff2"
              strokeOpacity="0.72"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d={`M${item.x + item.width - 18} ${item.y + 36}v${item.height - 72}`}
              stroke="#003a35"
              strokeOpacity="0.46"
              strokeWidth="8"
              strokeLinecap="round"
            />
          </g>
        );
      })}

      <g className={styles.growthArrow} filter="url(#growthShadow)">
        <path
          className={styles.growthArrowFace}
          d="M108 650C244 590 365 482 468 346C520 278 579 205 642 138L589 88L850 42L790 276L728 204C672 266 612 340 548 424C435 574 302 676 143 730C119 738 95 728 86 707C77 685 88 660 108 650Z"
          fill="url(#growthFace)"
          stroke="#6df4df"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      <g className={styles.growthPie} filter="url(#growthShadow)">
        <circle cx="704" cy="706" r="176" fill="#003c38" opacity="0.78" transform="translate(18 18)" />
        <circle cx="704" cy="706" r="176" fill="url(#growthDark)" stroke="#75f5df" strokeWidth="8" />
        <path
          d="M704 706 817 571A176 176 0 0 1 876 743Z"
          fill="#8df5df"
          stroke="#75f5df"
          strokeWidth="8"
          strokeLinejoin="round"
        />
        <path
          d="M704 706 869 766A176 176 0 0 1 797 855Z"
          fill="#21c7b8"
          stroke="#75f5df"
          strokeWidth="8"
          strokeLinejoin="round"
        />
        <path
          d="M704 706 817 571M704 706 876 743M704 706 869 766M704 706 797 855"
          fill="none"
          stroke="#050d0d"
          strokeOpacity="0.5"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M585 578A172 172 0 0 1 724 536"
          fill="none"
          stroke="#d5fff2"
          strokeOpacity="0.62"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

function StepIcon({ type }: { type: string }) {
  if (type === "signup") {
    return (
      <svg aria-hidden="true" viewBox="0 0 48 48">
        <path d="M24 25a9 9 0 1 0-9-9 9 9 0 0 0 9 9Z" />
        <path d="M10 40c2-7 8-11 14-11s12 4 14 11" />
        <path d="M34 15h8M38 11v8" />
      </svg>
    );
  }

  if (type === "track") {
    return (
      <svg aria-hidden="true" viewBox="0 0 48 48">
        <path d="M8 34h32" />
        <path d="M12 29l8-9 7 5 9-12" />
        <path d="M31 13h10v10" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 48 48">
      <path d="M24 9c8 0 14 6 14 14s-6 14-14 14S10 31 10 23s6-14 14-14Z" />
      <path d="M24 16v8l5 3" />
      <path d="M8 38c4-4 10-6 16-6s12 2 16 6" />
    </svg>
  );
}

export function LandingPage() {
  const [isGrowthVisible, setIsGrowthVisible] = useState(false);
  const growthRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = growthRef.current;
    if (!element) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsGrowthVisible(entry.isIntersecting);
      },
      { threshold: 0.42 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (
    event: MouseEvent<HTMLAnchorElement>,
    sectionId: string,
  ) => {
    event.preventDefault();
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    window.history.replaceState(null, "", `#${sectionId}`);
  };

  return (
    <main className={styles.landing}>
      <header className={styles.header}>
        <Link className={styles.brand} to="/" aria-label="MoneyMate home">
          <img src="/moneymate-logo.png" alt="" />
          <span>
            Money<span>Mate</span>
          </span>
        </Link>

        <nav className={styles.navigation} aria-label="Primary navigation">
          <a href="#about" onClick={(event) => scrollToSection(event, "about")}>
            About Us
          </a>
          <a
            href="#how-it-works"
            onClick={(event) => scrollToSection(event, "how-it-works")}
          >
            How It Works
          </a>
          <a
            href="#features"
            onClick={(event) => scrollToSection(event, "features")}
          >
            Features
          </a>
          <a href="#faq" onClick={(event) => scrollToSection(event, "faq")}>
            FAQ
          </a>
          <a
            href="#contact"
            onClick={(event) => scrollToSection(event, "contact")}
          >
            Contact
          </a>
        </nav>

        <div className={styles.authActions}>
          <Link className={styles.loginLink} to="/login">
            Log in
          </Link>
          <Link className={styles.signupButton} to="/register">
            Sign up
          </Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Your finances, finally in focus</p>
          <h1>
            Take Control of
            <br />
            Your <span>Money.</span>
          </h1>
          <p className={styles.subtitle}>
            MoneyMate helps you track expenses, plan budgets, and achieve your
            financial goals with confidence.
          </p>

          <div className={styles.heroActions}>
            <Link className={styles.primaryCta} to="/register">
              Get Started for Free
            </Link>
            <a
              className={styles.secondaryCta}
              href="#features"
              onClick={(event) => scrollToSection(event, "features")}
            >
              Explore Features
            </a>
          </div>

          <div className={styles.trusted}>
            <div className={styles.people} aria-hidden="true">
              {[0, 1, 2, 3].map((person) => (
                <span className={styles.person} key={person}>
                  <i />
                </span>
              ))}
            </div>
            <div>
              <strong>Trusted by 5,000+ users</strong>
              <span>building better money habits every day</span>
            </div>
          </div>
        </div>

        <div className={styles.heroVisual} aria-hidden="true">
          <span className={`${styles.orbit} ${styles.orbitOuter}`} />
          <span className={`${styles.orbit} ${styles.orbitInner}`} />
          <span className={styles.dots} />
          <div className={styles.logoHalo}>
            <div className={styles.logoSculpture}>
              <img
                className={`${styles.logoLayer} ${styles.logoDepthBack}`}
                src="/moneymate-logo.png"
                alt=""
              />
              <img
                className={`${styles.logoLayer} ${styles.logoDepthMiddle}`}
                src="/moneymate-logo.png"
                alt=""
              />
              <img
                className={`${styles.logoLayer} ${styles.logoDepthFront}`}
                src="/moneymate-logo.png"
                alt=""
              />
              <img
                className={`${styles.logoLayer} ${styles.logoFace}`}
                src="/moneymate-logo.png"
                alt=""
              />
              <span className={styles.logoShine} />
            </div>
          </div>
          <span className={styles.logoShadow} />
          <span className={styles.lightBeam} />
        </div>
      </section>

      <section className={styles.aboutSection} id="about">
        <div className={styles.aboutCenter} aria-hidden="true">
          <span className={styles.aboutOrbital} />
          <span className={styles.aboutOrbitalInner} />
          <span className={styles.aboutFloor} />
          <div
            className={`${styles.growthSculpture} ${
              isGrowthVisible ? styles.growthSculptureVisible : ""
            }`}
            ref={growthRef}
          >
            <GrowthSculpture />
          </div>
        </div>

        <div className={`${styles.aboutSide} ${styles.aboutSideRight}`}>
          <p className={styles.sectionLabel}>About MoneyMate</p>
          <h2>
            Your financial life, made <span>clearer.</span>
          </h2>
          <p className={styles.aboutDescription}>
            MoneyMate is a personal finance platform built to help you
            understand, manage, and improve your spending habits.
          </p>
          <div className={styles.aboutHighlights}>
            <span>Understand where your money goes</span>
            <span>Build healthier spending habits</span>
            <span>Turn financial goals into progress</span>
          </div>
        </div>
      </section>

      <section className={styles.featureSection} id="features">
        <div className={styles.featureHeading}>
          <h2>
            Explore Powerful <span>Features</span>
          </h2>
          <span className={styles.headingGlow} aria-hidden="true" />
          <p>
            MoneyMate gives you the tools and insights to manage your money
            smarter, save more, and reach your financial goals with confidence.
          </p>
        </div>

        <div className={styles.featureGrid}>
          {features.map((feature) => (
            <article key={feature.title}>
              <span className={styles.cardGlow} aria-hidden="true" />
              <div className={styles.featureIcon}>
                <FeatureIcon type={feature.icon} />
              </div>
              <div className={styles.featureCopy}>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </div>
              <Link
                aria-label={`Sign up to use ${feature.title}`}
                className={styles.featureArrow}
                to="/register"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M5 12h13M13 6l6 6-6 6" />
                </svg>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.howSection} id="how-it-works">
        <div className={styles.featureHeading}>
          <h2>
            How It <span>Works</span>
          </h2>
          <span className={styles.headingGlow} aria-hidden="true" />
          <p>
            A simple three-step flow that keeps setup easy and turns your
            spending into something you can actually act on.
          </p>
        </div>

        <div className={styles.howGrid}>
          {howItWorks.map((step, index) => (
            <article className={styles.flipCard} key={step.title}>
              <div className={styles.flipCardInner}>
                <div className={styles.flipCardFace}>
                  <span className={styles.flipCardGlow} aria-hidden="true" />
                  <div className={styles.flipCardIcon}>
                    <StepIcon type={step.icon} />
                  </div>
                  <h3>{step.title}</h3>
                  <p>Hover to reveal the step details.</p>
                </div>
                <div className={styles.flipCardBack}>
                  <p className={styles.sectionLabel}>Step {index + 1}</p>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.faqSection} id="faq">
        <div className={styles.featureHeading}>
          <h2>
            Frequently Asked <span>Questions</span>
          </h2>
          <span className={styles.headingGlow} aria-hidden="true" />
          <p>
            Quick answers to the questions people ask most often before getting
            started.
          </p>
        </div>

        <div className={styles.faqList}>
          {faqs.map((faq) => (
            <details className={styles.faqItem} key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.contactSection} id="contact">
        <div className={styles.contactVisual} aria-hidden="true">
          <div className={styles.contactGlow} />
          <img
            className={styles.contactImage}
            src="/moneymate-contact-envelope.png"
            alt=""
          />
        </div>
        <div className={styles.contactCopy}>
          <p className={styles.sectionLabel}>Contact</p>
          <h2>Need a hand? Let&apos;s talk.</h2>
          <p>
            If you have any questions, don&apos;t hesitate. Email us at{" "}
            <a
              className={styles.contactButton}
              href="mailto:moneymate.app.mail@gmail.com"
            >
              moneymate.app.mail@gmail.com
            </a>
          </p>
        </div>
      </section>

      <footer className={styles.footer}>
        <div>
          <Link className={styles.brand} to="/" aria-label="MoneyMate home">
            <img src="/moneymate-logo.png" alt="" />
            <span>
              Money<span>Mate</span>
            </span>
          </Link>
          <p>Track smarter, spend better, and grow with confidence.</p>
        </div>
        <nav className={styles.footerColumns} aria-label="Footer navigation">
          <div className={styles.footerColumn}>
            <h3>Product</h3>
            <a
              href="#features"
              onClick={(event) => scrollToSection(event, "features")}
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={(event) => scrollToSection(event, "how-it-works")}
            >
              How It Works
            </a>
            <a href="#faq" onClick={(event) => scrollToSection(event, "faq")}>
              FAQ
            </a>
          </div>
          <div className={styles.footerColumn}>
            <h3>Company</h3>
            <a href="#about" onClick={(event) => scrollToSection(event, "about")}>
              About Us
            </a>
            <a href="#contact" onClick={(event) => scrollToSection(event, "contact")}>
              Contact
            </a>
            <span className={styles.footerDisabledLink} aria-disabled="true">
              Careers
            </span>
          </div>
          <div className={styles.footerColumn}>
            <h3>Legal</h3>
            <span className={styles.footerDisabledLink} aria-disabled="true">
              Privacy Policy
            </span>
            <span className={styles.footerDisabledLink} aria-disabled="true">
              Terms of Service
            </span>
            <span className={styles.footerDisabledLink} aria-disabled="true">
              Cookie Policy
            </span>
          </div>
        </nav>
      </footer>
    </main>
  );
}
