export interface Place {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  country_code: string;
  city: string | null;
  lat: number | null;
  lon: number | null;
  wikidata_id: string | null;
  osm_id: string | null;
  evidence_score: number;
  status: 'pending' | 'pending_high' | 'approved' | 'rejected';
  ai_collected: number;
  human_approved: number;
  votes_up: number;
  votes_down: number;
  rating_sum: number;
  rating_count: number;
  sources_json: Source[];
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface Source {
  url: string;
  domain: string;
  type: string;
  first_seen?: string;
  last_seen?: string;
}

export interface Comment {
  id: string;
  place_id: string;
  nickname: string;
  message: string;
  created_at: string;
}

export interface Country {
  code: string;
  name: string;
}