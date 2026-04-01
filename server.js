const express = require('express');
const stripe = require('stripe')('sk_test_SUA_CHAVE_SECRETA_AQUI'); // ⚠️ Substitua
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve os arquivos HTML

// Criar PaymentIntent (Cartão)
app.post('/api/create-payment-intent', async (req, res) => {
    const { amount, currency, user } = req.body;
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency,
            metadata: { user }
        });
        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Criar PIX (Stripe suporta PIX no Brasil)
app.post('/api/create-pix', async (req, res) => {
    const { amount, user } = req.body;
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: 'brl',
            payment_method_types: ['pix'],
            metadata: { user }
        });
        res.json({
            clientSecret: paymentIntent.client_secret,
            pixData: paymentIntent.next_action?.pix_display_qr_code
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => console.log('✅ Servidor rodando em http://localhost:3000'));