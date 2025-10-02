import { Place } from '@/types';
import { MapPin, CheckCircle2, Bot, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useTranslation, Language } from '@/lib/i18n';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PlaceCardProps {
  place: Place;
  lang: Language;
}

export const PlaceCard = ({ place, lang }: PlaceCardProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation(lang);

  const getScoreBadgeClass = (score: number) => {
    if (score >= 80) return 'badge-score-high';
    if (score >= 60) return 'badge-score-medium';
    return 'badge-score-low';
  };

  const truncateDescription = (text: string | null, maxLength = 180) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="glass rounded-xl p-4 hover-glow">
      {/* Başlık & Rozet */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground mb-1">
            {place.name}
          </h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span>
              {place.country_code}
              {place.city && ` • ${place.city}`}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <TooltipProvider>
            {place.ai_collected === 1 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className="badge-ai text-xs px-2 py-0.5 cursor-help">
                    <Bot className="w-3 h-3 mr-1" />
                    AI
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
                  <Badge className="badge-approved text-xs px-2 py-0.5 cursor-help">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    ✓
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

      {/* Kategori & Puan */}
      <div className="flex items-center gap-2 mb-3">
        <Badge variant="outline" className="text-xs">
          {place.category}
        </Badge>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className={`${getScoreBadgeClass(place.evidence_score)} text-xs cursor-help`}>
                {place.evidence_score}/100
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="glass">
              <p>{t('place.scoreTooltip')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Açıklama */}
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        {truncateDescription(place.description)}
      </p>

      {/* Kaynaklar ve Detay */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {place.sources_json.slice(0, 3).map((source, idx) => (
            <a
              key={idx}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              {source.domain}
            </a>
          ))}
          {place.sources_json.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{place.sources_json.length - 3}
            </span>
          )}
        </div>

        <Button
          size="sm"
          onClick={() => navigate(`/place/${place.id}`)}
          className="hover-glow"
        >
          {t('place.detail')}
        </Button>
      </div>
    </div>
  );
};