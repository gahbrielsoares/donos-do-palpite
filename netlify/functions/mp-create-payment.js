const mercadopago = require('mercadopago');

function withCors(headers = {}) {
  return {
    ...headers,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: withCors(), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: withCors(),
      body: JSON.stringify({ error: 'Método não permitido' })
    };
  }

  try {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error('MP_ACCESS_TOKEN não configurado no Netlify');

    mercadopago.configure({ access_token: token });

    const body = JSON.parse(event.body || '{}');
    const { amount, payer, bet } = body;

    // amount em reais (ex: 4.00). Vamos converter para number com 2 casas.
    const txAmount = Number(amount);
    if (!txAmount || txAmount < 1) throw new Error('Valor inválido');

    if (!payer?.name || !payer?.email || !payer?.cpf || !payer?.phone) {
      throw new Error('Dados do pagador incompletos (name, email, cpf, phone)');
    }

    // CPF somente números
    const cpf = String(payer.cpf).replace(/\D/g, '');
    if (cpf.length !== 11) throw new Error('CPF inválido');

    const phoneDigits = String(payer.phone).replace(/\D/g, '');
    if (phoneDigits.length < 10) throw new Error('Telefone inválido');

    // Referência para você cruzar no admin (não é “seguro” como DB, mas ajuda)
    const externalReference = bet?.id || `bet_${Date.now()}`;

    const paymentData = {
      transaction_amount: txAmount,
      description: `Donos do Palpite - Aposta ${externalReference}`,
      payment_method_id: 'pix',
      payer: {
        email: payer.email,
        first_name: payer.name,
        identification: {
          type: 'CPF',
          number: cpf
        }
      },
      external_reference: externalReference,
      notification_url: bet?.webhookUrl || undefined, // opcional (ver webhook abaixo)
      metadata: {
        bet_id: externalReference,
        // cuidado com tamanho; não enviar tudo gigante
        games_count: Array.isArray(bet?.games) ? bet.games.length : undefined
      }
    };

    const result = await mercadopago.payment.create(paymentData);

    const mp = result?.body;
    const qrBase64 = mp?.point_of_interaction?.transaction_data?.qr_code_base64;
    const qrCode = mp?.point_of_interaction?.transaction_data?.qr_code; // copia e cola
    const ticketUrl = mp?.point_of_interaction?.transaction_data?.ticket_url;

    if (!qrBase64 || !qrCode) {
      throw new Error('Mercado Pago não retornou dados do PIX (qr_code / qr_code_base64)');
    }

    return {
      statusCode: 200,
      headers: withCors(),
      body: JSON.stringify({
        ok: true,
        mp_payment_id: mp.id,
        status: mp.status,
        external_reference: mp.external_reference,
        pix: {
          qr_code_base64: qrBase64,
          qr_code: qrCode,
          ticket_url: ticketUrl
        }
      })
    };
  } catch (err) {
    return {
      statusCode: 400,
      headers: withCors(),
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
