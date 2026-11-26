import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { EnquiryInput, EnquiryService } from '../services/enquiry-service';
import { asyncHandler } from './async-handler';

const enquiryBodySchema = z.object({
  productId: z.number().int().positive().safe(),
  name: z.string().trim().min(1).max(100),
  email: z.string().email().max(254),
  phone: z
    .string()
    .min(7)
    .max(20)
    .regex(/^[0-9 +()-]+$/)
    .optional(),
  message: z.string().max(1000).optional(),
  website: z.string().optional(),
});

export function createEnquiryController(
  service: EnquiryService,
): RequestHandler {
  return asyncHandler(async (request, response) => {
    if (
      typeof request.body === 'object' &&
      request.body !== null &&
      'website' in request.body &&
      typeof request.body.website === 'string' &&
      request.body.website.length > 0
    ) {
      service.submitHoneypot();
      response.status(201).json({ status: 'received' });
      return;
    }
    const input: EnquiryInput = enquiryBodySchema.parse(request.body);
    await service.submit(input);
    response.status(201).json({ status: 'received' });
  });
}
