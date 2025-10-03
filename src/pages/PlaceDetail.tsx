import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Place, Comment } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation, Language } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  MapPin,
  CheckCircle2,
  Bot,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Star,
  MessageSquare,
  AlertCircle,
  Loader2,
  Trash2,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PlaceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [lang, setLang] = useState<Language>('tr');
  const { t } = useTranslation(lang);
  const { toast } = useToast();

  const [place, setPlace] = useState<Place | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [voteProcessing, setVoteProcessing] = useState(false);

  // Yorum formu
  const [commentForm, setCommentForm] = useState({ nickname: '', message: '' });
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const handleAdminStatusChange = async (status: 'pending' | 'approved' | 'rejected') => {
    if (!place) return;
    const { error } = await supabase
      .from('places')
      .update({ status })
      .eq('id', place.id);
    if (error) {
      toast({ title: 'Güncelleme hatası', variant: 'destructive' });
    } else {
      toast({ title: 'Durum güncellendi' });
      fetchData();
    }
  };

  const handleAdminDelete = async () => {
    if (!place) return;
    if (!confirm('Bu yeri silmek istediğinizden emin misiniz?')) return;
    const { error } = await supabase.from('places').delete().eq('id', place.id);
    if (error) {
      toast({ title: 'Silme hatası', variant: 'destructive' });
    } else {
      toast({ title: 'Yer silindi' });
      navigate('/');
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);

    try {
      const { data: placeData, error: placeError } = await supabase
        .from('places')
        .select('*')
        .eq('id', id)
        .single();

      if (placeError) throw placeError;
      setPlace({
        ...placeData,
        sources_json: (placeData.sources_json as any) || []
      } as Place);

      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .eq('place_id', id)
        .order('created_at', { ascending: false });

      if (commentsError) throw commentsError;
      setComments((commentsData || []) as Comment[]);
    } catch (error) {
      console.error('Veri çekilirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (type: 'up' | 'down') => {
    if (!place || voteProcessing) return;
    setVoteProcessing(true);

    try {
      const field = type === 'up' ? 'votes_up' : 'votes_down';
      const { error } = await supabase
        .from('places')
        .update({ [field]: place[field] + 1 })
        .eq('id', place.id);

      if (error) throw error;

      setPlace({ ...place, [field]: place[field] + 1 });
      toast({ title: t('vote.success') });
    } catch (error) {
      toast({ title: 'Hata', variant: 'destructive' });
    } finally {
      setVoteProcessing(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!place || !commentForm.nickname || !commentForm.message) return;
    if (commentForm.message.length > 200) {
      toast({ title: 'Mesaj çok uzun (max 200 karakter)', variant: 'destructive' });
      return;
    }

    setCommentSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          place_id: place.id,
          nickname: commentForm.nickname,
          message: commentForm.message,
        })
        .select()
        .single();

      if (error) throw error;

      setComments([data as Comment, ...comments]);
      setCommentForm({ nickname: '', message: '' });
      toast({ title: t('comments.success') });
    } catch (error) {
      toast({ title: 'Hata', variant: 'destructive' });
    } finally {
      setCommentSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header lang={lang} onLangChange={setLang} />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!place) {
    return (
      <div className="min-h-screen">
        <Header lang={lang} onLangChange={setLang} />
        <div className="container mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground">Yer bulunamadı</p>
        </div>
      </div>
    );
  }

  const getScoreBadgeClass = (score: number) => {
    if (score >= 80) return 'badge-score-high';
    if (score >= 60) return 'badge-score-medium';
    return 'badge-score-low';
  };

  return (
    <div className="min-h-screen">
      <Header lang={lang} onLangChange={setLang} onRefresh={fetchData} />

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="glass rounded-xl p-6 space-y-6">
          {/* Başlık */}
          <div>
            <div className="flex items-start justify-between gap-4 mb-3">
              <h1 className="text-3xl font-bold text-foreground">{place.name}</h1>
              <div className="flex flex-col gap-2">
                <TooltipProvider>
                  {place.ai_collected === 1 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge className="badge-ai cursor-help">
                          <Bot className="w-4 h-4 mr-1" />
                          {t('disclosure.aiCollected')}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="glass">
                        <p>{t('disclosure.aiTooltip')}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {place.human_approved === 1 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge className="badge-approved cursor-help">
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          {t('disclosure.humanApproved')}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="glass">
                        <p>{t('disclosure.humanTooltip')}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </TooltipProvider>
              </div>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <MapPin className="w-4 h-4" />
              <span>
                {place.country_code}
                {place.city && ` • ${place.city}`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline">{place.category}</Badge>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className={`${getScoreBadgeClass(place.evidence_score)} cursor-help`}>
                      {t('place.score')}: {place.evidence_score}/100
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="glass">
                    <p>{t('place.scoreTooltip')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 mt-4">
              <Select value={place.status} onValueChange={(val) => handleAdminStatusChange(val as any)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Durum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Bekliyor</SelectItem>
                  <SelectItem value="approved">Onaylı</SelectItem>
                  <SelectItem value="rejected">Reddedildi</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="destructive" onClick={handleAdminDelete}>
                <Trash2 className="w-4 h-4 mr-2" /> Sil
              </Button>
            </div>
          )}

          {/* Koordinatlar */}
          {(place.lat || place.lon) && (
            <div className="pt-4 border-t border-border/30">
              <h3 className="text-sm font-semibold mb-2">{t('place.coordinates')}</h3>
              <p className="text-sm text-muted-foreground">
                {place.lat}, {place.lon}
              </p>
            </div>
          )}

          {/* Açıklama */}
          {place.description && (
            <div className="pt-4 border-t border-border/30">
              <p className="text-foreground leading-relaxed">
                {showFullDescription
                  ? place.description
                  : place.description.length > 400
                  ? `${place.description.substring(0, 400)}...`
                  : place.description}
              </p>
              {place.description.length > 400 && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setShowFullDescription(!showFullDescription)}
                  className="mt-2 px-0"
                >
                  {showFullDescription ? t('place.readLess') : t('place.readMore')}
                </Button>
              )}
            </div>
          )}

          {/* Kaynaklar */}
          <div className="pt-4 border-t border-border/30">
            <h3 className="text-sm font-semibold mb-3">{t('place.sources')}</h3>
            <div className="space-y-2">
              {place.sources_json.map((source, idx) => (
                <a
                  key={idx}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  {source.domain} ({source.type})
                </a>
              ))}
            </div>
          </div>

          {/* Oylama */}
          <div className="pt-4 border-t border-border/30">
            <h3 className="text-sm font-semibold mb-3">{t('vote.title')}</h3>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => handleVote('up')}
                disabled={voteProcessing}
                className="hover-glow"
              >
                <ThumbsUp className="w-4 h-4 mr-2" />
                {t('vote.up')} ({place.votes_up})
              </Button>
              <Button
                variant="outline"
                onClick={() => handleVote('down')}
                disabled={voteProcessing}
                className="hover-glow"
              >
                <ThumbsDown className="w-4 h-4 mr-2" />
                {t('vote.down')} ({place.votes_down})
              </Button>
            </div>
          </div>

          {/* Yorumlar */}
          <div className="pt-4 border-t border-border/30">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              {t('comments.title')} ({comments.length})
            </h3>

            {/* Yorum Ekleme Formu */}
            <form onSubmit={handleCommentSubmit} className="mb-6 space-y-3">
              <Input
                placeholder={t('comments.nickname')}
                value={commentForm.nickname}
                onChange={(e) => setCommentForm({ ...commentForm, nickname: e.target.value })}
                maxLength={50}
                required
              />
              <Textarea
                placeholder={t('comments.message')}
                value={commentForm.message}
                onChange={(e) => setCommentForm({ ...commentForm, message: e.target.value })}
                maxLength={200}
                rows={3}
                required
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  {commentForm.message.length}/200
                </span>
                <Button type="submit" disabled={commentSubmitting} className="hover-glow">
                  {commentSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {t('comments.submit')}
                </Button>
              </div>
            </form>

            {/* Yorum Listesi */}
            <div className="space-y-3">
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t('comments.empty')}
                </p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="glass rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{comment.nickname}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(comment.created_at).toLocaleDateString(
                          lang === 'tr' ? 'tr-TR' : 'en-US'
                        )}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{comment.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PlaceDetail;