import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailSender, OutgoingEmail } from '../domain/email-sender';

export type SmtpOptions = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
};

export class SmtpEmailSender implements EmailSender {
  private readonly transporter: Transporter;

  constructor(options: SmtpOptions) {
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      ...(options.user && options.pass
        ? { auth: { user: options.user, pass: options.pass } }
        : {}),
    });
  }

  async send(email: OutgoingEmail): Promise<void> {
    await this.transporter.sendMail(email);
  }
}
