import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Eye, Play, Settings } from 'lucide-react';
import type { Place } from '@/types';

const CATEGORIES = ['Terk edilmiş', 'Hastane', 'Orman', 'Şato', 'Kilise', 'Köprü', 'Otel', 'Diğer'];
const COUNTRIES = [
  { code: 'TR', name: 'Türkiye' },
  { code: 'US', name: 'ABD' },
  { code: 'UK', name: 'İngiltere' },
  { code: 'DE', name: 'Almanya' },
  { code: 'FR', name: 'Fransa' },
  { code: 'IT', name: 'İtalya' },
  { code: 'JP', name: 'Japonya' },
  { code: 'UA', name: 'Ukrayna' },
];

export default function Admin() {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading, user } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [scanLogs, setScanLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataCollectionMethod, setDataCollectionMethod] = useState<'api' | 'ai'>('api');
  const [enabledApis, setEnabledApis] = useState<string[]>(['dbpedia']);
  const [useAllApis, setUseAllApis] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [scanningDuplicates, setScanningDuplicates] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    category: '',
    description: '',
    country_code: '',
    city: '',
    evidence_score: 70,
    status: 'pending' as 'pending' | 'approved' | 'rejected'
  });

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast.error('Bu sayfaya erişim yetkiniz yok');
      navigate('/');
    }
  }, [isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchPlaces();
      fetchScanLogs();
      fetchSettings();
    }
  }, [isAdmin]);

  const fetchPlaces = async () => {
    const { data, error } = await supabase
      .from('places')
      .select('*')
      .order('created_at', { ascending: false});
    
    if (error) {
      toast.error('Veriler yüklenemedi');
    } else {
      setPlaces((data || []) as any);
    }
  };

  const fetchScanLogs = async () => {
    const { data, error } = await supabase
      .from('ai_scan_logs')
      .select('*')
      .order('scan_started_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('Scan logs error:', error);
    } else {
      setScanLogs(data || []);
    }
  };

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'data_collection_method')
      .single();
    
    if (data && !error) {
      setDataCollectionMethod(data.setting_value as 'api' | 'ai');
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('app_settings')
      .update({ 
        setting_value: dataCollectionMethod,
        updated_at: new Date().toISOString()
      })
      .eq('setting_key', 'data_collection_method');

    setLoading(false);

    if (error) {
      toast.error('Ayarlar kaydedilemedi: ' + error.message);
    } else {
      toast.success('Ayarlar kaydedildi! Otomatik taramalar şimdi ' + (dataCollectionMethod === 'ai' ? 'AI' : 'API') + ' kullanacak.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const slug = formData.slug || formData.name.toLowerCase()
      .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const { error } = await supabase.from('places').insert({
      ...formData,
      slug,
      human_approved: 1,
      ai_collected: 0,
      sources_json: []
    });

    setLoading(false);

    if (error) {
      toast.error('Hata: ' + error.message);
    } else {
      toast.success('Yer başarıyla eklendi!');
      setFormData({
        name: '',
        slug: '',
        category: '',
        description: '',
        country_code: '',
        city: '',
        evidence_score: 70,
        status: 'pending'
      });
      fetchPlaces();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu yeri silmek istediğinizden emin misiniz?')) return;

    const { error } = await supabase.from('places').delete().eq('id', id);

    if (error) {
      toast.error('Silme hatası: ' + error.message);
    } else {
      toast.success('Yer silindi');
      fetchPlaces();
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await supabase
      .from('places')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast.error('Güncelleme hatası');
    } else {
      toast.success('Durum güncellendi');
      fetchPlaces();
    }
  };

  const triggerScan = async () => {
    setLoading(true);
    const scanType = dataCollectionMethod === 'ai' ? 'AI' : 'API';
    toast.info(`${scanType} tarama başlatılıyor...`);

    try {
      const functionName = dataCollectionMethod === 'ai' ? 'ai-scan' : 'api-scan';
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { manual: true }
      });

      if (error) throw error;

      toast.success(`${scanType} taraması tamamlandı! ${data.places_added || data.addedCount || 0} yer eklendi.`);
      fetchPlaces();
      fetchScanLogs();
    } catch (error: any) {
      toast.error(`${scanType} tarama hatası: ` + error.message);
    } finally {
      setLoading(false);
    }
  };

  const triggerMultiScan = async () => {
    try {
      setLoading(true);
      const apisToUse = useAllApis ? ['dbpedia', 'foursquare', 'google', 'geonames', 'atlas'] : enabledApis;
      
      toast.info(`Çoklu API taraması başlatılıyor (${apisToUse.length} API)...`);

      const { data, error } = await supabase.functions.invoke('multi-scan', {
        body: {
          category: 'haunted_location',
          country: 'TR',
          enabledApis: apisToUse
        }
      });

      if (error) throw error;

      toast.success(`Çoklu tarama tamamlandı! ${data.added} yer eklendi (${data.unique_places} benzersiz bulundu)`);
      fetchPlaces();
      fetchScanLogs();
    } catch (error: any) {
      toast.error('Çoklu tarama hatası: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleApi = (api: string) => {
    setEnabledApis(prev => 
      prev.includes(api) ? prev.filter(a => a !== api) : [...prev, api]
    );
  };

  const fetchPotentialDuplicates = async () => {
    try {
      setScanningDuplicates(true);
      const { data: allPlaces } = await supabase
        .from('places')
        .select('id, name, slug, lat, lon, sources_json, status')
        .order('created_at', { ascending: false });
      
      if (!allPlaces) return;
      
      const potentialDups: any[] = [];
      
      for (const place of allPlaces) {
        if (!place.lat || !place.lon) continue;
        
        const { data: similar } = await supabase
          .rpc('find_similar_places', {
            p_name: place.name,
            p_lat: place.lat,
            p_lon: place.lon,
            p_similarity_threshold: 0.7
          });
        
        if (similar && similar.length > 1) {
          const otherSimilar = similar.filter(s => s.place_id !== place.id);
          if (otherSimilar.length > 0) {
            potentialDups.push({
              mainPlace: place,
              similarPlaces: otherSimilar
            });
          }
        }
      }
      
      setDuplicates(potentialDups);
      toast.success(`${potentialDups.length} olası duplikat grup bulundu`);
    } catch (error: any) {
      toast.error('Duplikat tarama hatası: ' + error.message);
    } finally {
      setScanningDuplicates(false);
    }
  };

  const mergePlaces = async (targetId: string, sourceId: string) => {
    try {
      const { data: sourcePlace } = await supabase
        .from('places')
        .select('*')
        .eq('id', sourceId)
        .single();
      
      if (!sourcePlace) {
        toast.error('Kaynak mekan bulunamadı');
        return;
      }
      
      // Merge sources
      await supabase.rpc('merge_place_sources', {
        target_place_id: targetId,
        new_sources: sourcePlace.sources_json || []
      });
      
      // Move comments
      await supabase
        .from('comments')
        .update({ place_id: targetId })
        .eq('place_id', sourceId);
      
      // Delete source place
      await supabase
        .from('places')
        .delete()
        .eq('id', sourceId);
      
      toast.success('Mekanlar başarıyla birleştirildi!');
      await fetchPotentialDuplicates();
      await fetchPlaces();
    } catch (error: any) {
      toast.error('Birleştirme hatası: ' + error.message);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <Button onClick={() => navigate('/')} variant="outline">
            Ana Sayfa
          </Button>
        </div>

        <Tabs defaultValue="places" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="places">Yerler ({places.length})</TabsTrigger>
            <TabsTrigger value="add">Yeni Ekle</TabsTrigger>
            <TabsTrigger value="scan">Tarama</TabsTrigger>
            <TabsTrigger value="apis">Gelişmiş API</TabsTrigger>
            <TabsTrigger value="duplicates">Duplikatlar</TabsTrigger>
            <TabsTrigger value="settings">Ayarlar</TabsTrigger>
          </TabsList>

          <TabsContent value="places" className="space-y-4">
            {places.map((place) => (
              <Card key={place.id} className="glass">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{place.name}</CardTitle>
                      <CardDescription>
                        {place.city}, {place.country_code} • {place.category}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Select
                        value={place.status}
                        onValueChange={(val) => handleStatusChange(place.id, val)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Bekliyor</SelectItem>
                          <SelectItem value="approved">Onaylı</SelectItem>
                          <SelectItem value="rejected">Reddedildi</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => navigate(`/place/${place.id}`)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => handleDelete(place.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {place.description}
                  </p>
                  <div className="mt-2 flex gap-2 text-xs">
                    <span className="badge">Skor: {place.evidence_score}</span>
                    {place.ai_collected === 1 && <span className="badge">AI</span>}
                    {place.human_approved === 1 && <span className="badge">İnsan Onaylı</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="add">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Yeni Yer Ekle</CardTitle>
                <CardDescription>Manuel olarak yeni bir gizemli yer ekleyin</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">İsim *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Kategori *</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(val) => setFormData({ ...formData, category: val })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Ülke *</Label>
                      <Select
                        value={formData.country_code}
                        onValueChange={(val) => setFormData({ ...formData, country_code: val })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.name} ({c.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">Şehir</Label>
                      <Input
                        id="city"
                        value={formData.city || ''}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Açıklama</Label>
                    <Textarea
                      id="description"
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="score">Kanıt Puanı: {formData.evidence_score}</Label>
                    <Input
                      id="score"
                      type="range"
                      min="0"
                      max="100"
                      value={formData.evidence_score}
                      onChange={(e) => setFormData({ ...formData, evidence_score: parseInt(e.target.value) })}
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Ekle
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scan" className="space-y-4">
            <Card className="glass">
              <CardHeader>
                <CardTitle>{dataCollectionMethod === 'ai' ? 'AI Web Tarama' : 'API Tarama'}</CardTitle>
                <CardDescription>
                  Sistem her 2 saatte bir otomatik olarak <strong>{dataCollectionMethod === 'ai' ? 'AI' : 'API'}</strong> taraması yapar. 
                  Manuel başlatmak için butona tıklayın.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={triggerScan} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                  {dataCollectionMethod === 'ai' ? 'AI' : 'API'} Taraması Başlat
                </Button>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>Son Taramalar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {scanLogs.map((log) => (
                    <div key={log.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">
                          {new Date(log.scan_started_at).toLocaleString('tr-TR')}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          log.status === 'completed' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'
                        }`}>
                          {log.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Bulunan: {log.places_found} • Eklenen: {log.places_added}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="apis" className="space-y-4">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Çoklu API Entegrasyonu</CardTitle>
                <CardDescription>
                  Birden fazla kaynaktan paralel veri toplayın. API anahtarları Cloud ayarlarından girilmelidir.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-semibold">Tüm API'leri Kullan</p>
                    <p className="text-sm text-muted-foreground">Mevcut tüm API'lerden veri topla</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={useAllApis}
                    onChange={(e) => setUseAllApis(e.target.checked)}
                    className="w-5 h-5"
                  />
                </div>

                {!useAllApis && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Kullanılacak API'leri Seçin:</p>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">DBpedia</p>
                        <p className="text-xs text-muted-foreground">Ücretsiz, anahtar gerekmez</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={enabledApis.includes('dbpedia')}
                        onChange={() => toggleApi('dbpedia')}
                        className="w-4 h-4"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Foursquare Places</p>
                        <p className="text-xs text-muted-foreground">950 istek/gün - FOURSQUARE_API_KEY gerekli</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={enabledApis.includes('foursquare')}
                        onChange={() => toggleApi('foursquare')}
                        className="w-4 h-4"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Google Places</p>
                        <p className="text-xs text-muted-foreground">Sınırlı ücretsiz - GOOGLE_PLACES_API_KEY gerekli</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={enabledApis.includes('google')}
                        onChange={() => toggleApi('google')}
                        className="w-4 h-4"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">GeoNames</p>
                        <p className="text-xs text-muted-foreground">Ücretsiz - GEONAMES_USERNAME gerekli</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={enabledApis.includes('geonames')}
                        onChange={() => toggleApi('geonames')}
                        className="w-4 h-4"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Atlas Obscura</p>
                        <p className="text-xs text-muted-foreground">Web scraping - anahtar gerekmez</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={enabledApis.includes('atlas')}
                        onChange={() => toggleApi('atlas')}
                        className="w-4 h-4"
                      />
                    </div>
                  </div>
                )}

                <Button onClick={triggerMultiScan} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                  Çoklu API Taraması Başlat
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="duplicates">
            <Card className="glass">
              <CardHeader>
                <CardTitle>🔍 Olası Duplikat Mekanlar</CardTitle>
                <CardDescription>
                  Benzer isim veya koordinatlara sahip mekanları inceleyin ve birleştirin
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={fetchPotentialDuplicates} 
                  disabled={scanningDuplicates}
                  className="mb-4"
                >
                  {scanningDuplicates ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Taranıyor...
                    </>
                  ) : (
                    'Duplikatları Tara'
                  )}
                </Button>
                
                {duplicates.length === 0 ? (
                  <p className="text-muted-foreground">Duplikat taraması yapılmadı veya duplikat bulunamadı ✅</p>
                ) : (
                  <div className="space-y-4">
                    {duplicates.map((dup, idx) => (
                      <div key={idx} className="border rounded-lg p-4 space-y-3">
                        <div>
                          <h3 className="font-semibold text-lg">{dup.mainPlace.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {dup.mainPlace.slug} • {dup.mainPlace.status}
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Benzer Mekanlar:</p>
                          {dup.similarPlaces.map((similar: any) => (
                            <div 
                              key={similar.place_id} 
                              className="flex items-center justify-between p-3 bg-muted/50 rounded border"
                            >
                              <div className="flex-1">
                                <p className="font-medium">{similar.place_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  Benzerlik: {Math.round(similar.similarity_score * 100)}%
                                  {similar.distance_km !== null && ` • Mesafe: ${similar.distance_km.toFixed(2)}km`}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => mergePlaces(dup.mainPlace.id, similar.place_id)}
                              >
                                Birleştir
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Veri Toplama Ayarları</CardTitle>
                <CardDescription>
                  Otomatik veri toplama yöntemini seçin. Bu ayar hem manuel hem de otomatik taramaları etkiler.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <RadioGroup 
                  value={dataCollectionMethod} 
                  onValueChange={(val) => setDataCollectionMethod(val as 'api' | 'ai')}
                  className="space-y-4"
                >
                  <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                    <RadioGroupItem value="api" id="api" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="api" className="text-base font-semibold cursor-pointer">
                        API Tarama
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Wikipedia, Wikidata ve OpenStreetMap API'lerinden ücretsiz veri toplar.
                        Daha güvenilir ancak sınırlı sonuçlar.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                    <RadioGroupItem value="ai" id="ai" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="ai" className="text-base font-semibold cursor-pointer">
                        AI Tarama
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Lovable AI kullanarak web'de akıllı arama yapar.
                        Daha geniş sonuçlar ancak kullanım kredisi gerektirir.
                      </p>
                    </div>
                  </div>
                </RadioGroup>
                <Button onClick={saveSettings} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Settings className="w-4 h-4 mr-2" />}
                  Kaydet
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
