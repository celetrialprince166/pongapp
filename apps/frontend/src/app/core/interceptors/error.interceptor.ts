import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.error instanceof ErrorEvent) {
        console.error('Client-side error:', error.error.message);
      } else {
        // 401 is handled by authInterceptor (token refresh → logout)
        switch (error.status) {
          case 403:
            console.error('Access forbidden');
            break;
          case 404:
            console.error('Resource not found');
            break;
          case 500:
            console.error('Internal server error');
            break;
          default:
            if (error.status !== 401) {
              console.error(`Unexpected error: ${error.status}`);
            }
        }
      }

      return throwError(() => ({
        status: error.status,
        message: error.message,
        error: error.error
      }));
    })
  );
};
