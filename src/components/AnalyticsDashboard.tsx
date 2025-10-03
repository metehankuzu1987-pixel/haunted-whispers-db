import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Eye, TrendingUp, Search, MessageSquare, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface AnalyticsStats {
  totalViews: number;
  todayViews: number;
  weekViews: number;
  uniqueSessions: number;
  totalInteractions: number;
  popularPlaces: Array<{ name: string; views: number; votes: number }>;
  topSearches: Array<{ query: string; count: number }>;
  dailyTrend: Array<{ date: string; views: number }>;
  categoryDistribution: Array<{ category: string; count: number }>;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export const AnalyticsDashboard = () => {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentViews, setRecentViews] = useState<any[]>([]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Total and filtered views
      const { data: allViews } = await supabase.from('page_views').select('*');
      const { data: todayViewsData } = await supabase
        .from('page_views')
        .select('*')
        .gte('created_at', today.toISOString());
      const { data: weekViewsData } = await supabase
        .from('page_views')
        .select('*')
        .gte('created_at', weekAgo.toISOString());

      // Unique sessions
      const { data: sessions } = await supabase.from('analytics_sessions').select('session_id');

      // Total interactions
      const { data: interactions } = await supabase.from('place_interactions').select('*');

      // Popular places
      const { data: placeInteractions } = await supabase
        .from('place_interactions')
        .select('place_id, interaction_type, places(name, category)')
        .limit(100);

      const placeStats = new Map();
      placeInteractions?.forEach((item: any) => {
        const placeId = item.place_id;
        if (!placeStats.has(placeId)) {
          placeStats.set(placeId, {
            name: item.places?.name || 'Unknown',
            views: 0,
            votes: 0,
          });
        }
        const stat = placeStats.get(placeId);
        if (item.interaction_type === 'view') stat.views++;
        if (item.interaction_type === 'vote_up' || item.interaction_type === 'vote_down') stat.votes++;
      });

      const popularPlaces = Array.from(placeStats.values())
        .sort((a, b) => b.views + b.votes - (a.views + a.votes))
        .slice(0, 5);

      // Top searches
      const { data: searches } = await supabase
        .from('search_queries')
        .select('query_text')
        .not('query_text', 'is', null);

      const searchCounts = new Map();
      searches?.forEach((s: any) => {
        const query = s.query_text.toLowerCase();
        searchCounts.set(query, (searchCounts.get(query) || 0) + 1);
      });

      const topSearches = Array.from(searchCounts.entries())
        .map(([query, count]) => ({ query, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Daily trend (last 7 days)
      const dailyTrend = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        const { count } = await supabase
          .from('page_views')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', dayStart.toISOString())
          .lt('created_at', dayEnd.toISOString());

        dailyTrend.push({
          date: dayStart.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
          views: count || 0,
        });
      }

      // Category distribution
      const { data: categoryData } = await supabase
        .from('place_interactions')
        .select('places(category)')
        .eq('interaction_type', 'view');

      const categoryCounts = new Map();
      categoryData?.forEach((item: any) => {
        const cat = item.places?.category || 'Diğer';
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      });

      const categoryDistribution = Array.from(categoryCounts.entries())
        .map(([category, count]) => ({ category, count }))
        .slice(0, 5);

      setStats({
        totalViews: allViews?.length || 0,
        todayViews: todayViewsData?.length || 0,
        weekViews: weekViewsData?.length || 0,
        uniqueSessions: sessions?.length || 0,
        totalInteractions: interactions?.length || 0,
        popularPlaces,
        topSearches,
        dailyTrend,
        categoryDistribution,
      });

      // Recent views
      const { data: recent } = await supabase
        .from('page_views')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      setRecentViews(recent || []);

      toast.success('Analytics yenilendi');
    } catch (error) {
      console.error('Analytics fetch error:', error);
      toast.error('Analytics yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();

    // Real-time updates
    const channel = supabase
      .channel('analytics-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'page_views' }, () => {
        fetchAnalytics();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center p-8">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
        <Button onClick={fetchAnalytics} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Yenile
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Görüntüleme</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalViews.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Tüm zamanlar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bugünkü Görüntüleme</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.todayViews.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Son 24 saat</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Benzersiz Ziyaretçi</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.uniqueSessions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Toplam oturum</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Etkileşimler</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalInteractions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Oylar ve yorumlar</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Son 7 Gün Trendi</CardTitle>
            <CardDescription>Günlük sayfa görüntüleme sayıları</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats?.dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kategori Dağılımı</CardTitle>
            <CardDescription>En çok görüntülenen kategoriler</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats?.categoryDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ category, count }) => `${category}: ${count}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {stats?.categoryDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Popular Places & Top Searches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>En Popüler Yerler</CardTitle>
            <CardDescription>Görüntüleme + oy sayısına göre</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.popularPlaces.map((place, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-muted-foreground">#{idx + 1}</span>
                    <span className="font-medium">{place.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {place.views}
                    </div>
                    <div className="flex items-center gap-1">
                      <ArrowUp className="w-3 h-3" />
                      {place.votes}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>En Çok Aranan Kelimeler</CardTitle>
            <CardDescription>Kullanıcı arama sorguları</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats?.topSearches.map((search, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{search.query}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{search.count}x</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Son Aktiviteler</CardTitle>
          <CardDescription>Anlık sayfa görüntülemeleri</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recentViews.map((view) => (
              <div key={view.id} className="flex items-center justify-between text-sm border-b pb-2">
                <div>
                  <span className="font-medium">{view.page_path}</span>
                  {view.referrer && <span className="text-muted-foreground ml-2">← {view.referrer}</span>}
                </div>
                <span className="text-muted-foreground text-xs">
                  {new Date(view.created_at).toLocaleString('tr-TR')}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
