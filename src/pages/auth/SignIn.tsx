import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import {
  signInSchema,
  signInPasswordSchema,
  otpSchema,
  type SignInFormData,
  type SignInPasswordFormData,
  type OtpFormData,
} from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Mail } from "lucide-react";

type Mode = "otp-email" | "otp-verify" | "password";

export default function SignIn() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("otp-email");
  const [otpEmail, setOtpEmail] = useState("");

  const emailForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  });

  const otpForm = useForm<OtpFormData>({
    resolver: zodResolver(otpSchema),
    mode: "onChange",
  });

  const passwordForm = useForm<SignInPasswordFormData>({
    resolver: zodResolver(signInPasswordSchema),
  });

  const handleSendOtp = async (data: SignInFormData) => {
    try {
      setIsLoading(true);
      setOtpEmail(data.email);

      const { error } = await supabase.auth.signInWithOtp({
        email: data.email,
        options: { shouldCreateUser: false },
      });

      if (error) {
        if (error.message.includes("Signups not allowed")) {
          toast.error("No account found with this email. Please sign up first.");
        } else {
          toast.error(error.message || "Something went wrong.");
        }
        return;
      }

      toast.success("OTP sent to your email!");
      setMode("otp-verify");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (data: OtpFormData) => {
    try {
      setIsLoading(true);

      const { error } = await supabase.auth.verifyOtp({
        email: otpEmail,
        token: data.otp,
        type: "email",
      });

      if (error) {
        toast.error("Invalid or expired OTP. Please try again.");
        return;
      }

      toast.success("Signed in successfully!");
      const postAuthRedirect = sessionStorage.getItem("postAuthRedirect");
      sessionStorage.removeItem("postAuthRedirect");
      navigate(postAuthRedirect || "/");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSignIn = async (data: SignInPasswordFormData) => {
    try {
      setIsLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Email or password is incorrect.");
        } else if (error.message.includes("too many")) {
          toast.error("Too many attempts. Try again in a few minutes.");
        } else {
          toast.error("Something went wrong. Please try again.");
        }
        return;
      }

      toast.success("Signed in successfully!");
      const postAuthRedirect = sessionStorage.getItem("postAuthRedirect");
      sessionStorage.removeItem("postAuthRedirect");
      navigate(postAuthRedirect || "/");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithOtp({
        email: otpEmail,
        options: { shouldCreateUser: false },
      });
      if (error) {
        toast.error("Failed to resend OTP.");
      } else {
        toast.success("OTP resent! Check your inbox.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        {/* OTP Email Step */}
        {mode === "otp-email" && (
          <>
            <div className="text-center">
              <h1 className="text-3xl font-bold">Sign in</h1>
              <p className="text-muted-foreground mt-2">Welcome back!</p>
            </div>

            <form onSubmit={emailForm.handleSubmit(handleSendOtp)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  {...emailForm.register("email")}
                  disabled={isLoading}
                />
                {emailForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{emailForm.formState.errors.email.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Sending OTP..." : "Send OTP"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <button
              onClick={() => setMode("password")}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in with password instead
            </button>

            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/auth/signup" className="text-primary hover:underline font-medium">
                Create account
              </Link>
            </p>
          </>
        )}

        {/* OTP Verify Step */}
        {mode === "otp-verify" && (
          <>
            <button
              onClick={() => setMode("otp-email")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold">Enter OTP</h1>
              <p className="text-muted-foreground mt-2">
                We sent a 6-digit code to <span className="font-medium text-foreground">{otpEmail}</span>
              </p>
            </div>

            <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} className="space-y-6">
              <div className="flex justify-center">
                <Controller
                  name="otp"
                  control={otpForm.control}
                  render={({ field }) => (
                    <InputOTP
                      maxLength={6}
                      value={field.value || ""}
                      onChange={field.onChange}
                      disabled={isLoading}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  )}
                />
              </div>
              {otpForm.formState.errors.otp && (
                <p className="text-sm text-destructive text-center">{otpForm.formState.errors.otp.message}</p>
              )}

              <Button type="submit" className="w-full" disabled={isLoading || !otpForm.formState.isValid}>
                {isLoading ? "Verifying..." : "Verify & Sign In"}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              Didn't receive the code?{" "}
              <button
                onClick={handleResendOtp}
                disabled={isLoading}
                className="text-primary hover:underline font-medium"
              >
                Resend OTP
              </button>
            </p>
          </>
        )}

        {/* Password Mode */}
        {mode === "password" && (
          <>
            <button
              onClick={() => setMode("otp-email")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to OTP sign in
            </button>

            <div className="text-center">
              <h1 className="text-3xl font-bold">Sign in with password</h1>
              <p className="text-muted-foreground mt-2">For existing accounts</p>
            </div>

            <form onSubmit={passwordForm.handleSubmit(handlePasswordSignIn)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="pw-email">Email</Label>
                <Input
                  id="pw-email"
                  type="email"
                  placeholder="Enter your email"
                  {...passwordForm.register("email")}
                  disabled={isLoading}
                />
                {passwordForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{passwordForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pw-password">Password</Label>
                  <Link to="/auth/forgot-password" className="text-sm text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="pw-password"
                  type="password"
                  placeholder="Enter your password"
                  {...passwordForm.register("password")}
                  disabled={isLoading}
                />
                {passwordForm.formState.errors.password && (
                  <p className="text-sm text-destructive">{passwordForm.formState.errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/auth/signup" className="text-primary hover:underline font-medium">
                Create account
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
