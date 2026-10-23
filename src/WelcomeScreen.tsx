import './WelcomeScreen.css'
import StampIcon from './StampIcon'

type WelcomeScreenProps = { onSignIn: () => void; onSignUp: () => void }

export default function WelcomeScreen({ onSignIn, onSignUp }: WelcomeScreenProps) {
  return (
    <main className="welcome-page">
      <section className="welcome-screen" aria-labelledby="welcome-title">
        <div className="welcome-content">
          <header className="welcome-brand">
            <h1 id="welcome-title"><img className="brand-wordmark" src="/brand/digistamp-wordmark.svg" alt="DigiStamp" width="577" height="129" /></h1>
            <p className="welcome-tagline">Scan. Play. Earn. Return.</p>
          </header>
          <div className="welcome-intro">
            <h2>Your next visit.<br />A little more rewarding.</h2>
            <p>Keep your stamps in one place and turn everyday visits into rewards worth coming back for.</p>
          </div>
          <figure className="welcome-paper" aria-label="Sample loyalty card showing three of five stamps collected">
            <div className="stamp-paper" aria-hidden="true">
              <div className="stamp-paper-heading"><strong>Your next reward</strong><span><b>3</b> / 5 stamps</span></div>
              <div className="paper-stamps">
                {[0, 1, 2, 3, 4].map(index => (
                  <span key={index} className={index < 3 ? 'paper-stamp is-stamped' : 'paper-stamp'}>
                    {index < 3 ? <StampIcon kind="check" /> : index === 4 ? <StampIcon kind="star" /> : null}
                  </span>
                ))}
              </div>
              <p>Every visit brings you closer.</p>
            </div>
            <figcaption>Sample stamp card</figcaption>
          </figure>
        </div>
        <footer className="welcome-actions">
          <button type="button" className="primary-button welcome-sign-in" onClick={onSignIn}>Sign In<span aria-hidden="true">&rarr;</span></button>
          <p className="welcome-account">New to DigiStamp? <button type="button" className="text-button welcome-sign-up" onClick={onSignUp}>Create an account</button></p>
        </footer>
      </section>
    </main>
  )
}
