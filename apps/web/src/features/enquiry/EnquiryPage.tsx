import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Link, useParams } from 'react-router-dom';
import type { EnquiryRequest } from '../../api/client';
import { useProduct, useSubmitEnquiry } from '../../api/queries';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';

const enquiryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter your name.')
    .max(100, 'Name must be 100 characters or fewer.'),
  email: z
    .string()
    .email('Enter a valid email address.')
    .max(254, 'Email must be 254 characters or fewer.'),
  phone: z.union([
    z.literal(''),
    z
      .string()
      .min(7, 'Phone must be at least 7 characters.')
      .max(20, 'Phone must be 20 characters or fewer.')
      .regex(/^[0-9 +()-]+$/, 'Use only numbers, spaces, +, -, ( or ).'),
  ]),
  message: z.string().max(1000, 'Message must be 1000 characters or fewer.'),
  website: z.string(),
});

type FormValues = z.input<typeof enquiryFormSchema>;
type FieldName = keyof FormValues;
const initialValues: FormValues = {
  name: '',
  email: '',
  phone: '',
  message: '',
  website: '',
};

export function EnquiryPage() {
  const { id = '' } = useParams();
  const productId = /^\d+$/.test(id) ? Number(id) : Number.NaN;
  const productQuery = useProduct(productId);

  if (!Number.isSafeInteger(productId) || productId < 1) {
    return (
      <div className="inline-error" role="alert">
        This product address is invalid. <Link to="/">Browse products</Link>
      </div>
    );
  }
  if (productQuery.isPending)
    return <LoadingState label="Loading product details…" />;
  if (productQuery.isError)
    return (
      <ErrorState
        message={productQuery.error.message}
        onRetry={() => void productQuery.refetch()}
      />
    );

  return (
    <EnquiryForm
      productId={productId}
      productTitle={productQuery.data.product.title}
    />
  );
}

function EnquiryForm({
  productId,
  productTitle,
}: {
  productId: number;
  productTitle: string;
}) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FieldName, string>>
  >({});
  const mutation = useSubmitEnquiry();

  function updateField(field: FieldName, value: string) {
    mutation.reset();
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = enquiryFormSchema.safeParse(values);
    if (!result.success) {
      const nextErrors: Partial<Record<FieldName, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (
          typeof field === 'string' &&
          field in values &&
          !nextErrors[field as FieldName]
        ) {
          nextErrors[field as FieldName] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    const enquiry: EnquiryRequest = {
      productId,
      name: result.data.name,
      email: result.data.email,
      ...(result.data.phone ? { phone: result.data.phone } : {}),
      ...(result.data.message ? { message: result.data.message } : {}),
      website: result.data.website,
    };
    mutation.mutate(enquiry);
  }

  if (mutation.isSuccess) {
    return (
      <section className="thank-you-card" aria-live="polite">
        <span className="success-mark" aria-hidden="true">
          ✓
        </span>
        <span className="eyebrow">Enquiry received</span>
        <h1>Thank you for getting in touch.</h1>
        <p>
          Your enquiry about <strong>{productTitle}</strong> has been sent to
          our team.
        </p>
        <Link className="button button-primary" to="/">
          Continue browsing
        </Link>
      </section>
    );
  }

  return (
    <section className="enquiry-layout">
      <div className="enquiry-intro">
        <Link className="back-link" to={`/products/${productId}`}>
          ← Back to product
        </Link>
        <span className="eyebrow">Talk to our team</span>
        <h1>Ask us about this product.</h1>
        <p>Send a few details and our sales team will get back to you.</p>
        <div className="enquiry-product">
          <span>Enquiring about</span>
          <strong>{productTitle}</strong>
        </div>
      </div>
      <form className="enquiry-form" onSubmit={submit} noValidate>
        {mutation.isError && (
          <div className="form-alert" role="alert">
            {mutation.error.message}
          </div>
        )}
        <div className="form-field">
          <label htmlFor="enquiry-name">
            Name <span aria-hidden="true">*</span>
          </label>
          <input
            id="enquiry-name"
            name="name"
            autoComplete="name"
            value={values.name}
            onChange={(event) => updateField('name', event.target.value)}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? 'name-error' : undefined}
          />
          {fieldErrors.name && (
            <span className="field-error" id="name-error" role="alert">
              {fieldErrors.name}
            </span>
          )}
        </div>
        <div className="form-field">
          <label htmlFor="enquiry-email">
            Email <span aria-hidden="true">*</span>
          </label>
          <input
            id="enquiry-email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => updateField('email', event.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          />
          {fieldErrors.email && (
            <span className="field-error" id="email-error" role="alert">
              {fieldErrors.email}
            </span>
          )}
        </div>
        <div className="form-field">
          <label htmlFor="enquiry-phone">
            Phone <span className="optional-label">Optional</span>
          </label>
          <input
            id="enquiry-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={(event) => updateField('phone', event.target.value)}
            aria-invalid={Boolean(fieldErrors.phone)}
            aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
          />
          {fieldErrors.phone && (
            <span className="field-error" id="phone-error" role="alert">
              {fieldErrors.phone}
            </span>
          )}
        </div>
        <div className="form-field">
          <label htmlFor="enquiry-message">
            Message <span className="optional-label">Optional</span>
          </label>
          <textarea
            id="enquiry-message"
            name="message"
            rows={5}
            maxLength={1000}
            value={values.message}
            onChange={(event) => updateField('message', event.target.value)}
            aria-invalid={Boolean(fieldErrors.message)}
            aria-describedby={
              fieldErrors.message ? 'message-error' : 'message-hint'
            }
          />
          {fieldErrors.message ? (
            <span className="field-error" id="message-error" role="alert">
              {fieldErrors.message}
            </span>
          ) : (
            <span className="field-hint" id="message-hint">
              Up to 1000 characters.
            </span>
          )}
        </div>
        <div className="honeypot-field" aria-hidden="true">
          <label htmlFor="enquiry-website">Website</label>
          <input
            id="enquiry-website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={values.website}
            onChange={(event) => updateField('website', event.target.value)}
          />
        </div>
        <button
          className="button button-primary submit-button"
          type="submit"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Sending…' : 'Send enquiry'}
        </button>
        <p className="form-footnote" aria-live="polite">
          Fields marked with * are required.
        </p>
      </form>
    </section>
  );
}
