import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const SESSION_KEY = 'analytics_session_id';

export const useAnalytics = () => {
  const { isAdmin, user } = useAuth();
  const sessionId = useRef<string | null>(null);

  useEffect(() => {
    // Initialize or get existing session
    let existingSession = localStorage.getItem(SESSION_KEY);
    
    if (!existingSession) {
      existingSession = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, existingSession);
    }
    
    sessionId.current = existingSession;

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
    return !isAdmin && sessionId.current;
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
