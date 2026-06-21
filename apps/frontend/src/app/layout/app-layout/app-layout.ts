import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { Header } from '../header/header';
import { Sidebar } from '../sidebar/sidebar';
import { ToastComponent } from '../../shared/components/toast/toast.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [Header, Sidebar, RouterOutlet, ToastComponent],
  templateUrl: './app-layout.html',
  styleUrls: ['./app-layout.css'],
})
export class AppLayout {
  private document = inject(DOCUMENT);

  toggleTheme(): void {
    this.document.documentElement.classList.toggle('dark');
  }
}
