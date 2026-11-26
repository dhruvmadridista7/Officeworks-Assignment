import type { EmailSender, OutgoingEmail } from '../domain/email-sender';

export class ConsoleEmailSender implements EmailSender {
  async send(email: OutgoingEmail): Promise<void> {
    process.stdout.write(
      `${JSON.stringify({ level: 'info', message: 'Console email captured', email })}\n`,
    );
  }
}
