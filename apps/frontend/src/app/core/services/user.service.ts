import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

import { User } from '../models/user.model';
import { environment } from '../../../environments/environment';
export type { User };

@Injectable({
    providedIn: 'root'
})
export class UserService {
    private http = inject(HttpClient);
    private authService = inject(AuthService);
    private apiUrl = `${environment.apiUrl}/auth/me/`;

    constructor() { }

    getUser(): Observable<User> {
        const token = this.authService.getToken();

        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });

        return this.http.get<User>(this.apiUrl, { headers });
    }
}
