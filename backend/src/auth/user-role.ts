export const userRoles = ["customer", "staff", "admin"] as const;

export type UserRole = (typeof userRoles)[number];
