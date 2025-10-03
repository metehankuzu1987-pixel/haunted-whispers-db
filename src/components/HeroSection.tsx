import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Language } from '@/lib/i18n';
import { useTranslateContent } from '@/hooks/useTranslateContent';

interface HeroSettings {
  hero_media_url: string | null;
  hero_media_type: 'video' | 'image' | null;
  hero_title: string;
  hero_subtitle: string;
}

interface HeroSectionProps {
  lang?: Language;
}

export const HeroSection = ({ lang = 'tr' }: HeroSectionProps) => {
  const [settings, setSettings] = useState<HeroSettings>({
    hero_media_url: null,
    hero_media_type: null,
    hero_title: 'Tabirly Perili Yerler Databank\'ı',
    hero_subtitle: 'Dünyanın lanetli ve perili yerlerini keşfedin',
  });

  // Translate hero content if lang is 'en'
  const textsToTranslate = lang === 'en' ? [settings.hero_title, settings.hero_subtitle] : [];
  const { translations } = useTranslateContent(textsToTranslate, 'tr', 'en');
  
  const displayedTitle = lang === 'en' && translations.length > 0 ? translations[0] : settings.hero_title;
  const displayedSubtitle = lang === 'en' && translations.length > 1 ? translations[1] : settings.hero_subtitle;

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('site_settings')
        .select('*')
        .single();
      
      if (data) {
        setSettings(data as HeroSettings);
      }
    };

    fetchSettings();

    // Realtime subscription
    const channel = supabase
      .channel('site_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_settings',
        },
        (payload) => {
          if (payload.new) {
            setSettings(payload.new as HeroSettings);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!settings.hero_media_url) {
    return null;
  }

  return (
    <section className="relative w-full min-h-[60vh] overflow-hidden">
      {/* Background Media */}
      <div className="absolute inset-0 z-0">
        {settings.hero_media_type === 'video' ? (
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          >
            <source src={settings.hero_media_url} type="video/mp4" />
          </video>
        ) : (
          <img
            src={settings.hero_media_url}
            alt="Hero background"
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background z-10" />

      {/* Content */}
      <div className="relative z-20 container mx-auto px-4 h-full min-h-[60vh] flex flex-col items-center justify-center text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-4 text-foreground animate-fade-in">
          {displayedTitle}
        </h1>
        <p className="text-sm sm:text-lg md:text-xl text-muted-foreground max-w-2xl animate-fade-in" style={{ animationDelay: '0.2s' }}>
          {displayedSubtitle}
        </p>
      </div>
    </section>
  );
};
