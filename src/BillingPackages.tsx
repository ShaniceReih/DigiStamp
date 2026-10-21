import { billingPackages, customizationServices, formatPesos } from './lib/billingCatalog'

export default function BillingPackages() {
  return <section className="billing-packages" aria-labelledby="billing-packages-title">
    <h3 id="billing-packages-title">Packages</h3>
    <div className="billing-plan-list">{billingPackages.map(plan => <article className="billing-package" key={plan.name} aria-label={`${plan.name} package`}>
      <div className="billing-package-heading"><h4>{plan.name}</h4><p><strong>{formatPesos(plan.monthlyPrice)}</strong><span>per month / branch</span></p></div>
      {plan.includes && <p className="billing-note">Everything in {plan.includes}{plan.features.length ? ', plus:' : '.'}</p>}
      {plan.features.length > 0 && <ul className="billing-inclusions">{plan.features.map(feature => <li key={feature.name}><span>{feature.name}</span>{feature.comingSoon && <span className="billing-coming-soon">Coming soon</span>}</li>)}</ul>}
      {plan.note && <p className="billing-note">{plan.note}</p>}
    </article>)}</div>
    <details className="billing-services"><summary>One-time setup &amp; customization fees</summary>
      <dl>{customizationServices.map(service => <div key={service.name}><dt>{service.name}{service.note && <span>{service.note}</span>}</dt><dd>{service.fee ?? `${formatPesos(service.minimum!)}–${formatPesos(service.maximum!)}`}</dd></div>)}</dl>
    </details>
    <p className="billing-note">Online payments are not available yet.</p>
  </section>
}
