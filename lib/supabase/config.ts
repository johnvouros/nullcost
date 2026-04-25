export const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || LOCAL_SUPABASE_URL;
}

export function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || requiredEnv('SUPABASE_ANON_KEY');
}

export function getSupabaseServiceRoleKey() {
  return requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
}
