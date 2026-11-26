import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { CatalogService } from './services/catalog-service';
import { createErrorHandler, HttpError } from './http/error-handler';
import { createRequestLogger, type RequestLogger } from './http/request-logger';
import { createApiRouter } from './http/routes';

export type AppDependencies = {
  catalogService: CatalogService;
  logger: RequestLogger;
  webOrigin: string;
};

export function buildApp(deps: AppDependencies): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        callback(null, origin === deps.webOrigin ? origin : false);
      },
    }),
  );
  app.use(createRequestLogger(deps.logger));
  app.use(express.json({ limit: '10kb' }));
  app.use('/api', createApiRouter(deps.catalogService));
  app.use((_request, _response, next) => {
    next(new HttpError(404, 'ROUTE_NOT_FOUND', 'Route not found.'));
  });
  app.use(createErrorHandler(deps.logger));

  return app;
}
