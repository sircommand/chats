'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Moon, 
  Sun, 
  Copy, 
  Lock, 
  Users,
  MessageSquare
} from 'lucide-react';
import { useTheme } from 'next-themes';
import toast from 'react-hot-toast';
import { supabase, ChatRoom } from '@/lib/supabase';

export default function HomePage() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<ChatRoom[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState<ChatRoom | null>(null);
  const [newRoom, setNewRoom] = useState({ name: '', password: '' });
  const [joinData, setJoinData] = useState({ password: '', username: '' });
  const [loading, setLoading] = useState(true);
  
  const { theme, setTheme } = useTheme();
  const newRoomNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchRooms();
    
    // Subscribe to new rooms
    const roomSubscription = supabase
      .channel('rooms')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'rooms' }, 
        () => {
          fetchRooms();
        }
      )
      .subscribe();

    return () => {
      roomSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const filtered = rooms.filter(room =>
      room.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredRooms(filtered);
  }, [searchQuery, rooms]);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('خطا در دریافت لیست اتاق‌ها');
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async () => {
    if (!newRoom.name.trim()) {
      toast.error('لطفا نام اتاق را وارد کنید');
      return;
    }

    if (!newRoom.password.trim()) {
      toast.error('لطفا رمز عبور اتاق را وارد کنید');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('rooms')
        .insert([
          {
            name: newRoom.name,
            password: newRoom.password,
            background_color: '#ffffff',
            background_pattern: 'none',
            is_muted: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      toast.success('اتاق با موفقیت ایجاد شد');
      setShowCreateModal(false);
      setNewRoom({ name: '', password: '' });
      fetchRooms();
    } catch (error) {
      console.error('Error creating room:', error);
      toast.error('خطا در ایجاد اتاق');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showCreateModal) createRoom();
    }
  };

  const joinRoom = async (room: ChatRoom) => {
    if (!joinData.username.trim()) {
      toast.error('لطفا نام مستعار خود را وارد کنید');
      return;
    }

    if (joinData.password !== room.password) {
      toast.error('رمز عبور اشتباه است');
      return;
    }

    // Save user info to localStorage
    localStorage.setItem(`room_${room.id}_username`, joinData.username);
    localStorage.setItem(`room_${room.id}_userId`, Date.now().toString());

    // Redirect to chat room
    window.location.href = `/room/${room.id}`;
  };

  const copyRoomLink = (roomId: string) => {
    const link = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(link);
    toast.success('لینک اتاق کپی شد');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      {/* Header */}
      <header className="max-w-6xl mx-auto mb-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3 space-x-reverse">
            <MessageSquare className="w-8 h-8 text-blue-500" />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
              چت روم آنلاین
            </h1>
          </div>
          
          <div className="flex items-center space-x-3 space-x-reverse">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 space-x-reverse px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>اتاق جدید</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        {/* Search Bar */}
        <div className="relative mb-8">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="جستجوی اتاق..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-4 pr-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Rooms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 rounded-xl p-6 animate-pulse"
              >
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
              </div>
            ))
          ) : filteredRooms.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Users className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                اتاقی یافت نشد
              </p>
            </div>
          ) : (
            filteredRooms.map((room) => (
              <div
                key={room.id}
                className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
                      {room.name}
                    </h3>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <Lock className="w-3 h-3 ml-1" />
                      <span>اتاق خصوصی</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => copyRoomLink(room.id)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="کپی لینک اتاق"
                  >
                    <Copy className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <button
                  onClick={() => setShowJoinModal(room)}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg transition-all transform hover:-translate-y-0.5"
                >
                  ورود به اتاق
                </button>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
              ایجاد اتاق جدید
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  نام اتاق
                </label>
                <input
                  ref={newRoomNameRef}
                  type="text"
                  value={newRoom.name}
                  onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                  onKeyPress={handleKeyPress}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="مثلاً: اتاق دوستان"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  رمز عبور اتاق
                </label>
                <input
                  type="password"
                  value={newRoom.password}
                  onChange={(e) => setNewRoom({ ...newRoom, password: e.target.value })}
                  onKeyPress={handleKeyPress}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="رمز عبور دلخواه"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 space-x-reverse mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                انصراف
              </button>
              <button
                onClick={createRoom}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                ایجاد اتاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Room Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
              ورود به اتاق: {showJoinModal.name}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              لطفاً اطلاعات زیر را وارد کنید
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  نام مستعار شما
                </label>
                <input
                  type="text"
                  value={joinData.username}
                  onChange={(e) => setJoinData({ ...joinData, username: e.target.value })}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="نامی که دیگران ببینند"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  رمز عبور اتاق
                </label>
                <input
                  type="password"
                  value={joinData.password}
                  onChange={(e) => setJoinData({ ...joinData, password: e.target.value })}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="رمز عبور اتاق"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 space-x-reverse mt-6">
              <button
                onClick={() => {
                  setShowJoinModal(null);
                  setJoinData({ password: '', username: '' });
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                انصراف
              </button>
              <button
                onClick={() => joinRoom(showJoinModal)}
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg transition-colors"
              >
                ورود به چت
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}