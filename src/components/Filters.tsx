import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Slider } from '@/components/ui/slider';
import { useTranslation, Language } from '@/lib/i18n';
import { getCategoryLabel } from '@/lib/categoryTranslations';

export interface FilterState {
  country: string;
  city: string;
  category: string;
  minScore: number;
  sort: string;
  search: string;
}

interface FiltersProps {
  lang: Language;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  countries: { code: string; name: string }[];
  categories: string[];
}

export const Filters = ({ lang, filters, onFiltersChange, countries, categories }: FiltersProps) => {
  const { t } = useTranslation(lang);
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = (key: keyof FilterState, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };


  const clearFilters = () => {
    onFiltersChange({
      country: '',
      city: '',
      category: '',
      minScore: 60,
      sort: 'score',
      search: '',
    });
  };

  return (
    <div className="glass rounded-xl overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <span className="font-semibold">{t('filters.title')}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {isOpen ? '▲' : '▼'}
            </span>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 space-y-4 border-t border-border/30">
            {/* Arama */}
            <div className="space-y-2">
              <Label htmlFor="search">{t('filters.search') || 'Ara'}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="search"
                  type="text"
                  placeholder="..."
                  value={filters.search}
                  onChange={(e) => handleChange('search', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Ülke */}
            <div className="space-y-2">
              <Label htmlFor="country">{t('filters.country')}</Label>
              <Select value={filters.country || "all"} onValueChange={(v) => handleChange('country', v === "all" ? "" : v)}>
                <SelectTrigger id="country">
                  <SelectValue placeholder={t('filters.country')} />
                </SelectTrigger>
                <SelectContent className="glass z-50 max-h-[300px]">
                  <SelectItem value="all">Tümü</SelectItem>
                  {countries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Şehir */}
            <div className="space-y-2">
              <Label htmlFor="city">{t('filters.city')}</Label>
              <Input
                id="city"
                type="text"
                placeholder={t('filters.city')}
                value={filters.city}
                onChange={(e) => handleChange('city', e.target.value)}
              />
            </div>

            {/* Kategori */}
            <div className="space-y-2">
              <Label htmlFor="category">{t('filters.category')}</Label>
              <Select value={filters.category || "all"} onValueChange={(v) => handleChange('category', v === "all" ? "" : v)}>
                <SelectTrigger id="category">
                  <SelectValue placeholder={t('filters.category')} />
                </SelectTrigger>
                <SelectContent className="glass z-50">
                  <SelectItem value="all">Tümü</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {getCategoryLabel(cat, lang)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Doğrulama Puanı */}
            <div className="space-y-2">
              <Label htmlFor="score">
                {t('filters.score')}: {filters.minScore}+
              </Label>
              <Slider
                id="score"
                value={[filters.minScore]}
                onValueChange={(v) => handleChange('minScore', v[0])}
                min={0}
                max={100}
                step={10}
                className="py-4"
              />
            </div>

            {/* Sıralama */}
            <div className="space-y-2">
              <Label htmlFor="sort">{t('filters.sort')}</Label>
              <Select value={filters.sort} onValueChange={(v) => handleChange('sort', v)}>
                <SelectTrigger id="sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass z-50">
                  <SelectItem value="score">{t('sort.score')}</SelectItem>
                  <SelectItem value="new">{t('sort.new')}</SelectItem>
                  <SelectItem value="votes">{t('sort.votes')}</SelectItem>
                  <SelectItem value="az">{t('sort.az')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Butonlar */}
            <div className="flex gap-2 pt-2">
              <Button onClick={clearFilters} variant="outline" className="flex-1">
                <X className="w-4 h-4 mr-2" />
                {t('filters.clear')}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};