import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "@/i18n/config";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface LanguageSelectorProps {
  showLabel?: boolean;
  disabled?: boolean;
}

export function LanguageSelector({ showLabel = true, disabled = false }: LanguageSelectorProps) {
  const { i18n } = useTranslation();

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  return (
    <div className="space-y-2">
      {showLabel && <Label>{i18n.t('auth.language')}</Label>}
      <Select
        value={i18n.language}
        onValueChange={handleLanguageChange}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder={i18n.t('settings.selectLanguage')} />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.nativeName} ({lang.name})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showLabel && (
        <p className="text-sm text-muted-foreground">
          {i18n.t('auth.languageHelper')}
        </p>
      )}
    </div>
  );
}
