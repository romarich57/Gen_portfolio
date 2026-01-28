# STRIPE_TAX

## Activation
`STRIPE_TAX_ENABLED=true` obligatoire.

## Checkout
`automatic_tax: { enabled: true }` sur chaque Checkout Session.

## Contrôles
- TVA calculée par Stripe sur les factures.
- Vérifier devises/pays dans Stripe Dashboard.
