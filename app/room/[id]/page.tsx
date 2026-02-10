'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Send, 
  Mic, 
  Image as ImageIcon, 
  Paperclip, 
  Video, 
  Music,
  X,
  Download,
  Play,
  Pause,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Trash2,
  Volume2,
  VolumeX,
  ArrowRight,
  Palette,
  Image as PatternIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase, Message, ChatRoom } from '@/lib/supabase';
import { format } from 'date-fns';
import { fa } from 'date-fns/locale';

export default function ChatRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  
  // Background patterns
  const patterns = [
    { id: 'none', name: 'بدون پترن' },
    { id: 'grid', name: 'گرید' },
    { id: 'dots', name: 'نقطه‌ها' },
    { id: 'waves', name: 'موج' },
    { id: 'diagonal', name: 'مورب' },
  ];
  
  const colors = [
    '#ef4444', // قرمز
    '#3b82f6', // آبی
    '#10b981', // سبز
    '#f59e0b', // زرد
    '#8b5cf6', // بنفش
  ];

  useEffect(() => {
    const storedUsername = localStorage.getItem(`room_${roomId}_username`);
    const storedUserId = localStorage.getItem(`room_${roomId}_userId`);
    
    if (!storedUsername || !storedUserId) {
      router.push('/');
      return;
    }
    
    setUsername(storedUsername);
    setUserId(storedUserId);
    
    fetchRoom();
    fetchMessages();
    
    // Subscribe to new messages
    const messageSubscription = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `room_id=eq.${roomId}`
        }, 
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages(prev => [...prev, newMessage]);
          
          // Play sound if not muted
          if (!isMuted) {
            playNotificationSound();
          }
        }
      )
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          setMessages(prev => 
            prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
          );
        }
      )
      .on('postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          const deletedMessage = payload.old as Message;
          setMessages(prev => prev.filter(msg => msg.id !== deletedMessage.id));
        }
      )
      .subscribe();

    // Subscribe to room updates
    const roomSubscription = supabase
      .channel(`room-settings-${roomId}`)
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`
        },
        (payload) => {
          setRoom(payload.new as ChatRoom);
        }
      )
      .subscribe();

    return () => {
      messageSubscription.unsubscribe();
      roomSubscription.unsubscribe();
    };
  }, [roomId, router, isMuted]);

  const playNotificationSound = () => {
    const audio = new Audio('/notification.mp3');
    audio.play().catch(console.error);
  };

  const fetchRoom = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (error) throw error;
      setRoom(data);
      setIsMuted(data.is_muted);
    } catch (error) {
      console.error('Error fetching room:', error);
      toast.error('اتاق یافت نشد');
      router.push('/');
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async (type: 'text' | 'image' | 'file' | 'audio' | 'video' = 'text', fileUrl?: string, fileName?: string, fileType?: string, fileSize?: number) => {
    if (!newMessage.trim() && type === 'text' && !fileUrl) return;

    try {
      const messageData: any = {
        room_id: roomId,
        user_id: userId,
        username,
        content: newMessage,
        message_type: type,
        likes: [],
        dislikes: [],
      };

      if (fileUrl) {
        messageData.file_url = fileUrl;
        messageData.file_name = fileName;
        messageData.file_type = fileType;
        messageData.file_size = fileSize;
      }

      if (replyingTo) {
        messageData.reply_to = replyingTo.id;
      }

      const { error } = await supabase
        .from('messages')
        .insert([messageData]);

      if (error) throw error;

      setNewMessage('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('خطا در ارسال پیام');
    }
  };

  const handleFileUpload = async (file: File, type: 'image' | 'file' | 'audio' | 'video') => {
    setUploading(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${roomId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-files')
        .getPublicUrl(filePath);

      await sendMessage(type, publicUrl, file.name, file.type, file.size);
      
      toast.success('فایل با موفقیت ارسال شد');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('خطا در آپلود فایل');
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
        await handleFileUpload(audioFile, 'audio');
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('خطا در دسترسی به میکروفون');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const handleLike = async (messageId: string) => {
    try {
      const message = messages.find(m => m.id === messageId);
      if (!message) return;

      const hasLiked = message.likes.includes(userId);
      const hasDisliked = message.dislikes.includes(userId);

      const newLikes = hasLiked 
        ? message.likes.filter(id => id !== userId)
        : [...message.likes, userId];

      const newDislikes = hasDisliked
        ? message.dislikes.filter(id => id !== userId)
        : message.dislikes;

      if (hasLiked && !hasDisliked) {
        newDislikes.push(userId);
      }

      const { error } = await supabase
        .from('messages')
        .update({
          likes: newLikes,
          dislikes: newDislikes,
        })
        .eq('id', messageId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating like:', error);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm('آیا از حذف این پیام اطمینان دارید؟')) return;

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
      toast.success('پیام حذف شد');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('خطا در حذف پیام');
    }
  };

  const updateRoomSetting = async (setting: 'background_color' | 'background_pattern' | 'is_muted', value: any) => {
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ [setting]: value })
        .eq('id', roomId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating room setting:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getPatternClass = (pattern: string) => {
    switch (pattern) {
      case 'grid':
        return 'bg-grid-pattern';
      case 'dots':
        return 'bg-dots-pattern';
      case 'waves':
        return 'bg-waves-pattern';
      case 'diagonal':
        return 'bg-diagonal-pattern';
      default:
        return '';
    }
  };

  const renderMessageContent = (message: Message) => {
    switch (message.message_type) {
      case 'image':
        return (
          <div className="mt-2">
            <img
              src={message.file_url}
              alt={message.file_name}
              className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(message.file_url, '_blank')}
            />
          </div>
        );
      
      case 'audio':
        return (
          <div className="mt-2">
            <audio controls className="w-full">
              <source src={message.file_url} type={message.file_type} />
              مرورگر شما از پخش صدا پشتیبانی نمی‌کند
            </audio>
          </div>
        );
      
      case 'video':
        return (
          <div className="mt-2">
            <video controls className="max-w-full max-h-64 rounded-lg">
              <source src={message.file_url} type={message.file_type} />
              مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند
            </video>
          </div>
        );
      
      case 'file':
        return (
          <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 space-x-reverse">
                <Paperclip className="w-4 h-4" />
                <span className="text-sm truncate">{message.file_name}</span>
              </div>
              <a
                href={message.file_url}
                download
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {(message.file_size! / 1024).toFixed(2)} KB
            </div>
          </div>
        );
      
      default:
        return (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        );
    }
  };

  if (!room) return <div className="min-h-screen flex items-center justify-center">در حال بارگذاری...</div>;

  return (
    <div 
      className="min-h-screen transition-colors duration-300"
      style={{ backgroundColor: room.background_color }}
    >
      <div className={`min-h-screen bg-black bg-opacity-10 ${getPatternClass(room.background_pattern)}`}>
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 bg-opacity-90 backdrop-blur-sm shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 space-x-reverse">
                <button
                  onClick={() => router.push('/')}
                  className="flex items-center space-x-1 space-x-reverse text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
                >
                  <ArrowRight className="w-5 h-5 rotate-180" />
                  <span>بازگشت</span>
                </button>
                
                <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
                
                <h1 className="text-xl font-bold text-gray-800 dark:text-white">
                  {room.name}
                </h1>
              </div>
              
              <div className="flex items-center space-x-3 space-x-reverse">
                {/* Color Picker */}
                <div className="dropdown dropdown-bottom dropdown-end">
                  <label tabIndex={0} className="btn btn-sm btn-ghost">
                    <Palette className="w-5 h-5" />
                  </label>
                  <div tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52">
                    <div className="grid grid-cols-5 gap-2">
                      {colors.map((color) => (
                        <button
                          key={color}
                          onClick={() => updateRoomSetting('background_color', color)}
                          className="w-8 h-8 rounded-full border-2 border-gray-300"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Pattern Picker */}
                <div className="dropdown dropdown-bottom dropdown-end">
                  <label tabIndex={0} className="btn btn-sm btn-ghost">
                    <PatternIcon className="w-5 h-5" />
                  </label>
                  <div tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52">
                    {patterns.map((pattern) => (
                      <button
                        key={pattern.id}
                        onClick={() => updateRoomSetting('background_pattern', pattern.id)}
                        className={`btn btn-sm btn-ghost justify-start ${room.background_pattern === pattern.id ? 'btn-active' : ''}`}
                      >
                        {pattern.name}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Mute/Unmute */}
                <button
                  onClick={() => {
                    setIsMuted(!isMuted);
                    updateRoomSetting('is_muted', !isMuted);
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Chat Messages */}
        <main className="max-w-7xl mx-auto px-4 py-6 h-[calc(100vh-200px)] overflow-y-auto">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`animate-fadeIn ${message.user_id === userId ? 'text-left' : 'text-right'}`}
              >
                {/* Reply Preview */}
                {message.reply_to && (
                  <div className="mb-2 mr-12 opacity-75 border-r-2 border-blue-500 pr-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      در پاسخ به {messages.find(m => m.id === message.reply_to)?.username}
                    </div>
                    <div className="text-sm truncate">
                      {messages.find(m => m.id === message.reply_to)?.content}
                    </div>
                  </div>
                )}

                <div className={`flex ${message.user_id === userId ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                      {message.username.charAt(0).toUpperCase()}
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className={`mx-3 max-w-xl ${message.user_id === userId ? 'text-right' : 'text-left'}`}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-gray-800 dark:text-white">
                          {message.username}
                          {message.user_id === userId && ' (شما)'}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {format(new Date(message.created_at), 'HH:mm', { locale: fa })}
                        </span>
                      </div>
                      
                      {renderMessageContent(message)}
                      
                      {/* Message Actions */}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center space-x-3 space-x-reverse">
                          <button
                            onClick={() => handleLike(message.id)}
                            className={`flex items-center space-x-1 space-x-reverse text-sm ${
                              message.likes.includes(userId)
                                ? 'text-blue-500'
                                : 'text-gray-500 hover:text-blue-500'
                            }`}
                          >
                            <ThumbsUp className="w-4 h-4" />
                            <span>{message.likes.length}</span>
                          </button>
                          
                          <button
                            onClick={() => handleLike(message.id)}
                            className={`flex items-center space-x-1 space-x-reverse text-sm ${
                              message.dislikes.includes(userId)
                                ? 'text-red-500'
                                : 'text-gray-500 hover:text-red-500'
                            }`}
                          >
                            <ThumbsDown className="w-4 h-4" />
                            <span>{message.dislikes.length}</span>
                          </button>
                          
                          <button
                            onClick={() => setReplyingTo(message)}
                            className="text-gray-500 hover:text-blue-500 text-sm"
                          >
                            پاسخ
                          </button>
                          
                          {message.file_url && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(message.file_url!);
                                toast.success('لینک کپی شد');
                              }}
                              className="text-gray-500 hover:text-green-500"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        
                        {(message.user_id === userId) && (
                          <button
                            onClick={() => handleDelete(message.id)}
                            className="text-gray-500 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Reply Preview */}
        {replyingTo && (
          <div className="max-w-7xl mx-auto px-4 py-2 bg-white dark:bg-gray-800 bg-opacity-90">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 space-x-reverse">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  در حال پاسخ به {replyingTo.username}:
                </span>
                <span className="text-sm truncate">{replyingTo.content}</span>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Message Input */}
        <footer className="max-w-7xl mx-auto px-4 py-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center space-x-3 space-x-reverse mb-3">
              {/* File Upload Buttons */}
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'file')}
              />
              <input
                type="file"
                ref={imageInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'image')}
              />
              <input
                type="file"
                ref={videoInputRef}
                className="hidden"
                accept="video/*"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'video')}
              />
              <input
                type="file"
                ref={audioInputRef}
                className="hidden"
                accept="audio/*"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'audio')}
              />
              
              <button
                onClick={() => imageInputRef.current?.click()}
                disabled={uploading}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => videoInputRef.current?.click()}
                disabled={uploading}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <Video className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => audioInputRef.current?.click()}
                disabled={uploading}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <Music className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              
              {/* Voice Recording */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={uploading}
                className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Mic className="w-5 h-5" />
              </button>
              
              {isRecording && (
                <div className="flex items-center space-x-2 space-x-reverse">
                  <div className="voice-waveform w-20 h-2 rounded-full"></div>
                  <span className="text-sm text-red-500">در حال ضبط...</span>
                </div>
              )}
            </div>
            
            <div className="flex items-end space-x-3 space-x-reverse">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="پیام خود را بنویسید (Shift+Enter برای خط جدید)..."
                className="flex-1 p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                rows={1}
                style={{ minHeight: '44px', maxHeight: '120px' }}
              />
              
              <button
                onClick={() => sendMessage()}
                disabled={!newMessage.trim() || uploading}
                className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-left">
              برای ارسال: Enter | برای خط جدید: Shift+Enter
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}