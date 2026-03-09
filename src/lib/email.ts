import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export interface StatementEmailData {
  to: string;
  customerName: string;
  period: string;         // "March 2026"
  carparkName: string;
  sessions: Array<{
    stay: string;
    name: string;
    rego: string;
    cost: number;
  }>;
  previousBalance: number;
  thisMonthTotal: number;
  payments: number;
  closingBalance: number;
  paymentLink: string;
}

export async function sendMonthlyStatementEmail(data: StatementEmailData): Promise<void> {
  const sessionRows = data.sessions
    .map(
      (s) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${s.stay}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${s.name}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${s.rego}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">$${s.cost.toFixed(2)}</td>
    </tr>`
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#1e3a5f;">${data.carparkName} — ${data.period} Accounts</h2>
  <p>Dear ${data.customerName},</p>
  <p>Please find your parking account statement for <strong>${data.period}</strong> below.</p>

  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <thead>
      <tr style="background:#1e3a5f;color:#fff;">
        <th style="padding:8px;text-align:left;">Stay</th>
        <th style="padding:8px;text-align:left;">Name</th>
        <th style="padding:8px;text-align:left;">Rego</th>
        <th style="padding:8px;text-align:right;">Cost</th>
      </tr>
    </thead>
    <tbody>
      ${sessionRows}
    </tbody>
  </table>

  <table style="width:100%;max-width:300px;margin-left:auto;">
    <tr><td>Previous Balance:</td><td style="text-align:right;">$${data.previousBalance.toFixed(2)}</td></tr>
    <tr><td>This Month:</td><td style="text-align:right;">$${data.thisMonthTotal.toFixed(2)}</td></tr>
    <tr><td>Payments Received:</td><td style="text-align:right;">-$${data.payments.toFixed(2)}</td></tr>
    <tr style="font-weight:bold;font-size:1.1em;color:#1e3a5f;">
      <td>Amount Due:</td>
      <td style="text-align:right;">$${data.closingBalance.toFixed(2)}</td>
    </tr>
  </table>

  ${
    data.closingBalance > 0
      ? `<div style="margin:24px 0;text-align:center;">
      <a href="${data.paymentLink}" 
         style="background:#1e3a5f;color:#fff;padding:12px 32px;text-decoration:none;border-radius:6px;font-size:1.1em;">
        Pay Now — $${data.closingBalance.toFixed(2)}
      </a>
    </div>`
      : '<p style="color:green;">Your account is up to date. Thank you!</p>'
  }

  <p style="color:#666;font-size:0.9em;">
    If you have any questions, please contact us.<br>
    ${data.carparkName}
  </p>
</body>
</html>`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: data.to,
    subject: `${data.carparkName} — ${data.period} Account Statement`,
    html,
  });
}

export async function sendReceiptEmail(data: {
  to: string;
  customerName: string;
  invoiceNo: number;
  rego: string;
  dateIn: string;
  returnDate: string;
  amount: number;
  paymentStatus: string;
  carparkName: string;
}): Promise<void> {
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#333;max-width:500px;margin:0 auto;padding:20px;">
  <h2 style="color:#1e3a5f;">${data.carparkName} — Receipt</h2>
  <p>Dear ${data.customerName},</p>
  <p>Thank you for parking with us. Here is your receipt:</p>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:6px 0;"><strong>Invoice #:</strong></td><td>${data.invoiceNo}</td></tr>
    <tr><td style="padding:6px 0;"><strong>Vehicle Rego:</strong></td><td>${data.rego}</td></tr>
    <tr><td style="padding:6px 0;"><strong>Date In:</strong></td><td>${data.dateIn}</td></tr>
    <tr><td style="padding:6px 0;"><strong>Return Date:</strong></td><td>${data.returnDate}</td></tr>
    <tr><td style="padding:6px 0;"><strong>Amount:</strong></td><td>$${data.amount.toFixed(2)}</td></tr>
    <tr><td style="padding:6px 0;"><strong>Payment:</strong></td><td>${data.paymentStatus}</td></tr>
  </table>
  <p style="color:#666;font-size:0.9em;">${data.carparkName}</p>
</body>
</html>`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: data.to,
    subject: `${data.carparkName} — Invoice #${data.invoiceNo} Receipt`,
    html,
  });
}
