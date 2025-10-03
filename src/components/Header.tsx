import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ArrowLeft, RotateCw, Globe, Ghost, LogIn, ShieldCheck, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation, Language } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  lang: Language;
  onLangChange: (lang: Language) => void;
  onRefresh?: () => void;
}

export const Header = ({ lang, onLangChange, onRefresh }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation(lang);
  const { user, isAdmin, signOut } = useAuth();
  const canGoBack = location.pathname !== '/';

  return (
    <header className="sticky top-0 z-50 glass border-b border-border/30">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Logo & Başlık */}
          <div className="flex items-center gap-2">
            <Ghost className="w-6 h-6 text-primary" />
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-foreground">{t('app.title')}</h1>
              <p className="text-xs text-muted-foreground">{t('app.subtitle')}</p>
            </div>
          </div>

          {/* Navigasyon */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="hover-glow"
            >
              <Home className="w-4 h-4" />
            </Button>

            {canGoBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="hover-glow"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}

            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                className="hover-glow"
              >
                <RotateCw className="w-4 h-4" />
              </Button>
            )}

            {/* Admin Kısayol */}
            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => navigate('/admin')}
                className="hover-glow hidden sm:inline-flex"
              >
                <ShieldCheck className="w-4 h-4 mr-2" />
                Admin Panel
              </Button>
            )}

            {/* Dil Seçici */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="hover-glow">
                  <Globe className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass z-50">
                <DropdownMenuItem onClick={() => onLangChange('tr')}>
                  🇹🇷 Türkçe
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onLangChange('en')}>
                  🇬🇧 English
                </DropdownMenuItem>
                
                {!user && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/auth')}>
                      <LogIn className="w-4 h-4 mr-2" />
                      Giriş Yap
                    </DropdownMenuItem>
                  </>
                )}
                
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/admin')}>
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Admin Panel
                    </DropdownMenuItem>
                  </>
                )}
                
                {user && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={signOut}>
                      <LogOut className="w-4 h-4 mr-2" />
                      Çıkış Yap
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};