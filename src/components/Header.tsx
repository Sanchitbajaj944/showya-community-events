import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Sparkles } from "lucide-react";
import logo from "@/assets/logo.png";

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl">
      <div className="container flex h-20 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <div className="flex items-center space-x-3">
          <img src={logo} alt="Logo" className="h-10 w-10" />
          <span className="text-2xl font-bold text-gradient">Showya</span>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          <a href="#events" className="text-sm font-medium hover:text-primary transition-colors">
            Explore
          </a>
          <a href="#communities" className="text-sm font-medium hover:text-primary transition-colors">
            Communities
          </a>
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
            <Button size="sm" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Join Now
            </Button>
          </div>
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 hover:bg-muted rounded-lg transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-background/95 backdrop-blur-xl">
          <nav className="container px-4 py-6 space-y-4">
            <a
              href="#events"
              className="block text-base font-medium hover:text-primary transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Explore
            </a>
            <a
              href="#communities"
              className="block text-base font-medium hover:text-primary transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Communities
            </a>
            <div className="pt-4 space-y-3">
              <Button variant="ghost" className="w-full">
                Sign in
              </Button>
              <Button className="w-full gap-2">
                <Sparkles className="h-4 w-4" />
                Join Now
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
