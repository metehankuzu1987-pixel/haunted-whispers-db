-- Schedule cron job to run AI scan every 2 hours
SELECT cron.schedule(
  'ai-scan-every-2-hours',
  '0 */2 * * *', -- At minute 0 of every 2nd hour
  $$
  SELECT
    net.http_post(
      url:='https://cgtlmnvwvhktopxavjan.supabase.co/functions/v1/ai-scan',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndGxtbnZ3dmhrdG9weGF2amFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNjg3MDMsImV4cCI6MjA3NDk0NDcwM30.WUt3C5x93sxAVeu5jAWpZV_AaWzslUCOhAIRp-MpThE"}'::jsonb,
      body:='{"auto": true}'::jsonb
    ) as request_id;
  $$
);