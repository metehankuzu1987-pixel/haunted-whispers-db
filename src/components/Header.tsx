import { useState, useRef } from 'react';
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

  // Secret admin entry: click logo 5 times within 1.2s to open /auth
  const clicksRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);
  const handleLogoSecret = () => {
    clicksRef.current += 1;

    if (!timerRef.current) {
      timerRef.current = window.setTimeout(() => {
        clicksRef.current = 0;
        timerRef.current = undefined;
      }, 1200);
    }

    if (clicksRef.current >= 5) {
      clicksRef.current = 0;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
      toast.info('Gizli giriş açıldı');
      navigate('/auth');
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-purple-50 via-pink-50 to-blue-50 shadow-md border-b-4 border-purple-200/50" role="banner">
      <div className="container mx-auto px-4 py-4 md:py-5">
        <nav className="flex items-center justify-between gap-4" role="navigation" aria-label="Main navigation">
          {/* Logo & Başlık */}
          <div className="flex items-center gap-4 md:gap-6 cursor-pointer hover:opacity-90 transition-opacity" onClick={handleLogoSecret}>
            <img 
              src={tabirlyLogo} 
              alt="Tabirly - Perili Yerler Databank logosu" 
              className="w-20 h-20 md:w-28 md:h-28 drop-shadow-lg hover:scale-105 transition-transform" 
              width="112"
              height="112"
            />
            <div className="block">
              <h1 className="text-lg md:text-2xl font-bold text-gray-900 leading-tight tracking-tight">
                PeriliBank
              </h1>
              <p className="text-xs md:text-sm text-gray-600 mt-1 hidden sm:block">
                {t('app.subtitle')}
              </p>
            </div>
          </div>

          {/* Navigasyon */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="text-gray-700 hover:bg-purple-50 rounded-lg transition-colors"
              aria-label="Ana Sayfa"
            >
              <Home className="w-5 h-5" />
            </Button>

            {canGoBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="text-gray-700 hover:bg-purple-50 rounded-lg transition-colors"
                aria-label="Geri dön"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}

            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                className="text-gray-700 hover:bg-purple-50 rounded-lg transition-colors"
                aria-label="Yenile"
              >
                <RotateCw className="w-5 h-5" />
              </Button>
            )}

            {/* Tabirly Link */}
            <Button
              variant="outline"
              onClick={() => window.open('https://tr.tabirly.com/', '_blank')}
              className="text-gray-700 hover:bg-purple-50 border-purple-200 rounded-lg transition-colors"
            >
              Tabirly
            </Button>

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
                className="text-gray-700 hover:bg-purple-50 border-purple-200 rounded-lg hidden sm:inline-flex transition-colors"
              >
                <ShieldCheck className="w-5 h-5 mr-2" />
                {t('header.adminPanel')}
              </Button>
            )}

            {/* Dil Seçici */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="text-gray-700 hover:bg-purple-50 border-purple-200 rounded-lg transition-colors" aria-label="Dil seçimi">
                  <Globe className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border shadow-lg z-[60]">
                <DropdownMenuItem onClick={() => onLangChange('tr')} className="hover:bg-purple-50">
                  🇹🇷 Türkçe
                </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onLangChange('en')} className="hover:bg-purple-50">
                🇬🇧 English
              </DropdownMenuItem>
              
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
                    }} className="hover:bg-purple-50">
                      <ShieldCheck className="w-5 h-5 mr-2" />
                      {t('header.adminPanel')}
                    </DropdownMenuItem>
                  </>
                )}
                
                {user && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={signOut} className="hover:bg-purple-50">
                      <LogOut className="w-5 h-5 mr-2" />
                      {t('header.logout')}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>
      </div>
    </header>
  );
};