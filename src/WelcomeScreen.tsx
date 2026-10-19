import './WelcomeScreen.css'

type WelcomeScreenProps = {
  onSignIn: () => void
  onSignUp: () => void
}

export default function WelcomeScreen({ onSignIn, onSignUp }: WelcomeScreenProps) {
  return (
    <main className="welcome-page">
      <section className="welcome-screen" aria-labelledby="welcome-title">
        <div className="welcome-content">
          <header className="welcome-brand">
            <div className="welcome-emblem" aria-hidden="true">
              <svg viewBox="0 0 64 64" fill="none">
                <path d="M23 34v-7a9 9 0 1 1 18 0v7l8 7v8H15v-8l8-7Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
                <path d="M14 56h36M26 43h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <h1 id="welcome-title">DigiStamp</h1>
            <p className="welcome-tagline">Scan. Play. Earn. Return.</p>
          </header>

          <div className="welcome-intro">
            <h2>Your next visit.<br />A little more rewarding.</h2>
            <p>Keep your stamps in one place and turn everyday visits into rewards worth coming back for.</p>
          </div>

          <figure className="welcome-paper" aria-label="Sample loyalty card showing three of five stamps collected">
            <div className="stamp-paper" aria-hidden="true">
              <div className="stamp-paper-heading"><strong>Your next reward</strong><span>3 / 5 stamps</span></div>
              <div className="paper-stamps">
                {[0, 1, 2, 3, 4].map(index => (
                  <span key={index} className={index < 3 ? 'paper-stamp is-stamped' : 'paper-stamp'}>
                    {index < 3 ? (
                      <svg viewBox="0 0 24 24" fill="none"><path d="m6 12 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    ) : index === 4 ? (
                      <svg viewBox="0 0 24 24" fill="none"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                    ) : null}
                  </span>
                ))}
              </div>
              <p>Every visit brings you closer.</p>
            </div>
            <figcaption>Sample stamp card</figcaption>
          </figure>
        </div>

        <footer className="welcome-actions">
          <button type="button" className="primary-button welcome-sign-in" onClick={onSignIn}>Sign In</button>
          <p className="welcome-account">New to DigiStamp?</p>
          <button type="button" className="text-button welcome-sign-up" onClick={onSignUp}>Create an account</button>
        </footer>
      </section>
    </main>
  )
}
