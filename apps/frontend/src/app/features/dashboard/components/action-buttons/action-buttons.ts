import { Component, Input } from '@angular/core';


@Component({

  selector: 'app-action-buttons',
  standalone: true,
  templateUrl: './action-buttons.html',
  styleUrls: ['./action-buttons.css'],
})
export class ActionButtons {
  @Input() label: string = 'Action';
  @Input() icon?: string = '';
  @Input() variant: 'primary'| 'secondary' = 'primary';

}
