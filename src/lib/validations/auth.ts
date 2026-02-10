import { z } from "zod";

// Step 1 of signup: basic info
export const signUpStep1Schema = z.object({
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters")
    .trim(),
  email: z.string()
    .email("Please enter a valid email")
    .toLowerCase()
    .trim(),
  phone: z.string()
    .min(10, "Please enter a valid phone number")
    .max(15, "Phone number is too long")
    .regex(/^\+?[0-9\s\-]+$/, "Please enter a valid phone number"),
});

// Step 2 of signup: demographics + skills
export const signUpStep2Schema = z.object({
  gender: z.string().min(1, "Please select your gender"),
  dob: z.string().min(1, "Please enter your date of birth"),
  city: z.string()
    .min(2, "City must be at least 2 characters")
    .max(100, "City name is too long")
    .trim(),
  skills: z.array(z.string())
    .min(1, "Please select at least one skill"),
});

// OTP verification
export const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits"),
});

// Legacy signup schema (kept for compatibility)
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
  skills: z.array(z.string())
    .min(1, "Please select at least one skill"),
});

export const signInSchema = z.object({
  email: z.string()
    .email("Please enter a valid email")
    .toLowerCase()
    .trim(),
});

export const signInPasswordSchema = z.object({
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

export type SignUpStep1FormData = z.infer<typeof signUpStep1Schema>;
export type SignUpStep2FormData = z.infer<typeof signUpStep2Schema>;
export type OtpFormData = z.infer<typeof otpSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type SignInFormData = z.infer<typeof signInSchema>;
export type SignInPasswordFormData = z.infer<typeof signInPasswordSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
