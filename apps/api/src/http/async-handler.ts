import type { Request, RequestHandler, Response } from 'express';

type AsyncAction = (request: Request, response: Response) => Promise<void>;

export function asyncHandler(action: AsyncAction): RequestHandler {
  return (request, response, next) => {
    void action(request, response).catch(next);
  };
}
