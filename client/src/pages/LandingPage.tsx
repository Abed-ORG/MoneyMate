import type { MouseEvent } from "react";
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

export function LandingPage() {
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
            href="#features"
            onClick={(event) => scrollToSection(event, "features")}
          >
            Features
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
        <div className={`${styles.aboutSide} ${styles.aboutSideLeft}`}>
          <p className={styles.sectionLabel}>About MoneyMate</p>
          <h2>
            Your financial life, made <span>clearer.</span>
          </h2>
          <p className={styles.aboutDescription}>
            MoneyMate is a personal finance platform built to help you
            understand, manage, and improve your spending habits.
          </p>
        </div>

        <div className={styles.aboutCenter} aria-hidden="true">
          <span className={styles.aboutOrbital} />
          <span className={styles.aboutOrbitalInner} />
          <span className={styles.aboutFloor} />
          <div className={styles.growthSculpture}>
            <img src="/moneymate-growth-3d.png" alt="" />
          </div>
        </div>

        <div className={`${styles.aboutSide} ${styles.aboutSideRight}`}>
          <p className={styles.sectionLabel}>One clear overview</p>
          <h3>See the whole picture. Make the next move.</h3>
          <p className={styles.aboutDescription}>
            Income, expenses, budgets, and financial goals come together in one
            visual space, making money tracking simple and stress-free.
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

      <footer className={styles.footer} id="contact">
        <Link className={styles.brand} to="/" aria-label="MoneyMate home">
          <img src="/moneymate-logo.png" alt="" />
          <span>
            Money<span>Mate</span>
          </span>
        </Link>
        <p>
          Questions? Email us at{' '}
          <a href="mailto:moneymate.app.mail@gmail.com">
            moneymate.app.mail@gmail.com
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
