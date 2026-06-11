import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fapjlmixvmxifumeavdg.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhcGpsbWl4dm14aWZ1bWVhdmRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODU2MjcsImV4cCI6MjA5Njc2MTYyN30.yAa5TdghjlMPUa1knzeOXX4DVoC7jN92_DlDjlWsQcM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
