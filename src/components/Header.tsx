import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ArrowLeft, RotateCw, Globe, LogIn, ShieldCheck, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation, Language } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import tabirlyLogo from '@/assets/tabirly-logo.svg';
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
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <img src={tabirlyLogo} alt="Tabirly Logo" className="w-8 h-8" />
            <div className="hidden sm:block">
              <h1 className="text-base md:text-lg font-bold text-foreground leading-tight">
                Tabirly Perili Yerler Databank'ı
              </h1>
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
            {user && (
              <Button
                variant="outline"
                onClick={() => {
                  if (isAdmin) {
                    navigate('/admin');
                  } else {
                    toast.error('Admin yetkisine sahip değilsiniz', {
                      description: 'Admin paneline erişmek için yetki gerekiyor.'
                    });
                  }
                }}
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
                
                {user && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => {
                      if (isAdmin) {
                        navigate('/admin');
                      } else {
                        toast.error('Admin yetkisine sahip değilsiniz', {
                          description: 'Admin paneline erişmek için yetki gerekiyor.'
                        });
                      }
                    }}>
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