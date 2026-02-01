# STRIPE_TAX

## Activation
`STRIPE_TAX_ENABLED=true` obligatoire.
Assurez-vous que Stripe Tax est activé dans votre dashboard, sinon la création de Checkout échouera.

## Checkout
`automatic_tax: { enabled: true }` sur chaque Checkout Session.
`customer_update.address = "auto"` pour permettre la collecte d'adresse nécessaire.

## Contrôles
- TVA calculée par Stripe sur les factures.
- Vérifier devises/pays dans Stripe Dashboard.
