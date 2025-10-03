import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const SESSION_KEY = 'analytics_session_id';

export const useAnalytics = () => {
  const { isAdmin, user } = useAuth();
  const sessionId = useRef<string | null>(null);
  const [currentIP, setCurrentIP] = useState<string | null>(null);
  const [ignoredIPs, setIgnoredIPs] = useState<string[]>([]);

  useEffect(() => {
    // Initialize or get existing session
    let existingSession = localStorage.getItem(SESSION_KEY);
    
    if (!existingSession) {
      existingSession = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, existingSession);
    }
    
    sessionId.current = existingSession;

    // Fetch client IP
    const fetchClientIP = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-client-ip');
        if (!error && data?.ip) {
          setCurrentIP(data.ip);
        }
      } catch (error) {
        console.error('Failed to fetch client IP:', error);
      }
    };

    // Fetch ignored IPs list
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

    fetchClientIP();
    fetchIgnoredIPs();

    // Create or update session record
    if (!isAdmin) {
      supabase
        .from('analytics_sessions')
        .upsert({
          session_id: existingSession,
          user_id: user?.id || null,
          is_admin: false,
          last_activity_at: new Date().toISOString(),
        })
        .then();
    }
  }, [isAdmin, user]);

  const shouldTrack = () => {
    if (isAdmin) return false;
    if (!sessionId.current) return false;
    if (currentIP && ignoredIPs.includes(currentIP)) return false;
    return true;
  };

  const trackPageView = async (path: string) => {
    if (!shouldTrack()) return;

    try {
      await supabase.from('page_views').insert({
        page_path: path,
        session_id: sessionId.current!,
        user_id: user?.id || null,
        user_agent: navigator.userAgent,
        referrer: document.referrer || null,
      });

      // Update session activity
      const { data: sessionData } = await supabase
        .from('analytics_sessions')
        .select('page_count')
        .eq('session_id', sessionId.current!)
        .single();

      if (sessionData) {
        await supabase
          .from('analytics_sessions')
          .update({
            last_activity_at: new Date().toISOString(),
            page_count: (sessionData.page_count || 0) + 1,
          })
          .eq('session_id', sessionId.current!);
      }
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  };

  const trackPlaceView = async (placeId: string) => {
    if (!shouldTrack()) return;

    try {
      await supabase.from('place_interactions').insert({
        place_id: placeId,
        interaction_type: 'view',
        session_id: sessionId.current!,
        user_id: user?.id || null,
      });
    } catch (error) {
      console.error('Place view tracking error:', error);
    }
  };

  const trackPlaceVote = async (placeId: string, voteType: 'up' | 'down') => {
    if (!shouldTrack()) return;

    try {
      await supabase.from('place_interactions').insert({
        place_id: placeId,
        interaction_type: voteType === 'up' ? 'vote_up' : 'vote_down',
        session_id: sessionId.current!,
        user_id: user?.id || null,
      });
    } catch (error) {
      console.error('Vote tracking error:', error);
    }
  };

  const trackComment = async (placeId: string) => {
    if (!shouldTrack()) return;

    try {
      await supabase.from('place_interactions').insert({
        place_id: placeId,
        interaction_type: 'comment',
        session_id: sessionId.current!,
        user_id: user?.id || null,
      });
    } catch (error) {
      console.error('Comment tracking error:', error);
    }
  };

  const trackSearch = async (queryText: string, filters: any, resultCount: number) => {
    if (!shouldTrack()) return;

    try {
      await supabase.from('search_queries').insert({
        query_text: queryText || null,
        filters_json: filters,
        result_count: resultCount,
        session_id: sessionId.current!,
        user_id: user?.id || null,
      });
    } catch (error) {
      console.error('Search tracking error:', error);
    }
  };

  return {
    trackPageView,
    trackPlaceView,
    trackPlaceVote,
    trackComment,
    trackSearch,
  };
};
