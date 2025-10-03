import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Loader2, Upload, X } from 'lucide-react';

export const HeroMediaUpload = () => {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    hero_media_url: '',
    hero_media_type: 'image' as 'image' | 'video',
    hero_title: 'Tabirly Perili Yerler Databank\'ı',
    hero_subtitle: 'Dünyanın lanetli ve perili yerlerini keşfedin',
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('*')
      .single();
    
    if (data) {
      setSettings({
        hero_media_url: data.hero_media_url || '',
        hero_media_type: (data.hero_media_type as 'image' | 'video') || 'image',
        hero_title: data.hero_title || 'Tabirly Perili Yerler Databank\'ı',
        hero_subtitle: data.hero_subtitle || 'Dünyanın lanetli ve perili yerlerini keşfedin',
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Dosya boyutu 10MB\'dan küçük olmalıdır');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `hero-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('hero-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('hero-media')
        .getPublicUrl(filePath);

      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

      setSettings({
        ...settings,
        hero_media_url: publicUrl,
        hero_media_type: mediaType,
      });

      toast.success('Medya yüklendi! Şimdi kaydedin.');
    } catch (error: any) {
      toast.error('Yükleme hatası: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveMedia = async () => {
    if (!settings.hero_media_url) return;

    try {
      // Extract file path from URL
      const url = new URL(settings.hero_media_url);
      const pathParts = url.pathname.split('/');
      const filePath = pathParts[pathParts.length - 1];

      await supabase.storage
        .from('hero-media')
        .remove([filePath]);

      setSettings({
        ...settings,
        hero_media_url: '',
      });

      toast.success('Medya kaldırıldı');
    } catch (error: any) {
      toast.error('Kaldırma hatası: ' + error.message);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .update({
          hero_media_url: settings.hero_media_url || null,
          hero_media_type: settings.hero_media_type,
          hero_title: settings.hero_title,
          hero_subtitle: settings.hero_subtitle,
          updated_at: new Date().toISOString(),
        })
        .eq('id', (await supabase.from('site_settings').select('id').single()).data?.id);

      if (error) throw error;

      toast.success('Hero ayarları kaydedildi!');
    } catch (error: any) {
      toast.error('Kaydetme hatası: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Hero Section Ayarları</CardTitle>
        <CardDescription>
          Ana sayfaya hero bölümü için video veya imaj yükleyin
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Media Preview */}
        {settings.hero_media_url && (
          <div className="space-y-2">
            <Label>Mevcut Medya</Label>
            <div className="relative rounded-lg overflow-hidden border border-border">
              {settings.hero_media_type === 'video' ? (
                <video
                  src={settings.hero_media_url}
                  className="w-full h-48 object-cover"
                  controls
                />
              ) : (
                <img
                  src={settings.hero_media_url}
                  alt="Hero media"
                  className="w-full h-48 object-cover"
                />
              )}
              <Button
                size="icon"
                variant="destructive"
                className="absolute top-2 right-2"
                onClick={handleRemoveMedia}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* File Upload */}
        <div className="space-y-2">
          <Label htmlFor="hero-upload">
            {settings.hero_media_url ? 'Yeni Medya Yükle' : 'Video veya İmaj Yükle'}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="hero-upload"
              type="file"
              accept="image/*,video/mp4,video/webm"
              onChange={handleFileUpload}
              disabled={uploading}
              className="flex-1"
            />
            {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
          </div>
          <p className="text-xs text-muted-foreground">
            Maksimum dosya boyutu: 10MB • Desteklenen formatlar: JPG, PNG, WEBP, GIF, MP4, WEBM
          </p>
        </div>

        {/* Text Content */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hero-title">Başlık</Label>
            <Input
              id="hero-title"
              value={settings.hero_title}
              onChange={(e) => setSettings({ ...settings, hero_title: e.target.value })}
              placeholder="Tabirly Perili Yerler Databank'ı"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hero-subtitle">Alt Başlık</Label>
            <Textarea
              id="hero-subtitle"
              value={settings.hero_subtitle}
              onChange={(e) => setSettings({ ...settings, hero_subtitle: e.target.value })}
              placeholder="Dünyanın lanetli ve perili yerlerini keşfedin"
              rows={2}
            />
          </div>
        </div>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={loading} className="w-full">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          Kaydet
        </Button>
      </CardContent>
    </Card>
  );
};
