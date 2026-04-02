const nodemailer = require('nodemailer');

function withCors(headers = {}) {
  return {
    ...headers,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
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
      body: JSON.stringify({ error: 'Método não permitido' }),
    };
  }

  try {
    const { payer, cart, total, mpPaymentId, externalReference } = JSON.parse(event.body || '{}');

    // Função para formatar os palpites de cada jogo usando os nomes já no cart
    const optLabel = (sel, game) => {
      const opts = [game.home || 'Time Casa', 'Empate', game.away || 'Time Visitante'];
      return sel.length ? sel.map(i => opts[i]).join(' + ') : '—';
    };

    // Monta o HTML das apostas
    const betsHtml = cart.map((bet, i) => `
      <h3 style="color:#e31d1a;">Aposta ${i + 1} — R$ ${Number(bet.price).toFixed(2)}</h3>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px">
        <thead style="background:#f0f0f0;">
          <tr><th>#</th><th>Jogo</th><th>Palpite(s)</th></tr>
        </thead>
        <tbody>
          ${(bet.selections || []).map((selObj, idx) => {
            // selObj: { choices: [], home: '', away: '' }
            const game = selObj || {};
            const choices = game.choices || [];
            return `<tr>
              <td>${idx + 1}</td>
              <td>${game.home || '?'} x ${game.away || '?'}</td>
              <td><strong>${optLabel(choices, game)}</strong></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <br/>
    `).join('');

    // Monta o corpo do email em HTML
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:700px;">
        <h2 style="background:#e31d1a;color:#fff;padding:15px;margin:0;">🏆 Nova Aposta — Donos do Palpite</h2>
        <div style="padding:15px;background:#fff;border:1px solid #ddd;">
          <h3>Dados do Apostador</h3>
          <p><b>Nome:</b> ${payer?.name || '-'}</p>
          <p><b>E-mail:</b> ${payer?.email || '-'}</p>
          <p><b>WhatsApp:</b> ${payer?.phone || '-'}</p>
          <p><b>CPF:</b> ${payer?.cpf || '-'}</p>
          <p><b>Total Pago:</b> R$ ${Number(total).toFixed(2)}</p>
          <p><b>ID Mercado Pago:</b> ${mpPaymentId || '-'}</p>
          <p><b>Referência:</b> ${externalReference || '-'}</p>
          <p><b>Data:</b> ${new Date().toLocaleString('pt-BR')}</p>
          <hr/>
          <h3>Espelho das Apostas</h3>
          ${betsHtml}
        </div>
      </div>
    `;

    // Configurar o transporte SMTP (exemplo com Gmail)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER, // seu email Gmail
        pass: process.env.GMAIL_PASS, // senha de app do Gmail
      },
    });

    // Enviar o email
    await transporter.sendMail({
      from: `"Donos do Palpite" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER, // pode ser outro email admin
      subject: `🏆 Nova Aposta - ${payer?.name || 'Cliente'} - R$ ${Number(total).toFixed(2)}`,
      html,
    });

    return {
      statusCode: 200,
      headers: withCors(),
      body: JSON.stringify({ ok: true }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: withCors(),
      body: JSON.stringify({ ok: false, error: error.message }),
    };
  }
};
