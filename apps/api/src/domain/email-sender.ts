export type OutgoingEmail = {
  to: string;
  from: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
};

export interface EmailSender {
  send(email: OutgoingEmail): Promise<void>;
}
