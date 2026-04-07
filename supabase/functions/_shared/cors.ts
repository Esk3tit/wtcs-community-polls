export const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? 'https://polls.wtcsmapvote.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
