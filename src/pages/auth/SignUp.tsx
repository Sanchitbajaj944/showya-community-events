import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import {
  signUpStep1Schema,
  signUpStep2Schema,
  otpSchema,
  type SignUpStep1FormData,
  type SignUpStep2FormData,
  type OtpFormData,
} from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SkillsSelect } from "@/components/SkillsSelect";
import { LanguageSelector } from "@/components/LanguageSelector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { MetaEvents } from "@/lib/metaConversions";
import { ArrowLeft, Mail } from "lucide-react";

type Step = "info" | "otp" | "details";

export default function SignUp() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<Step>("info");
  const [step1Data, setStep1Data] = useState<SignUpStep1FormData | null>(null);
  const { t, i18n } = useTranslation();

  // Step 1 form
  const step1Form = useForm<SignUpStep1FormData>({
    resolver: zodResolver(signUpStep1Schema),
    mode: "onChange",
  });

  // OTP form
  const otpForm = useForm<OtpFormData>({
    resolver: zodResolver(otpSchema),
    mode: "onChange",
  });

  // Step 2 form
  const step2Form = useForm<SignUpStep2FormData>({
    resolver: zodResolver(signUpStep2Schema),
    mode: "onChange",
    defaultValues: { skills: [] },
  });

  const handleStep1Submit = async (data: SignUpStep1FormData) => {
    try {
      setIsLoading(true);
      setStep1Data(data);

      const { error } = await supabase.auth.signInWithOtp({
        email: data.email,
        options: {
          shouldCreateUser: true,
          data: {
            name: data.name,
            phone: data.phone,
            preferred_language: i18n.language,
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered") || error.message.includes("already been registered")) {
          toast.error("This email is already registered. Please sign in instead.");
        } else {
          toast.error(error.message || "Something went wrong. Please try again.");
        }
        return;
      }

      toast.success("OTP sent to your email! Check your inbox.");
      setStep("otp");
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (data: OtpFormData) => {
    if (!step1Data) return;
    try {
      setIsLoading(true);

      const { error } = await supabase.auth.verifyOtp({
        email: step1Data.email,
        token: data.otp,
        type: "email",
      });

      if (error) {
        toast.error("Invalid or expired OTP. Please try again.");
        return;
      }

      toast.success("Email verified! Complete your profile.");
      setStep("details");
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!step1Data) return;
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithOtp({
        email: step1Data.email,
        options: {
          shouldCreateUser: true,
          data: {
            name: step1Data.name,
            phone: step1Data.phone,
            preferred_language: i18n.language,
          },
        },
      });

      if (error) {
        toast.error("Failed to resend OTP. Please try again.");
      } else {
        toast.success("OTP resent! Check your inbox.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep2Submit = async (data: SignUpStep2FormData) => {
    if (!step1Data) return;
    try {
      setIsLoading(true);

      // Update user metadata with step 2 data
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          gender: data.gender,
          dob: data.dob,
          city: data.city,
          skills: data.skills,
        },
      });

      if (updateError) {
        toast.error("Failed to save profile. Please try again.");
        return;
      }

      // Also update profile directly
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.user) {
        await supabase
          .from("profiles")
          .update({
            gender: data.gender,
            dob: data.dob,
            city: data.city,
            skills: data.skills,
          })
          .eq("user_id", session.session.user.id);

        MetaEvents.completeRegistration(session.session.user.id, step1Data.email);
      }

      toast.success("Account created successfully!");

      const postAuthRedirect = sessionStorage.getItem("postAuthRedirect");
      sessionStorage.removeItem("postAuthRedirect");
      navigate(postAuthRedirect || "/");
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {["info", "otp", "details"].map((s, i) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step
                  ? "w-8 bg-primary"
                  : i < ["info", "otp", "details"].indexOf(step)
                  ? "w-8 bg-primary/50"
                  : "w-8 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === "info" && (
          <>
            <div className="text-center">
              <h1 className="text-3xl font-bold">{t("auth.signUpTitle", "Create account")}</h1>
              <p className="text-muted-foreground mt-2">
                {t("auth.signUpSubtitle", "Join the community")}
              </p>
            </div>

            <form onSubmit={step1Form.handleSubmit(handleStep1Submit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("auth.name", "Name")}</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your name"
                  {...step1Form.register("name")}
                  disabled={isLoading}
                />
                {step1Form.formState.errors.name && (
                  <p className="text-sm text-destructive">{step1Form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email", "Email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  {...step1Form.register("email")}
                  disabled={isLoading}
                />
                {step1Form.formState.errors.email && (
                  <p className="text-sm text-destructive">{step1Form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  {...step1Form.register("phone")}
                  disabled={isLoading}
                />
                {step1Form.formState.errors.phone && (
                  <p className="text-sm text-destructive">{step1Form.formState.errors.phone.message}</p>
                )}
              </div>

              <LanguageSelector disabled={isLoading} />

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !step1Form.formState.isValid}
              >
                {isLoading ? "Sending OTP..." : "Continue with Email OTP"}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              By signing up, you agree to our{" "}
              <Link to="/terms" className="text-primary hover:underline">Terms & Conditions</Link>,{" "}
              <Link to="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link>,{" "}
              <Link to="/cookie-policy" className="text-primary hover:underline">Cookie Policy</Link>
              {" "}and{" "}
              <Link to="/refund-policy" className="text-primary hover:underline">Refund Policy</Link>.
            </p>

            <p className="text-center text-sm text-muted-foreground">
              {t("auth.alreadyHaveAccount", "Already have an account?")}{" "}
              <Link to="/auth/signin" className="text-primary hover:underline font-medium">
                {t("common.signIn", "Sign in")}
              </Link>
            </p>
          </>
        )}

        {/* Step OTP: Verify email */}
        {step === "otp" && (
          <>
            <button
              onClick={() => setStep("info")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold">Verify your email</h1>
              <p className="text-muted-foreground mt-2">
                We sent a 6-digit code to <span className="font-medium text-foreground">{step1Data?.email}</span>
              </p>
            </div>

            <form onSubmit={otpForm.handleSubmit(handleOtpSubmit)} className="space-y-6">
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

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !otpForm.formState.isValid}
              >
                {isLoading ? "Verifying..." : "Verify OTP"}
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

        {/* Step 2: Profile details */}
        {step === "details" && (
          <>
            <div className="text-center">
              <h1 className="text-3xl font-bold">Complete your profile</h1>
              <p className="text-muted-foreground mt-2">Just a few more details</p>
            </div>

            <form onSubmit={step2Form.handleSubmit(handleStep2Submit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Gender</Label>
                <Controller
                  name="gender"
                  control={step2Form.control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="non-binary">Non-binary</SelectItem>
                        <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {step2Form.formState.errors.gender && (
                  <p className="text-sm text-destructive">{step2Form.formState.errors.gender.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  {...step2Form.register("dob")}
                  disabled={isLoading}
                />
                {step2Form.formState.errors.dob && (
                  <p className="text-sm text-destructive">{step2Form.formState.errors.dob.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  type="text"
                  placeholder="Enter your city"
                  {...step2Form.register("city")}
                  disabled={isLoading}
                />
                {step2Form.formState.errors.city && (
                  <p className="text-sm text-destructive">{step2Form.formState.errors.city.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t("auth.skills", "Skills")}</Label>
                <Controller
                  name="skills"
                  control={step2Form.control}
                  render={({ field }) => (
                    <SkillsSelect
                      value={field.value}
                      onChange={field.onChange}
                      disabled={isLoading}
                    />
                  )}
                />
                {step2Form.formState.errors.skills && (
                  <p className="text-sm text-destructive">{step2Form.formState.errors.skills.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !step2Form.formState.isValid}
              >
                {isLoading ? "Creating account..." : "Complete Sign Up"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
