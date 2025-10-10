import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { signUpSchema, type SignUpFormData } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SkillsSelect } from "@/components/SkillsSelect";
import { toast } from "sonner";

export default function SignUp() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      skills: [],
    },
  });

  const onSubmit = async (data: SignUpFormData) => {
    try {
      setIsLoading(true);
      const redirectUrl = `${window.location.origin}/`;

      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name: data.name,
            skills: data.skills,
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("An account with this email already exists. Try signing in.");
        } else if (error.message.includes("Password")) {
          toast.error("Use at least 8 characters.");
        } else {
          toast.error("Something went wrong. Please try again.");
        }
        return;
      }

      toast.success("Account created successfully!");
      
      // Redirect to home or postAuthRedirect
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
        <div className="text-center">
          <h1 className="text-3xl font-bold">Create account</h1>
          <p className="text-muted-foreground mt-2">Get started with your account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter your name"
              {...register("name")}
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              {...register("email")}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              {...register("password")}
              disabled={isLoading}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Skills</Label>
            <Controller
              name="skills"
              control={control}
              render={({ field }) => (
                <SkillsSelect
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isLoading}
                />
              )}
            />
            {errors.skills && (
              <p className="text-sm text-destructive">{errors.skills.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth/signin" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
