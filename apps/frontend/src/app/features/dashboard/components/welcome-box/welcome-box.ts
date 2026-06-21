import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService, User } from 'src/app/core/services/user.service';

@Component({
  selector: 'app-welcome-box',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './welcome-box.html',
  styleUrls: ['./welcome-box.css'],
})
export class WelcomeBox {
  user: User | undefined;

  constructor(private userService: UserService) { }
  ngOnInit(): void {
    this.userService.getUser().subscribe((user) => {
      this.user = user;
      console.log(user);
    });
  }

}
