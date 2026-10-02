import { EmailProvider, EmailSendResult } from '../../types';

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

// TODO: Implement real SMTP email sending when credentials are available.
// This provider uses the standard nodemailer-compatible approach.
// For production, install `nodemailer` and configure with real SMTP credentials.
export class SmtpEmailProvider implements EmailProvider {
  private smtpConfig: SmtpConfig;
  private fromAddress: string;

  constructor(smtpConfig: SmtpConfig, fromAddress: string) {
    this.smtpConfig = smtpConfig;
    this.fromAddress = fromAddress;
  }

  async sendBookEmail(
    to: string,
    bookTitles: string[],
    bookFiles: { title: string; url: string }[]
  ): Promise<EmailSendResult> {
    if (!this.smtpConfig.user || !this.smtpConfig.pass) {
      throw new Error(
        'SMTP credentials are not configured. Set SMTP_USER and SMTP_PASS in environment.'
      );
    }

    // TODO: Replace with real nodemailer implementation
    // Example:
    // const transporter = nodemailer.createTransport({
    //   host: this.smtpConfig.host,
    //   port: this.smtpConfig.port,
    //   secure: false,
    //   auth: { user: this.smtpConfig.user, pass: this.smtpConfig.pass },
    // });
    //
    // const bookList = bookTitles.map((t, i) => `${i + 1}. ${t}`).join('\n');
    // const attachments = bookFiles.map(f => ({ filename: f.title, path: f.url }));
    //
    // await transporter.sendMail({
    //   from: this.fromAddress,
    //   to,
    //   subject: 'BonBook - کتاب‌های خریداری شده شما',
    //   text: `سلام،\n\nکتاب‌های زیر خریداری شده‌اند:\n${bookList}\n\nبا تشکر,\nBonBook`,
    //   attachments,
    // });

    throw new Error(
      'Email sending is not yet implemented. Install nodemailer and configure SMTP credentials.'
    );
  }
}
