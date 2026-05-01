import nodemailer from 'nodemailer';

function optEnv(name: string) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : null;
}

function requiredEnv(name: string) {
  const v = optEnv(name);
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

export type EmailReport = {
  subject: string;
  text: string;
};

export async function sendEmailReport(report: EmailReport): Promise<{ sent: boolean; skippedReason?: string }> {
  const to = optEnv('SYNC_REPORT_EMAIL_TO') ?? 'sistemas.desarrollo@winston93.edu.mx';

  // Si no hay SMTP configurado, no bloqueamos el sync (solo lo reportamos en respuesta).
  const host = optEnv('SMTP_HOST');
  const user = optEnv('SMTP_USER');
  const pass = optEnv('SMTP_PASS');
  if (!host || !user || !pass) {
    return { sent: false, skippedReason: 'SMTP no configurado (SMTP_HOST/SMTP_USER/SMTP_PASS)' };
  }

  const port = Number(optEnv('SMTP_PORT') ?? '587');
  const secure = (optEnv('SMTP_SECURE') ?? '').toLowerCase() === 'true';
  const from = optEnv('SYNC_REPORT_EMAIL_FROM') ?? requiredEnv('SMTP_FROM');

  const transporter = nodemailer.createTransport({
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to,
    subject: report.subject,
    text: report.text,
  });

  return { sent: true };
}

