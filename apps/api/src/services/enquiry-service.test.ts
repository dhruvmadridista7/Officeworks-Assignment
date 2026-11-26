import { describe, expect, it, vi } from 'vitest';
import productsFixture from '../../test/fixtures/products.json';
import { EmailDeliveryFailedError } from '../domain/errors';
import type { EmailSender, OutgoingEmail } from '../domain/email-sender';
import type { ProductRepository } from '../domain/product-repository';
import type { Product } from '../domain/product';
import { EnquiryService, type EnquiryInput } from './enquiry-service';

const product: Product = {
  ...productsFixture[0],
  category: { name: 'electronics', slug: 'electronics' },
};
const input: EnquiryInput = {
  productId: product.id,
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+91 98765 43210',
  message: 'Is this in stock?',
};

function makeService(
  options: {
    product?: Product | null;
    emailSender?: EmailSender;
    logger?: {
      info: (fields: Record<string, unknown>, message: string) => void;
    };
  } = {},
) {
  const repository: ProductRepository = {
    list: vi.fn(async () => [product]),
    listCategories: vi.fn(async () => [product.category]),
    getById: vi.fn(async () =>
      options.product === undefined ? product : options.product,
    ),
  };
  const emailSender = options.emailSender ?? {
    send: vi.fn(async () => undefined),
  };
  const logger = options.logger ?? { info: vi.fn() };
  return {
    service: new EnquiryService(
      repository,
      emailSender,
      'sales@example.com',
      'catalogue@example.com',
      logger,
    ),
    repository,
    emailSender,
    logger,
  };
}

describe('EnquiryService', () => {
  it('looks up the product and sends one correctly addressed email with plain and HTML bodies', async () => {
    const { service, emailSender } = makeService();

    await service.submit(input);

    expect(emailSender.send).toHaveBeenCalledOnce();
    expect(emailSender.send).toHaveBeenCalledWith({
      to: 'sales@example.com',
      from: 'catalogue@example.com',
      replyTo: 'jane@example.com',
      subject: `New enquiry: ${product.title} (#${product.id})`,
      text: [
        `Product ID: ${product.id}`,
        `Product: ${product.title}`,
        `Price: ${product.price}`,
        'Name: Jane Doe',
        'Email: jane@example.com',
        'Phone: +91 98765 43210',
        'Message: Is this in stock?',
      ].join('\n'),
      html: expect.stringContaining(
        '<strong>Message:</strong> Is this in stock?',
      ),
    });
  });

  it('escapes customer content and strips CR/LF from email headers', async () => {
    const unsafeProduct = {
      ...product,
      title: 'Chair\r\nBcc: attacker@example.com',
    };
    const sent: OutgoingEmail[] = [];
    const sender: EmailSender = {
      send: vi.fn(async (email) => {
        sent.push(email);
      }),
    };
    const { service } = makeService({
      product: unsafeProduct,
      emailSender: sender,
    });

    await service.submit({
      ...input,
      name: "Jane <script>alert('x')</script> & Co",
      email: 'jane@example.com\r\nBcc:attacker@example.com',
      message: '<img src=x onerror=alert(1)> & hello',
    });

    const email = sent[0];
    expect(email?.subject).not.toMatch(/[\r\n]/);
    expect(email?.replyTo).not.toMatch(/[\r\n]/);
    expect(email?.html).toContain(
      '&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; Co',
    );
    expect(email?.html).toContain(
      '&lt;img src=x onerror=alert(1)&gt; &amp; hello',
    );
    expect(email?.html).not.toContain('<script>');
  });

  it('rejects an unknown product without sending email', async () => {
    const sender: EmailSender = { send: vi.fn(async () => undefined) };
    const { service } = makeService({ product: null, emailSender: sender });

    await expect(service.submit(input)).rejects.toMatchObject({
      name: 'ProductNotFoundError',
    });
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('returns success silently for the honeypot and logs the hit', async () => {
    const sender: EmailSender = { send: vi.fn(async () => undefined) };
    const logger = { info: vi.fn() };
    const { service, repository } = makeService({
      emailSender: sender,
      logger,
    });

    await expect(
      service.submit({ ...input, website: 'bot-filled-this' }),
    ).resolves.toBeUndefined();

    expect(sender.send).not.toHaveBeenCalled();
    expect(repository.getById).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      { honeypotTriggered: true },
      'Enquiry honeypot triggered',
    );
  });

  it('wraps email provider failures in a typed delivery error', async () => {
    const sender = {
      send: vi.fn(async () => {
        throw new Error('private SMTP detail');
      }),
    };
    const { service } = makeService({ emailSender: sender });

    await expect(service.submit(input)).rejects.toBeInstanceOf(
      EmailDeliveryFailedError,
    );
  });
});
