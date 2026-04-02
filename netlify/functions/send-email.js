const nodemailer = require('nodemailer');

function withCors(h = {}) {
  return { ...h, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: withCors(), body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: withCors(), body: JSON.stringify({ error: 'Método não permitido' }) };

  try {
    const { payer, cart, total, mpPaymentId, externalReference } = JSON.parse(event.body || '{}');
    const games = JSON.parse(process.env.ADMIN_GAMES || '[]');

    const optLabel = (sel, game) => {
      const opts = [game?.home || 'Time Casa', 'Empate', game?.away || 'Time Visitante'];
      return sel.map(i => opts[i]).join(' + ');
    };

    const gamesHtml = cart.map((bet, bi) =>
      `<h3 style="color:#e31d1a">Aposta ${bi + 1} — R$ ${Number(bet.price).toFixed(2)}</h3>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px">
        <tr style="background:#f0f0f0"><th>#</th><th>Jogo</th><th>Palpite(s)</th></tr>
        ${(bet.selections || []).map((sel, i) => {
          const g = games[i] || {};
          return `<tr><td>${i+1}</td><td>${g.home||'?'} x ${g.away||'?'}</td><td><strong>${optLabel(sel, g)}</strong></td></tr>`;
        }).join('')}
      </table><br>`
    ).join('');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:700px">
        <h2 style="background:#e31d1a;color:white;padding:15px;margin:0">🏆 Nova Aposta — Donos do Palpite</h2>
        <div style="padding:15px;background:#fff;border:1px solid #ddd">
          <h3>Dados do Apostador</h3>
          <p><b>Nome:</b> ${payer?.name}</p>
          <p><b>E-mail:</b> ${payer?.email}</p>
          <p><b>WhatsApp:</b> ${payer?.phone}</p>
          <p><b>CPF:</b> ${payer?.cpf}</p>
          <p><b>Total Pago:</b> R$ ${Number(total).toFixed(2)}</p>
          <p><b>ID Mercado Pago:</b> ${mpPaymentId}</p>
          <p><b>Referência:</b> ${externalReference}</p>
          <p><b>Data:</b> ${new Date().toLocaleString('pt-BR')}</p>
          <hr>
          <h3>Espelho das Apostas</h3>
          ${gamesHtml}
        </div>
      </div>`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
    });

    await transporter.sendMail({
      from: `"Donos do Palpite" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      subject: `🏆 Nova Aposta - ${payer?.name} - R$ ${Number(total).toFixed(2)}`,
      html
    });

    return { statusCode: 200, headers: withCors(), body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 400, headers: withCors(), body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
