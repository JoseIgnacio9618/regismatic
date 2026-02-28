import { Component, OnInit } from "@angular/core";
import { ToastController } from "@ionic/angular";
import { Role, TeamUser } from "src/app/core/models/types";
import { UserService } from "src/app/core/services/user.service";

@Component({
  selector: "app-users",
  templateUrl: "./users.page.html",
  styleUrls: ["./users.page.scss"],
  standalone: false
})
export class UsersPage implements OnInit {
  users: TeamUser[] = [];

  fullName = "";
  email = "";
  password = "Regismatic2026!";
  role: Role = "EMPLOYEE";

  constructor(
    private readonly userService: UserService,
    private readonly toastController: ToastController
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadUsers();
  }

  async createUser(): Promise<void> {
    try {
      await this.userService.createUser({
        email: this.email,
        fullName: this.fullName,
        password: this.password,
        role: this.role
      });

      this.fullName = "";
      this.email = "";
      this.password = "Regismatic2026!";
      this.role = "EMPLOYEE";

      await this.loadUsers();
      await this.showToast("Usuario creado.", "success");
    } catch (error) {
      await this.showToast(error instanceof Error ? error.message : "No se pudo crear usuario.", "danger");
    }
  }

  private async loadUsers(): Promise<void> {
    this.users = await this.userService.listUsers();
  }

  private async showToast(message: string, color: "danger" | "success"): Promise<void> {
    const toast = await this.toastController.create({ message, duration: 2200, color });
    await toast.present();
  }
}
