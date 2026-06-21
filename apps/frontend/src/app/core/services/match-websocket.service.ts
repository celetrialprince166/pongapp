import { Injectable, NgZone, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Match } from '../models/match.model';

export interface MatchUpdateEvent {
  type: 'match_update';
  match: Match;
}

@Injectable({ providedIn: 'root' })
export class MatchWebSocketService {
  private ngZone = inject(NgZone);

  private socket?: WebSocket;
  private updates$ = new Subject<MatchUpdateEvent>();
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private currentMatchId?: number;

  connect(matchId: number): Observable<MatchUpdateEvent> {
    this.disconnect();
    this.currentMatchId = matchId;

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/ws/matches/${matchId}/`;

    this.ngZone.runOutsideAngular(() => {
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        console.log(`[WS] Connected: match ${matchId}`);
      };

      this.socket.onmessage = (event) => {
        this.ngZone.run(() => {
          try {
            const data = JSON.parse(event.data) as MatchUpdateEvent;
            this.updates$.next(data);
          } catch (e) {
            console.error('[WS] Parse error', e);
          }
        });
      };

      this.socket.onerror = (err) => {
        console.warn('[WS] Error — will fall back to polling', err);
        this.ngZone.run(() => this.updates$.error(err));
      };

      this.socket.onclose = (event) => {
        if (event.code !== 1000 && this.currentMatchId === matchId) {
          // Unintentional close — attempt reconnect after 5 s
          this.reconnectTimer = setTimeout(() => this.connect(matchId), 5000);
        }
      };
    });

    return this.updates$.asObservable();
  }

  disconnect(): void {
    clearTimeout(this.reconnectTimer);
    this.currentMatchId = undefined;
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      this.socket.close(1000);
    }
    this.socket = undefined;
    // Reset subject so a fresh connect() call gets a clean observable
    this.updates$ = new Subject<MatchUpdateEvent>();
  }
}
