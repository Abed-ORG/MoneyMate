import { Link } from "react-router-dom";
import styles from "./LandingPage.module.css";

const features = [
  {
    title: "Clear spending insights",
    text: "See where your money goes with simple categories and visual summaries.",
  },
  {
    title: "Budgets that stay useful",
    text: "Plan monthly limits and keep an eye on progress before spending drifts.",
  },
  {
    title: "Goals you can reach",
    text: "Turn savings targets into practical milestones you can track over time.",
  },
];

export function LandingPage() {
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
          <a href="#features">Features</a>
          <a href="#about">About Us</a>
          <a href="#contact">Contact</a>
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
              <span aria-hidden="true">→</span>
            </Link>
            <a className={styles.secondaryCta} href="#features">
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
            <img src="/moneymate-logo.png" alt="" />
          </div>
          <span className={styles.lightBeam} />
        </div>
      </section>

      <section className={styles.featureSection} id="features">
        <p className={styles.sectionLabel}>Built for everyday money decisions</p>
        <h2>Everything you need to move with confidence.</h2>
        <div className={styles.featureGrid}>
          {features.map((feature, index) => (
            <article key={feature.title}>
              <span>0{index + 1}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.aboutSection} id="about">
        <div>
          <p className={styles.sectionLabel}>About MoneyMate</p>
          <h2>Money management without the noise.</h2>
        </div>
        <p>
          We are building a calmer, clearer way to understand spending, prepare
          for what is next, and make progress toward the goals that matter.
        </p>
      </section>

      <footer className={styles.footer} id="contact">
        <Link className={styles.brand} to="/" aria-label="MoneyMate home">
          <img src="/moneymate-logo.png" alt="" />
          <span>
            Money<span>Mate</span>
          </span>
        </Link>
        <p>Questions? Reach the MoneyMate team through your project workspace.</p>
      </footer>
    </main>
  );
}
