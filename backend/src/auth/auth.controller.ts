import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, AuthenticatedRequest } from "./auth.guard";
import { AuthService } from "./auth.service";
import { LoginDto } from "./login.dto";
import { RegisterDto } from "./register.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() body: RegisterDto) {
    return this.auth.register(body.email, body.password);
  }

  @Post("login")
  @HttpCode(200)
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password);
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return request.user;
  }
}
