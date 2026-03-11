import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const { method, url } = req;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const statusCode = res.statusCode;
          const duration = Date.now() - now;
          this.logger.log(`${method} ${url} ${statusCode} +${duration}ms`);
        },
        error: (err: { status?: number }) => {
          const statusCode = err.status ?? 500;
          const duration = Date.now() - now;
          this.logger.warn(`${method} ${url} ${statusCode} +${duration}ms`);
        },
      }),
    );
  }
}
