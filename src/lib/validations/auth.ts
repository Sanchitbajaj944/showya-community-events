import { z } from "zod";

export const signUpSchema = z.object({
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters")
    .trim(),
  email: z.string()
    .email("Please enter a valid email")
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(8, "Password must be at least 8 characters"),
});

export const signInSchema = z.object({
  email: z.string()
    .email("Please enter a valid email")
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string()
    .email("Please enter a valid email")
    .toLowerCase()
    .trim(),
});

export const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
    .min(8, "Password must be at least 8 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type SignUpFormData = z.infer<typeof signUpSchema>;
export type SignInFormData = z.infer<typeof signInSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
