import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tpraynocoxkbjvoyjzua.supabase.co';
const supabaseAnonKey = 'sb_publishable_1M9183i0HraE0cLug-RBuw_mMIpyIqG';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types
export interface ChatRoom {
  id: string;
  name: string;
  password: string;
  created_at: string;
  created_by: string;
  background_color: string;
  background_pattern: string;
  is_muted: boolean;
}

export interface Message {
  id: string;
  room_id: string;
  user_id: string;
  username: string;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'audio' | 'video';
  file_url?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  reply_to?: string;
  likes: string[];
  dislikes: string[];
  created_at: string;
}

export interface RoomUser {
  id: string;
  room_id: string;
  user_id: string;
  username: string;
  joined_at: string;
}