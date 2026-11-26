import type { EmailSender, OutgoingEmail } from '../domain/email-sender';
import type { ProductRepository } from '../domain/product-repository';
import {
  EmailDeliveryFailedError,
  ProductNotFoundError,
} from '../domain/errors';

export type EnquiryInput = {
  productId: number;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  website?: string;
};

type EnquiryLogger = {
  info: (fields: Record<string, unknown>, message: string) => void;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character] ?? character;
  });
}

function stripHeaderBreaks(value: string): string {
  return value.replace(/[\r\n]/g, '');
}

export class EnquiryService {
  constructor(
    private readonly repository: ProductRepository,
    private readonly emailSender: EmailSender,
    private readonly salesInbox: string,
    private readonly emailFrom: string,
    private readonly logger: EnquiryLogger,
  ) {}

  submitHoneypot(): void {
    this.logger.info({ honeypotTriggered: true }, 'Enquiry honeypot triggered');
  }

  async submit(input: EnquiryInput): Promise<void> {
    if (input.website) {
      this.submitHoneypot();
      return;
    }

    const product = await this.repository.getById(input.productId);
    if (!product) throw new ProductNotFoundError(input.productId);

    const title = stripHeaderBreaks(product.title);
    const phone = input.phone ?? '';
    const message = input.message ?? '';
    const email: OutgoingEmail = {
      to: this.salesInbox,
      from: this.emailFrom,
      replyTo: stripHeaderBreaks(input.email),
      subject: `New enquiry: ${title} (#${product.id})`,
      text: [
        `Product ID: ${product.id}`,
        `Product: ${title}`,
        `Price: ${product.price}`,
        `Name: ${input.name}`,
        `Email: ${input.email}`,
        `Phone: ${phone || '(not provided)'}`,
        `Message: ${message || '(not provided)'}`,
      ].join('\n'),
      html: [
        '<h1>New product enquiry</h1>',
        `<p><strong>Product ID:</strong> ${product.id}</p>`,
        `<p><strong>Product:</strong> ${escapeHtml(product.title)}</p>`,
        `<p><strong>Price:</strong> ${product.price}</p>`,
        `<p><strong>Name:</strong> ${escapeHtml(input.name)}</p>`,
        `<p><strong>Email:</strong> ${escapeHtml(input.email)}</p>`,
        `<p><strong>Phone:</strong> ${escapeHtml(phone || '(not provided)')}</p>`,
        `<p><strong>Message:</strong> ${escapeHtml(message || '(not provided)')}</p>`,
      ].join(''),
    };

    try {
      await this.emailSender.send(email);
    } catch (cause) {
      throw new EmailDeliveryFailedError({ cause });
    }
  }
}
