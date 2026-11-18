import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { UsersRepository } from "../auth/users.repository";
import { UpdateRoleDto } from "./update-role.dto";

@Controller("users")
@UseGuards(AuthGuard, RolesGuard)
@Roles("admin")
export class UsersController {
  constructor(private readonly users: UsersRepository) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Patch(":id/role")
  updateRole(@Param("id", ParseUUIDPipe) id: string, @Body() body: UpdateRoleDto) {
    return this.users.updateRole(id, body.role);
  }
}
