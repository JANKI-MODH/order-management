import { IsIn } from "class-validator";
import { userRoles, type UserRole } from "../auth/user-role";

export class UpdateRoleDto {
  @IsIn(userRoles)
  role!: UserRole;
}
