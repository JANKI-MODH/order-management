import { Injectable, OnModuleInit } from "@nestjs/common";
import { UsersRepository } from "./users.repository";

@Injectable()
export class AdminBootstrap implements OnModuleInit {
  constructor(private readonly users: UsersRepository) {}

  async onModuleInit(): Promise<void> {
    if (process.env.BOOTSTRAP_ADMIN !== "true") {
      return;
    }

    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!email) {
      return;
    }

    await this.users.promoteToAdmin(email);
  }
}
