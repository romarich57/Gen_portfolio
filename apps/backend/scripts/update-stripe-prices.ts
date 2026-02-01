import { prisma } from '../src/db/prisma';
import { PlanCode } from '@prisma/client';

async function updateStripePrices() {
    console.log('🔄 Mise à jour des prix Stripe...\n');

    // Mettre à jour PREMIUM
    const premium = await prisma.plan.update({
        where: { code: PlanCode.PREMIUM },
        data: {
            stripePriceId: 'price_1SuVL7JaHfe6i6nJTVf5FCTr',
            stripeProductId: 'prod_TsFq16Eg2gn0gC',
            amountCents: 1000,
            isActive: true
        }
    });
    console.log('✅ Plan PREMIUM mis à jour :');
    console.log(`   - Price ID: ${premium.stripePriceId}`);
    console.log(`   - Product ID: ${premium.stripeProductId}`);
    console.log(`   - Montant: ${premium.amountCents / 100}€\n`);

    // Mettre à jour VIP
    const vip = await prisma.plan.update({
        where: { code: PlanCode.VIP },
        data: {
            stripePriceId: 'price_1SvpZJJaHfe6i6nJuyau5zJc',
            stripeProductId: 'prod_TtcoYTaqhcaalC',
            amountCents: 3000,
            isActive: true
        }
    });
    console.log('✅ Plan VIP mis à jour :');
    console.log(`   - Price ID: ${vip.stripePriceId}`);
    console.log(`   - Product ID: ${vip.stripeProductId}`);
    console.log(`   - Montant: ${vip.amountCents / 100}€\n`);

    console.log('🎉 Tous les plans ont été mis à jour avec succès !');
}

updateStripePrices()
    .catch((error) => {
        console.error('❌ Erreur:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
