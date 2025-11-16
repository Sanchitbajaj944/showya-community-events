import { Instagram, Twitter, Youtube } from "lucide-react";
import logo from "@/assets/logo.png";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

const Footer = () => {
  const { t } = useTranslation();
  
  return (
    <footer className="border-t bg-muted/30">
      <div className="container px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <img src={logo} alt="Logo" className="h-10 w-10" />
              <span className="text-2xl font-bold text-gradient">Showya</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {t('footer.brand')}
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="font-bold text-base">{t('footer.explore')}</h3>
            <nav className="flex flex-col space-y-3">
              <a href="#events" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {t('footer.events')}
              </a>
              <a href="#communities" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {t('footer.communities')}
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {t('footer.hostEvent')}
              </a>
            </nav>
          </div>

          {/* Company */}
          <div className="space-y-4">
            <h3 className="font-bold text-base">{t('footer.company')}</h3>
            <nav className="flex flex-col space-y-3">
              <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {t('footer.about')}
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {t('footer.contact')}
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {t('footer.careers')}
              </a>
            </nav>
          </div>

          {/* Social */}
          <div className="space-y-4">
            <h3 className="font-bold text-base">{t('footer.connect')}</h3>
            <div className="flex space-x-4">
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-gradient-card hover:bg-gradient-hero flex items-center justify-center transition-all hover:scale-110 shadow-sm"
              >
                <Instagram className="h-5 w-5 text-primary hover:text-white" />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-gradient-card hover:bg-gradient-hero flex items-center justify-center transition-all hover:scale-110 shadow-sm"
              >
                <Twitter className="h-5 w-5 text-primary hover:text-white" />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-gradient-card hover:bg-gradient-hero flex items-center justify-center transition-all hover:scale-110 shadow-sm"
              >
                <Youtube className="h-5 w-5 text-primary hover:text-white" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              {t('footer.copyright')}
            </p>
            <nav className="flex space-x-6">
              <Link to="/privacy-policy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {t('footer.privacy')}
              </Link>
              <Link to="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {t('footer.terms')}
              </Link>
              <Link to="/refund-policy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Refund Policy
              </Link>
              <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {t('footer.cookies')}
              </a>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
