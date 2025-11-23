import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut, User, Shield, Languages } from "lucide-react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "./UserAvatar";
import { useTranslation } from "react-i18next";
import { NotificationCenter } from "./NotificationCenter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "./ui/dropdown-menu";
import { SUPPORTED_LANGUAGES } from "@/i18n/config";
import { LanguageSelector } from "./LanguageSelector";

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [profileData, setProfileData] = useState<{
    display_name?: string;
    name?: string;
    profile_picture_url?: string;
  } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ownsCommunity, setOwnsCommunity] = useState(false);

  const handleLanguageChange = async (langCode: string) => {
    i18n.changeLanguage(langCode);
    
    // Update in database if user is logged in
    if (user) {
      await supabase
        .from("profiles")
        .update({ preferred_language: langCode })
        .eq("user_id", user.id);
    }
  };

  useEffect(() => {
    if (user) {
      fetchProfileData();
      checkAdminStatus();
      checkCommunityOwnership();
    }
  }, [user]);

  const fetchProfileData = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, name, profile_picture_url")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setProfileData(data);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const checkAdminStatus = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      setIsAdmin(!!data);
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  };

  const checkCommunityOwnership = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from("communities")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      setOwnsCommunity(!!data);
    } catch (error) {
      console.error("Error checking community ownership:", error);
    }
  };

  const displayName = profileData?.display_name || profileData?.name || user?.email || "User";
  const profilePicture = profileData?.profile_picture_url;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-3">
          <img src={logo} alt="Showya Logo" className="h-10 w-10 rounded-lg" />
          <span className="text-xl font-bold text-foreground">Showya</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          <Link to="/" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
            {t('nav.home')}
          </Link>
          <Link to="/events" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
            {t('nav.events')}
          </Link>
          <Link to="/reels" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
            {t('nav.showclips')}
          </Link>
          <Link to="/communities" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
            {t('nav.communities')}
          </Link>
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center space-x-3">
          {user ? (
            <>
              {!ownsCommunity && (
                <Link to="/communities">
                  <Button size="sm" className="mr-2">
                    Create Community
                  </Button>
                </Link>
              )}
              <NotificationCenter />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="focus:outline-none">
                    <UserAvatar
                      src={profilePicture}
                      name={displayName}
                      size="md"
                      className="cursor-pointer"
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem disabled className="text-sm">
                    {user.email}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
                    <User className="h-4 w-4 mr-2" />
                    {t('nav.profile')}
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate("/admin")} className="cursor-pointer">
                      <Shield className="h-4 w-4 mr-2" />
                      {t('nav.admin')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Languages className="h-4 w-4 mr-2" />
                      {t('settings.languagePreference')}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <DropdownMenuItem
                          key={lang.code}
                          onClick={() => handleLanguageChange(lang.code)}
                          className="cursor-pointer"
                        >
                          {lang.nativeName}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="cursor-pointer">
                    <LogOut className="h-4 w-4 mr-2" />
                    {t('common.signOut')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Languages className="h-4 w-4 mr-2" />
                    {SUPPORTED_LANGUAGES.find(l => l.code === i18n.language)?.nativeName}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>{t('settings.languagePreference')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <DropdownMenuItem
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className="cursor-pointer"
                    >
                      {lang.nativeName}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Link to="/auth/signin">
                <Button variant="ghost" size="sm">
                  {t('common.signIn')}
                </Button>
              </Link>
              <Link to="/auth/signup">
                <Button size="sm">
                  {t('common.signUp')}
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Actions */}
        <div className="md:hidden flex items-center space-x-2">
          {user && <NotificationCenter />}
          <button
            className="p-2 text-foreground hover:bg-muted rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <nav className="container px-4 py-6 space-y-4">
            <Link
              to="/"
              className="block text-base font-medium text-foreground hover:text-primary transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              to="/events"
              className="block text-base font-medium text-foreground hover:text-primary transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Events
            </Link>
            <Link
              to="/reels"
              className="block text-base font-medium text-foreground hover:text-primary transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              ShowClips
            </Link>
            <Link
              to="/communities"
              className="block text-base font-medium text-foreground hover:text-primary transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
            Communities
            </Link>
            {user && (
              <Link
                to="/profile"
                className="block text-base font-medium text-foreground hover:text-primary transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Profile
              </Link>
            )}
            
            {user && !ownsCommunity && (
              <Link to="/communities" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full mb-2">
                  Create Community
                </Button>
              </Link>
            )}
            
            {/* Language Selector */}
            <div className="pt-4 border-t border-border">
              <LanguageSelector showLabel={true} />
            </div>
            
            <div className="pt-4 space-y-3">
              {user ? (
                <>
                  {isAdmin && (
                    <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full">
                        <Shield className="h-4 w-4 mr-2" />
                        Admin Dashboard
                      </Button>
                    </Link>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        src={profilePicture}
                        name={displayName}
                        size="sm"
                      />
                      <span className="text-sm text-foreground truncate">{user.email}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={signOut}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Link to="/auth/signin" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full">
                      Sign in
                    </Button>
                  </Link>
                  <Link to="/auth/signup" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
