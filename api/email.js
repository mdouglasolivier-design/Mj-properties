/**
 * /api/email — admin sends an email reply to a client message.
 *
 * POST { to, subject, body, inReplyToId? }   (admin only)
 *
 * Uses nodemailer with SMTP credentials from env:
 *   SMTP_HOST (e.g. smtp.gmail.com), SMTP_PORT (465),
 *   SMTP_USER, SMTP_PASS (app password), MAIL_FROM (optional; defaults to SMTP_USER)
 */
import nodemailer from 'nodemailer';
import { readData, writeData, cors, parseBody } from './_lib/data.js';
import { requireAdmin } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = requireAdmin(req, res);
  if (!session) return;

  const body = parseBody(req);
  const { to, subject, text, html, messageId } = body;

  if (!to || !subject || (!text && !html)) {
    return res.status(400).json({ error: 'Fields required: to, subject, and text or html' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ error: 'Invalid recipient email address' });
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return res.status(503).json({
      error: 'Email not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in Vercel project settings.',
      hint: 'For Gmail: enable 2FA, create an App Password, use smtp.gmail.com:465'
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || '465', 10),
      secure: (SMTP_PORT || '465') === '465',
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });

    const from = MAIL_FROM || SMTP_USER;
    const info = await transporter.sendMail({
      from: `"MJ Properties" <${from}>`,
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
      replyTo: from
    });

    // If replying to a stored message, log it and mark the original as answered
    if (messageId) {
      const data = await readData();
      const original = data.messages.find(m => m.id === parseInt(messageId, 10));
      if (original && original.status === 'new') {
        original.status = 'read';
      }
      original.repliedAt = new Date().toISOString();
      await writeData(data);
    }

    return res.status(200).json({ ok: true, messageId: info.messageId, accepted: info.accepted });
  } catch (err) {
    return res.status(502).json({ error: 'Email send failed: ' + (err && err.message) });
  }
}
