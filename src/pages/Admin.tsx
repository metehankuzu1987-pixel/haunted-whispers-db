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
import { HeroMediaUpload } from '@/components/HeroMediaUpload';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Eye, Play, Settings, Database, Users, Zap, Shield, ExternalLink, Clock, Home, LogIn, AlertTriangle, RefreshCw, XCircle, BarChart3, MessageSquare } from 'lucide-react';
import type { Place, Comment } from '@/types';
import { placeSchema } from '@/lib/validation';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';

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
  const [userCount, setUserCount] = useState(0);
  const [recentPlaces, setRecentPlaces] = useState<Place[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [criticalCount, setCriticalCount] = useState(0);
  const [showCriticalBanner, setShowCriticalBanner] = useState(false);
  const [currentIP, setCurrentIP] = useState<string>('');
  const [ignoredIPs, setIgnoredIPs] = useState<string[]>([]);
  const [newIP, setNewIP] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [apiKeys, setApiKeys] = useState({
    google_places: '',
    foursquare: '',
    geonames_username: '',
    openai: ''
  });
  const [scanningPaused, setScanningPaused] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    category: '',
    description: '',
    country_code: '',
    city: '',
    evidence_score: 70,
    status: 'pending' as 'pending' | 'approved' | 'rejected',
    name_en: '',
    description_en: ''
  });

  // Don't redirect, just show access denied UI below

  useEffect(() => {
    if (isAdmin) {
      fetchPlaces();
      fetchScanLogs();
      fetchSettings();
      fetchUserCount();
      fetchRecentPlaces();
      fetchSecurityLogs();
      fetchCurrentIP();
      fetchIgnoredIPs();
      fetchComments();
      fetchApiKeys();
      fetchScanStatus();
    }
  }, [isAdmin]);

  // Real-time security monitoring
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel('security-logs-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'logs',
        filter: 'scope=eq.security'
      }, (payload) => {
        const newLog = payload.new;
        setSecurityLogs(prev => [newLog, ...prev]);
        
        // Show toast for new security events
        if (newLog.level === 'error') {
          toast.error(`🚨 Güvenlik Uyarısı: ${newLog.message}`);
          setCriticalCount(prev => prev + 1);
          setShowCriticalBanner(true);
        } else if (newLog.level === 'warn') {
          toast.warning(`⚠️ Güvenlik: ${newLog.message}`);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  // Real-time IP settings monitoring
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel('app-settings-realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'app_settings',
        filter: 'setting_key=eq.ignored_ips'
      }, (payload) => {
        const newValue = payload.new.setting_value;
        if (newValue) {
          const ips = JSON.parse(newValue);
          setIgnoredIPs(ips);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  // Real-time comments monitoring
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel('comments-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'comments'
      }, async (payload) => {
        const newComment = payload.new as Comment;
        
        // Fetch place name for notification
        const { data: place } = await supabase
          .from('places')
          .select('name')
          .eq('id', newComment.place_id)
          .single();
        
        // Add to comments list
        setComments(prev => [newComment, ...prev]);
        setCommentCount(prev => prev + 1);
        
        // Show toast notification
        toast.success(`🆕 Yeni yorum: ${newComment.nickname} - ${place?.name || 'Bilinmeyen yer'}`);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const fetchUserCount = async () => {
    const { count } = await supabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true });
    setUserCount(count || 0);
  };

  const fetchRecentPlaces = async () => {
    const { data } = await supabase
      .from('places')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentPlaces((data || []) as any);
  };

  const fetchSecurityLogs = async () => {
    const { data, error } = await supabase
      .from('logs')
      .select('*')
      .eq('scope', 'security')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (!error && data) {
      setSecurityLogs(data);
      
      // Count critical events in last 24 hours
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const criticalEvents = data.filter(
        log => log.level === 'error' && log.created_at > yesterday
      );
      setCriticalCount(criticalEvents.length);
      setShowCriticalBanner(criticalEvents.length > 0);
    }
  };

  const getSeverityColor = (level: string) => {
    switch (level) {
      case 'error': return 'bg-destructive/20 text-destructive border-destructive/50';
      case 'warn': return 'bg-orange-500/20 text-orange-300 border-orange-500/50';
      default: return 'bg-blue-500/20 text-blue-300 border-blue-500/50';
    }
  };

  const getSeverityIcon = (level: string) => {
    switch (level) {
      case 'error': return <XCircle className="w-4 h-4" />;
      case 'warn': return <AlertTriangle className="w-4 h-4" />;
      default: return <Shield className="w-4 h-4" />;
    }
  };

  const openBackend = (path: string = '') => {
    const baseUrl = `https://lovable.dev/projects/${import.meta.env.VITE_SUPABASE_PROJECT_ID}/backend`;
    window.open(`${baseUrl}${path}`, '_blank');
  };

  const fetchCurrentIP = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-client-ip');
      if (!error && data?.ip) {
        setCurrentIP(data.ip);
      }
    } catch (error) {
      console.error('Failed to fetch current IP:', error);
    }
  };

  const fetchIgnoredIPs = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'ignored_ips')
        .single();
      
      if (data?.setting_value) {
        const ips = JSON.parse(data.setting_value);
        setIgnoredIPs(ips);
      }
    } catch (error) {
      console.error('Failed to fetch ignored IPs:', error);
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          places:place_id (
            name,
            slug
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setComments((data || []) as any);
      setCommentCount((data || []).length);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Bu yorumu silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      setComments(prev => prev.filter(c => c.id !== commentId));
      setCommentCount(prev => prev - 1);
      toast.success('Yorum silindi');
    } catch (error: any) {
      toast.error('Yorum silinemedi: ' + error.message);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['google_places_api_key', 'foursquare_api_key', 'geonames_username', 'openai_api_key']);
      
      if (data) {
        const keys: any = { google_places: '', foursquare: '', geonames_username: '', openai: '' };
        data.forEach(item => {
          if (item.setting_key === 'google_places_api_key') keys.google_places = item.setting_value || '';
          if (item.setting_key === 'foursquare_api_key') keys.foursquare = item.setting_value || '';
          if (item.setting_key === 'geonames_username') keys.geonames_username = item.setting_value || '';
          if (item.setting_key === 'openai_api_key') keys.openai = item.setting_value || '';
        });
        setApiKeys(keys);
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    }
  };

  const fetchScanStatus = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'scanning_paused')
        .single();
      
      if (data) {
        setScanningPaused(data.setting_value === 'true');
      }
    } catch (error) {
      console.error('Failed to fetch scan status:', error);
    }
  };

  const saveApiKey = async (keyName: string, value: string) => {
    const settingKey = keyName === 'google_places' ? 'google_places_api_key' 
      : keyName === 'foursquare' ? 'foursquare_api_key'
      : keyName === 'geonames_username' ? 'geonames_username'
      : 'openai_api_key';

    const { error } = await supabase
      .from('app_settings')
      .upsert({ 
        setting_key: settingKey,
        setting_value: value,
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });

    if (error) {
      toast.error('API Key kaydedilemedi: ' + error.message);
    } else {
      toast.success('API Key kaydedildi');
      fetchApiKeys();
    }
  };

  const toggleScanning = async () => {
    const newStatus = !scanningPaused;
    
    const { error } = await supabase
      .from('app_settings')
      .upsert({ 
        setting_key: 'scanning_paused',
        setting_value: newStatus.toString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });

    if (error) {
      toast.error('Durum değiştirilemedi: ' + error.message);
    } else {
      setScanningPaused(newStatus);
      toast.success(newStatus ? '🛑 Tüm taramalar durduruldu' : '▶️ Taramalar aktif');
    }
  };

  const validateIP = (ip: string): boolean => {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) return false;
    
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part);
      return num >= 0 && num <= 255;
    });
  };

  const addIgnoredIP = async (ip: string) => {
    if (!validateIP(ip)) {
      toast.error('Geçersiz IP formatı! Örnek: 192.168.1.1');
      return;
    }

    if (ignoredIPs.includes(ip)) {
      toast.error('Bu IP zaten listede!');
      return;
    }

    if (ignoredIPs.length >= 50) {
      toast.error('Maksimum 50 IP ekleyebilirsiniz!');
      return;
    }

    const newList = [...ignoredIPs, ip];
    
    const { error } = await supabase
      .from('app_settings')
      .update({ 
        setting_value: JSON.stringify(newList),
        updated_at: new Date().toISOString()
      })
      .eq('setting_key', 'ignored_ips');

    if (error) {
      toast.error('IP eklenemedi: ' + error.message);
    } else {
      setIgnoredIPs(newList);
      setNewIP('');
      toast.success(`IP eklendi: ${ip}`);
    }
  };

  const removeIgnoredIP = async (ip: string) => {
    const newList = ignoredIPs.filter(i => i !== ip);
    
    const { error } = await supabase
      .from('app_settings')
      .update({ 
        setting_value: JSON.stringify(newList),
        updated_at: new Date().toISOString()
      })
      .eq('setting_key', 'ignored_ips');

    if (error) {
      toast.error('IP kaldırılamadı: ' + error.message);
    } else {
      setIgnoredIPs(newList);
      toast.success(`IP kaldırıldı: ${ip}`);
    }
  };

  const addMyIP = async () => {
    if (!currentIP || currentIP === 'unknown') {
      toast.error('IP adresiniz alınamadı, lütfen tekrar deneyin');
      return;
    }
    await addIgnoredIP(currentIP);
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
    
    // Validate form data
    const validation = placeSchema.safeParse(formData);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setLoading(true);

    const slug = formData.slug || formData.name.toLowerCase()
      .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const { error } = await supabase.from('places').insert({
      name: validation.data.name,
      slug,
      category: validation.data.category,
      description: validation.data.description,
      country_code: validation.data.country_code,
      city: validation.data.city,
      evidence_score: validation.data.evidence_score,
      status: validation.data.status,
      human_approved: 1,
      ai_collected: 0,
      sources_json: [],
      name_en: formData.name_en || null,
      description_en: formData.description_en || null
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
        status: 'pending',
        name_en: '',
        description_en: ''
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

  const bulkApprove = async () => {
    const pendingPlaces = places.filter(p => p.status === 'pending' || p.status === 'pending_high');
    
    if (pendingPlaces.length === 0) {
      toast.info('Onaylanacak bekleyen yer yok');
      return;
    }

    if (!confirm(`${pendingPlaces.length} yeri toplu olarak onaylamak istediğinizden emin misiniz?`)) {
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('places')
      .update({ status: 'approved' })
      .in('id', pendingPlaces.map(p => p.id));
    
    setLoading(false);

    if (error) {
      toast.error('Toplu onaylama hatası: ' + error.message);
    } else {
      toast.success(`${pendingPlaces.length} yer onaylandı ve yayınlandı!`);
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

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8">
        <div className="max-w-2xl mx-auto mt-20">
          <Card className="glass border-destructive/50">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-destructive" />
              </div>
              <CardTitle className="text-2xl">Erişim Yetkiniz Yok</CardTitle>
              <CardDescription className="text-base mt-2">
                Bu sayfaya erişebilmek için admin yetkisine sahip olmanız gerekiyor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Admin rolü nasıl atanır?
                </h3>
                <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                  <li>
                    {user ? 'Zaten giriş yapmışsınız.' : 'Önce giriş yapın veya kayıt olun'}
                  </li>
                  <li>Backend panelini açın (aşağıdaki butonu kullanın)</li>
                  <li>Auth → Users bölümünden kullanıcı ID'nizi kopyalayın</li>
                  <li>Database → Tables → user_roles tablosuna gidin</li>
                  <li>
                    Insert Row ile yeni kayıt ekleyin:
                    <div className="ml-4 mt-1 font-mono text-xs bg-background p-2 rounded">
                      user_id: [kendi ID'niz]<br />
                      role: admin
                    </div>
                  </li>
                  <li>Sayfayı yenileyin</li>
                </ol>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => {
                    window.open('https://lovable.dev/projects/c60524be-c5e9-440f-b8d7-a79465a4c216/backend', '_blank');
                  }}
                  className="w-full"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Backend Panelini Aç
                </Button>
                
                {!user && (
                  <Button
                    onClick={() => navigate('/auth')}
                    variant="outline"
                    className="w-full"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Giriş Yap / Kayıt Ol
                  </Button>
                )}
                
                <Button
                  onClick={() => navigate('/')}
                  variant="ghost"
                  className="w-full"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Ana Sayfaya Dön
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Critical Events Banner */}
        {showCriticalBanner && criticalCount > 0 && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/50 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">
                  {criticalCount} Kritik Güvenlik Olayı (Son 24 Saat)
                </p>
                <p className="text-sm text-muted-foreground">
                  Güvenlik sekmesinden detayları inceleyebilirsiniz
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowCriticalBanner(false)}
            >
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
        )}

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <Button onClick={() => navigate('/')} variant="outline">
            Ana Sayfa
          </Button>
        </div>

        <Tabs defaultValue="places" className="w-full">
          <TabsList className="grid w-full grid-cols-11">
            <TabsTrigger value="places">Yerler ({places.length})</TabsTrigger>
            <TabsTrigger value="add">Yeni Ekle</TabsTrigger>
            <TabsTrigger value="scan">Tarama</TabsTrigger>
            <TabsTrigger value="apis">Gelişmiş API</TabsTrigger>
            <TabsTrigger value="duplicates">Duplikatlar</TabsTrigger>
            <TabsTrigger value="comments" className="relative">
              <MessageSquare className="w-4 h-4 mr-1" />
              Yorumlar
              {commentCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-primary text-white text-xs rounded-full flex items-center justify-center">
                  {commentCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="api-settings">
              <Settings className="w-4 h-4 mr-1" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="w-4 h-4 mr-1" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="security" className="relative">
              Güvenlik
              {criticalCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white text-xs rounded-full flex items-center justify-center">
                  {criticalCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="backend">Backend</TabsTrigger>
            <TabsTrigger value="settings">Ayarlar</TabsTrigger>
          </TabsList>

          <TabsContent value="places" className="space-y-4">
            {places.filter(p => p.status === 'pending' || p.status === 'pending_high').length > 0 && (
              <Card className="glass border-2 border-primary/50">
                <CardHeader>
                  <CardTitle>Toplu İşlemler</CardTitle>
                  <CardDescription>
                    {places.filter(p => p.status === 'pending' || p.status === 'pending_high').length} bekleyen yer var
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={bulkApprove} 
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Tüm Bekleyenleri Onayla ve Yayınla
                  </Button>
                </CardContent>
              </Card>
            )}
            
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
                    <Label htmlFor="description">Açıklama (Türkçe)</Label>
                    <Textarea
                      id="description"
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name_en">İsim (İngilizce) - Opsiyonel</Label>
                      <Input
                        id="name_en"
                        value={formData.name_en || ''}
                        onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                        placeholder="English name (optional)"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description_en">Açıklama (İngilizce) - Opsiyonel</Label>
                    <Textarea
                      id="description_en"
                      value={formData.description_en || ''}
                      onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                      rows={4}
                      placeholder="English description (optional)"
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
            {scanningPaused && (
              <Card className="border-orange-500/50 bg-orange-500/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-300">
                    <AlertTriangle className="w-5 h-5" />
                    Taramalar Durduruldu
                  </CardTitle>
                  <CardDescription>
                    Tüm otomatik taramalar şu anda duraklatılmış durumda. Taramaları yeniden başlatmak için aşağıdaki butona tıklayın.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}

            <Card className="glass">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Tarama Kontrolü</CardTitle>
                    <CardDescription>
                      Tüm otomatik taramaları durdur veya başlat
                    </CardDescription>
                  </div>
                  <Button
                    onClick={toggleScanning}
                    variant={scanningPaused ? "default" : "destructive"}
                    size="lg"
                  >
                    {scanningPaused ? (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Taramaları Başlat
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 mr-2" />
                        Tüm Taramaları Durdur
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>{dataCollectionMethod === 'ai' ? 'AI Web Tarama' : 'API Tarama'}</CardTitle>
                <CardDescription>
                  Sistem her 2 saatte bir otomatik olarak <strong>{dataCollectionMethod === 'ai' ? 'AI' : 'API'}</strong> taraması yapar. 
                  Manuel başlatmak için butona tıklayın.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={triggerScan} disabled={loading || scanningPaused} className="w-full">
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

          <TabsContent value="api-settings">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Çoklu API Entegrasyonu</CardTitle>
                  <CardDescription>
                    Harici API servisleri için gerekli anahtarları girin
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="google-places-key">Google Places API Key</Label>
                    <div className="flex gap-2">
                      <Input
                        id="google-places-key"
                        type="password"
                        placeholder="AIza..."
                        value={apiKeys.google_places}
                        onChange={(e) => setApiKeys(prev => ({ ...prev, google_places: e.target.value }))}
                      />
                      <Button onClick={() => saveApiKey('google_places', apiKeys.google_places)}>
                        Kaydet
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Google Places API için gerekli. <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline">Buradan</a> alabilirsiniz.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="foursquare-key">Foursquare API Key</Label>
                    <div className="flex gap-2">
                      <Input
                        id="foursquare-key"
                        type="password"
                        placeholder="fsq..."
                        value={apiKeys.foursquare}
                        onChange={(e) => setApiKeys(prev => ({ ...prev, foursquare: e.target.value }))}
                      />
                      <Button onClick={() => saveApiKey('foursquare', apiKeys.foursquare)}>
                        Kaydet
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Foursquare Places API için gerekli. <a href="https://foursquare.com/developers/" target="_blank" rel="noopener noreferrer" className="underline">Buradan</a> alabilirsiniz.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="geonames-username">GeoNames Username</Label>
                    <div className="flex gap-2">
                      <Input
                        id="geonames-username"
                        type="text"
                        placeholder="kullanıcı_adı"
                        value={apiKeys.geonames_username}
                        onChange={(e) => setApiKeys(prev => ({ ...prev, geonames_username: e.target.value }))}
                      />
                      <Button onClick={() => saveApiKey('geonames_username', apiKeys.geonames_username)}>
                        Kaydet
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      GeoNames web servisleri için gerekli. <a href="https://www.geonames.org/login" target="_blank" rel="noopener noreferrer" className="underline">Buradan</a> ücretsiz hesap oluşturabilirsiniz.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>AI API Ayarları</CardTitle>
                  <CardDescription>
                    Kendi OpenAI API anahtarınızı kullanmak için
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="openai-key">OpenAI API Key (Opsiyonel)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="openai-key"
                        type="password"
                        placeholder="sk-..."
                        value={apiKeys.openai}
                        onChange={(e) => setApiKeys(prev => ({ ...prev, openai: e.target.value }))}
                      />
                      <Button onClick={() => saveApiKey('openai', apiKeys.openai)}>
                        Kaydet
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Varsayılan olarak Lovable AI kullanılır. Kendi OpenAI anahtarınızı kullanmak isterseniz buraya girin.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="apis" className="space-y-4">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Çoklu API Entegrasyonu</CardTitle>
                <CardDescription>
                  Birden fazla kaynaktan paralel veri toplayın. API anahtarlarını "API Keys" sekmesinden girebilirsiniz.
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

                <Button onClick={triggerMultiScan} disabled={loading || scanningPaused} className="w-full">
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

          <TabsContent value="security" className="space-y-4">
            <Card className="glass">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <CardTitle>Güvenlik Logları</CardTitle>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={fetchSecurityLogs}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Yenile
                  </Button>
                </div>
                <CardDescription>
                  Son 50 güvenlik olayı • Real-time güncellemeler aktif
                </CardDescription>
              </CardHeader>
              <CardContent>
                {securityLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Henüz güvenlik logu yok</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {securityLogs.map((log) => (
                      <div
                        key={log.id}
                        className={`p-4 border rounded-lg ${getSeverityColor(log.level)}`}
                      >
                        <div className="flex items-start gap-3">
                          {getSeverityIcon(log.level)}
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <p className="font-semibold">{log.message}</p>
                              <span className="text-xs opacity-75">
                                {new Date(log.created_at).toLocaleString('tr-TR')}
                              </span>
                            </div>
                            
                            {log.meta_json && Object.keys(log.meta_json).length > 0 && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-sm opacity-75 hover:opacity-100">
                                  Detayları Göster
                                </summary>
                                <div className="mt-2 p-3 bg-background/50 rounded text-xs font-mono overflow-auto">
                                  <pre>{JSON.stringify(log.meta_json, null, 2)}</pre>
                                </div>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backend" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Database Management */}
              <Card className="glass">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">Veritabanı Yönetimi</CardTitle>
                  </div>
                  <CardDescription>Tabloları görüntüle ve yönet</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Button 
                      onClick={() => openBackend('/database/tables')} 
                      variant="outline" 
                      className="w-full justify-start"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Tabloları Görüntüle
                    </Button>
                    <Button 
                      onClick={() => openBackend('/database/tables')} 
                      variant="outline" 
                      className="w-full justify-start"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Yeni Tablo Oluştur
                    </Button>
                  </div>
                  <div className="pt-3 border-t">
                    <p className="text-sm font-medium mb-2">Son Eklenen Yerler:</p>
                    <div className="space-y-1">
                      {recentPlaces.slice(0, 3).map(place => (
                        <div key={place.id} className="text-xs p-2 bg-muted/50 rounded">
                          <p className="font-medium truncate">{place.name}</p>
                          <p className="text-muted-foreground">
                            {new Date(place.created_at).toLocaleDateString('tr-TR')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* User Management */}
              <Card className="glass">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">Kullanıcı Yönetimi</CardTitle>
                  </div>
                  <CardDescription>Kullanıcıları ve yetkileri yönet</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Button 
                      onClick={() => openBackend('/auth/users')} 
                      variant="outline" 
                      className="w-full justify-start"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Kullanıcıları Görüntüle
                    </Button>
                    <Button 
                      onClick={() => openBackend('/auth/settings')} 
                      variant="outline" 
                      className="w-full justify-start"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Auth Ayarları
                    </Button>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Toplam Kullanıcı:</p>
                      <p className="text-2xl font-bold">{userCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Edge Functions */}
              <Card className="glass">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">Edge Functions</CardTitle>
                  </div>
                  <CardDescription>Serverless fonksiyonları yönet</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Button 
                      onClick={() => openBackend('/functions')} 
                      variant="outline" 
                      className="w-full justify-start"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Function Loglarını Görüntüle
                    </Button>
                  </div>
                  <div className="pt-3 border-t">
                    <p className="text-sm font-medium mb-2">Aktif Functions:</p>
                    <div className="space-y-1">
                      {['ai-scan', 'api-scan', 'multi-scan'].map(fn => (
                        <div key={fn} className="text-xs p-2 bg-muted/50 rounded flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="font-mono">{fn}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Security & RLS */}
              <Card className="glass">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">Güvenlik & RLS</CardTitle>
                  </div>
                  <CardDescription>Row Level Security politikaları</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Button 
                      onClick={() => openBackend('/database/policies')} 
                      variant="outline" 
                      className="w-full justify-start"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      RLS Politikalarını Görüntüle
                    </Button>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded">
                      <p className="text-sm font-medium text-green-400">✓ RLS Aktif</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Tüm tablolar korunuyor
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Stats */}
            <Card className="glass">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">Hızlı İstatistikler</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted/50 rounded text-center">
                    <p className="text-2xl font-bold">{places.length}</p>
                    <p className="text-xs text-muted-foreground">Toplam Yer</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded text-center">
                    <p className="text-2xl font-bold">{places.filter(p => p.status === 'approved').length}</p>
                    <p className="text-xs text-muted-foreground">Onaylı</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded text-center">
                    <p className="text-2xl font-bold">{userCount}</p>
                    <p className="text-xs text-muted-foreground">Kullanıcı</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded text-center">
                    <p className="text-2xl font-bold">3</p>
                    <p className="text-xs text-muted-foreground">Edge Function</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-6">
              {/* Hero Media Upload */}
              <HeroMediaUpload />

              {/* Data Collection Settings */}
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

            {/* IP Filtering Settings */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>IP Bazlı Analytics Filtreleme</CardTitle>
                <CardDescription>
                  Belirtilen IP adreslerinden gelen ziyaretler analytics'e dahil edilmeyecek
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current IP Display */}
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium mb-1">Şu Anki IP Adresiniz</p>
                      <p className="text-lg font-mono">{currentIP || 'Yükleniyor...'}</p>
                    </div>
                    <Button
                      onClick={addMyIP}
                      variant="outline"
                      disabled={!currentIP || currentIP === 'unknown' || ignoredIPs.includes(currentIP)}
                    >
                      {ignoredIPs.includes(currentIP) ? 'Zaten Eklendi' : 'Benim IP\'mi Yoksay'}
                    </Button>
                  </div>
                </div>

                {/* Ignored IPs List */}
                {ignoredIPs.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Yoksayılan IP Adresleri ({ignoredIPs.length}/50)</Label>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {ignoredIPs.map(ip => (
                        <div 
                          key={ip}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded border"
                        >
                          <code className="text-sm font-mono">{ip}</code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeIgnoredIP(ip)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manual IP Addition */}
                <div className="space-y-2">
                  <Label htmlFor="new-ip">Manuel IP Ekle</Label>
                  <div className="flex gap-2">
                    <Input
                      id="new-ip"
                      type="text"
                      placeholder="örn: 192.168.1.1"
                      value={newIP}
                      onChange={(e) => setNewIP(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addIgnoredIP(newIP);
                        }
                      }}
                    />
                    <Button 
                      onClick={() => addIgnoredIP(newIP)}
                      disabled={!newIP}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Ekle
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    IPv4 formatında IP adresi girin. Maksimum 50 IP ekleyebilirsiniz.
                  </p>
                </div>
              </CardContent>
            </Card>
            </div>
          </TabsContent>

          {/* Comments Tab */}
          <TabsContent value="comments" className="space-y-4">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Yorumlar ({commentCount})
                </CardTitle>
                <CardDescription>
                  Kullanıcıların yerler hakkında yazdığı yorumları görüntüleyin ve yönetin
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {comments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Henüz yorum yok</p>
                  </div>
                ) : (
                  comments.map((comment: any) => (
                    <div
                      key={comment.id}
                      className="glass p-4 rounded-lg border border-border/50 hover:border-primary/50 transition-colors"
                    >
                      <div className="flex justify-between items-start gap-4 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold">👤 {comment.nickname}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(comment.created_at).toLocaleDateString('tr-TR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          
                          {comment.places && (
                            <div className="mb-2">
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-primary hover:underline"
                                onClick={() => navigate(`/place/${comment.place_id}`)}
                              >
                                📍 {comment.places.name}
                              </Button>
                            </div>
                          )}
                          
                          <p className="text-sm text-foreground mt-2">
                            💬 {comment.message}
                          </p>
                        </div>
                        
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteComment(comment.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <AnalyticsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
