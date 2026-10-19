type WelcomeScreenProps = {
  onSignIn: () => void
  onSignUp: () => void
}

export default function WelcomeScreen({ onSignIn, onSignUp }: WelcomeScreenProps) {
  return (
    <main className="welcome-page">
      <section className="welcome-screen" aria-labelledby="welcome-title">
        <header className="welcome-brand"><span className="welcome-brand-dot" aria-hidden="true" />DigiStamp</header>
        <div className="welcome-content">
          <div className="welcome-logo" aria-hidden="true">
            <svg viewBox="0 0 80 80" fill="none">
              <path d="M29 42v-6a11 11 0 1 1 22 0v6l7 7v8H22v-8l7-7Z" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
              <path d="M20 65h40M33 51h14" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <path d="m57 19 3 3 6-7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="welcome-eyebrow">A little stamp. A little joy.</p>
          <h1 id="welcome-title">Your next visit.<br />A little more rewarding.</h1>
          <p className="welcome-description">Keep your stamps in one place and turn everyday visits into rewards worth coming back for.</p>
          <div className="welcome-stamp-card" aria-hidden="true">
            <div className="welcome-card-heading"><span>Your next reward</span><span>3 / 5 stamps</span></div>
            <div className="welcome-stamps">
              <span className="is-collected">&#10003;</span><span className="is-collected">&#10003;</span><span className="is-collected">&#10003;</span><span /><span>&#9734;</span>
            </div>
            <p>Every visit brings you closer.</p>
          </div>
          <p className="welcome-tagline">Scan. Play. Earn. Return.</p>
        </div>
        <footer className="welcome-actions">
          <button type="button" className="primary-button" onClick={onSignIn}>Sign In <span aria-hidden="true">&rarr;</span></button>
          <p className="switch-text">New to DigiStamp? <button type="button" className="text-button" onClick={onSignUp}>Create an account</button></p>
        </footer>
      </section>
    </main>
  )
}
