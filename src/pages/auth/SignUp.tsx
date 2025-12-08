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
import { LanguageSelector } from "@/components/LanguageSelector";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { MetaEvents } from "@/lib/metaConversions";

export default function SignUp() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const { t, i18n } = useTranslation();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    mode: "onChange",
    defaultValues: {
      skills: [],
    },
  });

  const onSubmit = async (data: SignUpFormData) => {
    try {
      setIsLoading(true);
      const redirectUrl = `${window.location.origin}/`;
      const currentLanguage = i18n.language;

      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name: data.name,
            skills: data.skills,
            preferred_language: currentLanguage,
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error(t('auth.accountExists'));
        } else if (error.message.includes("Password")) {
          toast.error(t('auth.passwordRequirement'));
        } else {
          toast.error(t('auth.somethingWrong'));
        }
        return;
      }

      toast.success(t('auth.accountCreated'));
      
      // Track registration with Meta
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        MetaEvents.completeRegistration(sessionData.session.user.id, data.email);
      }
      
      // Redirect to home or postAuthRedirect
      const postAuthRedirect = sessionStorage.getItem("postAuthRedirect");
      sessionStorage.removeItem("postAuthRedirect");
      navigate(postAuthRedirect || "/");
    } catch (error) {
      toast.error(t('auth.somethingWrong'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">{t('auth.signUpTitle')}</h1>
          <p className="text-muted-foreground mt-2">{t('auth.signUpSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">{t('auth.name')}</Label>
            <Input
              id="name"
              type="text"
              placeholder={t('auth.name')}
              {...register("name")}
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('auth.email')}
              {...register("email")}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t('auth.password')}
              {...register("password")}
              disabled={isLoading}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t('auth.skills')}</Label>
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

          <LanguageSelector disabled={isLoading} />

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !isValid}
          >
            {isLoading ? t('auth.creatingAccount') : t('auth.signUpTitle')}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground mb-4">
          By signing up, you agree to our{" "}
          <Link to="/terms" className="text-primary hover:underline">
            Terms & Conditions
          </Link>
          ,{" "}
          <Link to="/privacy-policy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          ,{" "}
          <Link to="/cookie-policy" className="text-primary hover:underline">
            Cookie Policy
          </Link>
          {" "}and{" "}
          <Link to="/refund-policy" className="text-primary hover:underline">
            Refund Policy
          </Link>
          .
        </p>

        <p className="text-center text-sm text-muted-foreground">
          {t('auth.alreadyHaveAccount')}{" "}
          <Link to="/auth/signin" className="text-primary hover:underline font-medium">
            {t('common.signIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}
