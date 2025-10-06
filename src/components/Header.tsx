import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Sparkles } from "lucide-react";
import logo from "@/assets/logo.png";

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <div className="flex items-center space-x-3">
          <img src={logo} alt="Showya Logo" className="h-8 w-8" />
          <span className="text-xl font-bold text-foreground">Showya</span>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          <a href="#events" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
            Events
          </a>
          <a href="#communities" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
            Communities
          </a>
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center space-x-3">
          <Button variant="outline" size="sm">
            Create Community
          </Button>
          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
            A
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 text-foreground hover:bg-muted rounded-lg transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <nav className="container px-4 py-6 space-y-4">
            <a
              href="#events"
              className="block text-base font-medium text-foreground hover:text-primary transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Events
            </a>
            <a
              href="#communities"
              className="block text-base font-medium text-foreground hover:text-primary transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Communities
            </a>
            <div className="pt-4 space-y-3">
              <Button variant="outline" className="w-full">
                Create Community
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
