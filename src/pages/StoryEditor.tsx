import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, Send, Volume2, VolumeX, Share2, Download, 
  ChevronLeft, Sparkles, User, History, GitBranch,
  Play, Pause, Loader2, X, Globe, Trash2, Link as LinkIcon, ExternalLink
} from 'lucide-react';
import Markdown from 'react-markdown';
import { io, Socket } from 'socket.io-client';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import { generateStoryNextSegment, generateTTS, getStorySuggestions, translateStory } from '../services/geminiService';
import jsPDF from 'jspdf';
import { SEGMENT_LABELS } from '../constants';

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Chinese", "Japanese", "Korean", "Hindi", "Arabic", "Portuguese", "Italian", "Russian"
];

const TreeBranch = ({ nodes, currentId, onSelect }: { nodes: any[], currentId: string, onSelect: (b: any) => void }) => {
  if (nodes.length === 0) return null;
  
  return (
    <div className="flex gap-16 items-start">
      {nodes.map((node) => (
        <div key={node.id} className="flex items-center">
          <div className="relative flex items-center">
            <div className="flex flex-col items-center">
              <button 
                onClick={() => onSelect(node)}
                className={`px-4 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all z-10 relative whitespace-nowrap flex items-center gap-2 ${currentId === node.id ? 'bg-emerald-500 text-black border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}
              >
                {node.target_branch_id && <LinkIcon className="w-3 h-3" />}
                {node.choice_text.substring(0, 20)}
              </button>
            </div>
            
            {node.children.length > 0 && (
              <>
                <div className="w-16 h-px bg-zinc-800" />
                <div className="flex flex-col gap-8">
                  <TreeBranch nodes={node.children} currentId={currentId} onSelect={onSelect} />
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default function StoryEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [story, setStory] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [currentBranch, setCurrentBranch] = useState<any>(null);
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<{type: string, text: string}[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'branches' | 'history' | 'suggestions'>('timeline');
  const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);
  const [collabEmail, setCollabEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [editedNotes, setEditedNotes] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  
  // Helper to build tree structure
  const buildTree = (items: any[], parentId: string | null = null): any[] => {
    return items
      .filter(item => item.parent_id === parentId)
      .map(item => ({
        ...item,
        children: buildTree(items, item.id)
      }));
  };

  const storyTree = buildTree(branches);
  const [isNarrating, setIsNarrating] = useState(false);
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [cursors, setCursors] = useState<Record<string, { x: number, y: number }>>({});
  
  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { transcript, isListening, startListening, setTranscript } = useSpeechToText();
  const { 
    playAudio, 
    isPlaying, 
    progress, 
    duration,
    volume, 
    setVolume, 
    togglePlayPause, 
    seek,
    stopAudio 
  } = useTextToSpeech();

  useEffect(() => {
    fetchStoryData();
    setupSocket();
    
    const handleMouseMove = (e: MouseEvent) => {
      socketRef.current?.emit('cursor-move', {
        storyId: id,
        username: user?.username,
        cursor: { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight }
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      socketRef.current?.disconnect();
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [id]);

  useEffect(() => {
    if (transcript) {
      setCommand(transcript);
    }
  }, [transcript]);

  useEffect(() => {
    if (currentBranch) {
      fetchSuggestions();
      setEditedContent(currentBranch.content || '');
      setEditedNotes(currentBranch.notes || '');
      
      // Scroll to the segment in the main view
      const element = document.getElementById(`branch-${currentBranch.id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentBranch]);

  const setupSocket = () => {
    socketRef.current = io();
    socketRef.current.emit('join-story', { storyId: id, username: user?.username });
    
    socketRef.current.on('story-updated', (updatedBranch) => {
      setBranches(prev => {
        const exists = prev.find(b => b.id === updatedBranch.id);
        if (exists) {
          return prev.map(b => b.id === updatedBranch.id ? updatedBranch : b);
        }
        return [...prev, updatedBranch];
      });
      setCurrentBranch(updatedBranch);
    });

    socketRef.current.on('branch-deleted', (branchId) => {
      setBranches(prev => {
        const getDescendants = (id: number, list: any[]): number[] => {
          const children = list.filter(b => b.parent_id === id);
          let ids = children.map(c => c.id);
          children.forEach(c => {
            ids = [...ids, ...getDescendants(c.id, list)];
          });
          return ids;
        };
        const idsToRemove = [branchId, ...getDescendants(branchId, prev)];
        return prev.filter(b => !idsToRemove.includes(b.id));
      });
      
      if (currentBranch?.id === branchId) {
        setCurrentBranch(null);
      }
    });

    socketRef.current.on('user-typing', (username) => {
      setTypingUser(username);
      setTimeout(() => setTypingUser(null), 3000);
    });

    socketRef.current.on('collaborators-update', (users) => {
      setCollaborators(users);
    });

    socketRef.current.on('user-cursor-moved', (data) => {
      setCursors(prev => ({ ...prev, [data.username]: data.cursor }));
    });

    socketRef.current.on('content-updated', (data) => {
      if (data.username !== user?.username) {
        if (isEditing) {
          setEditedContent(data.content);
        } else {
          setCommand(data.content);
        }
      }
    });
  };

  const fetchStoryData = async () => {
    if (!id) return;
    try {
      const res = await api.get(`/stories/${id}`);
      if (!res.data.story) {
        navigate('/dashboard');
        return;
      }
      setStory(res.data.story);
      setBranches(res.data.branches);
      const lastBranch = res.data.branches[res.data.branches.length - 1];
      setCurrentBranch(lastBranch);
      setEditedContent(lastBranch?.content || '');
      setEditedNotes(lastBranch?.notes || '');
    } catch (err) {
      console.error(err);
      navigate('/dashboard');
    }
  };

  const fetchSuggestions = async () => {
    if (!currentBranch) return;
    setLoadingSuggestions(true);
    try {
      const sugs = await getStorySuggestions(currentBranch.content, commandHistory[commandHistory.length - 1]);
      setSuggestions(sugs);
      setActiveTab('suggestions');
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleUpdateBranch = async () => {
    if (!currentBranch) return;
    try {
      const res = await api.patch(`/branches/${currentBranch.id}`, {
        content: editedContent,
        notes: editedNotes
      });
      const updated = res.data;
      setBranches(prev => prev.map(b => b.id === updated.id ? updated : b));
      setCurrentBranch(updated);
      setIsEditing(false);
      socketRef.current?.emit('story-update', { storyId: id, branch: updated });
    } catch (err) {
      console.error(err);
      alert("Failed to update branch");
    }
  };

  const handleDeleteBranch = async (branchId: number) => {
    if (!window.confirm("Are you sure you want to delete this segment? This will also delete all subsequent branches from this point.")) return;
    try {
      await api.delete(`/branches/${branchId}`);
      
      setBranches(prev => {
        const getDescendants = (id: number, list: any[]): number[] => {
          const children = list.filter(b => b.parent_id === id);
          let ids = children.map(c => c.id);
          children.forEach(c => {
            ids = [...ids, ...getDescendants(c.id, list)];
          });
          return ids;
        };
        const idsToRemove = [branchId, ...getDescendants(branchId, prev)];
        
        if (currentBranch && idsToRemove.includes(currentBranch.id)) {
          setCurrentBranch(null);
        }
        
        return prev.filter(b => !idsToRemove.includes(b.id));
      });

      socketRef.current?.emit('branch-delete', { storyId: id, branchId });
    } catch (err) {
      console.error(err);
      alert("Failed to delete segment");
    }
  };

  const handleAddEmptyBranch = async () => {
    if (!currentBranch) return;
    try {
      const res = await api.post(`/stories/${id}/branches`, {
        content: "",
        parent_id: currentBranch.id,
        choice_text: "Alternative Path"
      });
      const newBranch = res.data;
      setBranches(prev => [...prev, newBranch]);
      setCurrentBranch(newBranch);
      setIsEditing(true);
      socketRef.current?.emit('story-update', { storyId: id, branch: newBranch });
    } catch (err) {
      console.error(err);
      alert("Failed to create empty branch");
    }
  };

  const handleLinkToBranch = async (targetId: number) => {
    if (!currentBranch) return;
    if (targetId === currentBranch.id) {
      alert("Cannot link a segment to itself.");
      return;
    }
    
    const target = branches.find(b => b.id === targetId);
    if (!target) return;

    try {
      const res = await api.post(`/stories/${id}/branches`, {
        content: "",
        parent_id: currentBranch.id,
        choice_text: `Jump to: ${target.choice_text || 'Segment'}`,
        target_branch_id: targetId
      });
      const newBranch = res.data;
      setBranches(prev => [...prev, newBranch]);
      setCurrentBranch(newBranch);
      setIsLinking(false);
      socketRef.current?.emit('story-update', { storyId: id, branch: newBranch });
    } catch (err) {
      console.error(err);
      alert("Failed to link branch");
    }
  };

  const handleSendCommand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!command.trim() || loading) return;

    setLoading(true);
    const userCmd = command;
    setCommand('');
    setTranscript('');

    try {
      const nextContent = await generateStoryNextSegment(
        currentBranch.content,
        userCmd,
        story.language
      );

      const res = await api.post(`/stories/${id}/branches`, {
        content: nextContent,
        parent_id: currentBranch.id,
        choice_text: userCmd
      });

      const newBranch = res.data;
      setBranches(prev => [...prev, newBranch]);
      setCurrentBranch(newBranch);
      setCommandHistory(prev => [...prev, userCmd]);
      
      socketRef.current?.emit('story-update', { storyId: id, branch: newBranch });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTyping = () => {
    socketRef.current?.emit('typing', { storyId: id, username: user?.username });
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collabEmail) return;
    setIsInviting(true);
    try {
      await api.post(`/stories/${id}/collaborate`, { email: collabEmail });
      setIsCollabModalOpen(false);
      setCollabEmail('');
      alert("Collaborator invited successfully! An invitation email has been sent.");
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to invite collaborator");
    } finally {
      setIsInviting(false);
    }
  };
  const handleNarration = async () => {
    if (!currentBranch || isNarrating) return;
    setIsNarrating(true);
    try {
      const audio = await generateTTS(currentBranch.content);
      if (audio) {
        await playAudio(audio);
      } else {
        alert("Narrator is currently unavailable. Please try again in a moment.");
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred while trying to narrate the story.");
    } finally {
      setIsNarrating(false);
    }
  };

  const handleLanguageChange = async (newLang: string) => {
    if (!story || newLang === story.language || isTranslating) return;
    
    const confirmTranslation = window.confirm(`Do you want to translate the current segment into ${newLang}? This will also update the story's primary language for future chapters.`);
    if (!confirmTranslation) return;

    const wasPlaying = isPlaying;
    setIsTranslating(true);
    try {
      // 1. Update story language in DB
      await api.patch(`/stories/${id}`, { language: newLang });
      
      // 2. Translate current branch content
      const translatedContent = await translateStory(currentBranch.content, newLang);
      
      // 3. Update current branch in DB
      const res = await api.patch(`/branches/${currentBranch.id}`, { content: translatedContent });
      const updated = res.data;
      
      // 4. Update local state
      setStory((prev: any) => ({ ...prev, language: newLang }));
      setBranches(prev => prev.map(b => b.id === updated.id ? updated : b));
      setCurrentBranch(updated);
      
      socketRef.current?.emit('story-update', { storyId: id, branch: updated });

      // If it was playing, restart narration with the new translated content
      if (wasPlaying) {
        stopAudio();
        const audio = await generateTTS(updated.content);
        if (audio) {
          await playAudio(audio);
        }
      }
    } catch (err) {
      console.error(err);
      alert("Failed to translate story.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleCommandChange = (val: string) => {
    setCommand(val);
    socketRef.current?.emit('typing', { storyId: id, username: user?.username });
    socketRef.current?.emit('content-change', { storyId: id, username: user?.username, content: val });
  };

  const handleExport = () => {
    const doc = new jsPDF();
    const label = SEGMENT_LABELS[story.language] || 'Segment';
    
    doc.setFontSize(20);
    doc.text(story.title, 20, 20);
    doc.setFontSize(12);
    let y = 40;
    branches.forEach((b, i) => {
      const text = `${label} ${i + 1}:\n${b.content}\n\n`;
      const splitText = doc.splitTextToSize(text, 170);
      doc.text(splitText, 20, y);
      y += splitText.length * 7;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });
    doc.save(`${story.title}.pdf`);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!story) return null;

  return (
    <div className="h-screen flex flex-col bg-[#050505]">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-800 bg-black/50 backdrop-blur-md z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tighter">{story.title}</h1>
            <div className="flex items-center gap-2 text-xs text-zinc-500 font-bold uppercase tracking-widest">
              <span className="text-emerald-500">{story.genre}</span>
              <span>•</span>
              <div className="relative group/lang">
                <button 
                  disabled={isTranslating}
                  className="flex items-center gap-1 hover:text-white transition-colors disabled:opacity-50"
                >
                  {isTranslating ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Globe className="w-3 h-3" />
                  )}
                  <span>{story.language}</span>
                </button>
                <div className="absolute top-full left-0 mt-2 w-40 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-2 opacity-0 invisible group-hover/lang:opacity-100 group-hover/lang:visible transition-all z-50">
                  <div className="px-4 py-2 border-b border-zinc-800 mb-1">
                    <span className="text-[8px] text-zinc-500 uppercase tracking-widest">Change Language</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {LANGUAGES.map(lang => (
                      <button
                        key={lang}
                        onClick={() => handleLanguageChange(lang)}
                        className={`w-full text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500 hover:text-black transition-colors ${story.language === lang ? 'text-emerald-500' : 'text-zinc-400'}`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex -space-x-2 mr-4">
            {collaborators.filter(c => c !== user?.username).map((c, i) => (
              <div 
                key={i} 
                title={c}
                className="w-8 h-8 rounded-full bg-zinc-800 border-2 border-black flex items-center justify-center text-[10px] font-bold text-emerald-500 uppercase"
              >
                {c.substring(0, 2)}
              </div>
            ))}
            <div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-black flex items-center justify-center text-[10px] font-bold text-black uppercase">
              {user?.username.substring(0, 2)}
            </div>
          </div>
          <button 
            onClick={() => setIsCollabModalOpen(true)} 
            className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
          >
            <Share2 className="w-5 h-5" />
          </button>
          <button 
            onClick={handleExport} 
            className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Editor Area */}
        <main className="flex-1 flex flex-col relative">
          {/* Collaborative Cursors */}
          {Object.entries(cursors).map(([username, pos]) => (
            <motion.div
              key={username}
              className="fixed pointer-events-none z-[100] flex flex-col items-center gap-1"
              animate={{ x: pos.x * window.innerWidth, y: pos.y * window.innerHeight }}
              transition={{ type: 'spring', damping: 30, stiffness: 200 }}
            >
              <div className="w-4 h-4 text-emerald-500">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.653 3.123l13.553 6.777a1.5 1.5 0 010 2.681l-13.553 6.777a1.5 1.5 0 01-2.153-1.34V4.463a1.5 1.5 0 012.153-1.34z" />
                </svg>
              </div>
              <div className="px-2 py-0.5 bg-emerald-500 text-black text-[8px] font-black uppercase tracking-tighter rounded-full shadow-xl">
                {username}
              </div>
            </motion.div>
          ))}

          {typingUser && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-500 uppercase tracking-widest animate-pulse backdrop-blur-md">
              {typingUser} is typing...
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-12 space-y-12">
            <div className="max-w-3xl mx-auto space-y-12 pb-32">
              {isEditing ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-500">Editing Segment</h2>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleUpdateBranch}
                        className="px-4 py-2 bg-emerald-500 text-black text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-emerald-400 transition-all"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                  <textarea 
                    className="w-full h-[500px] bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 text-xl leading-relaxed text-zinc-300 font-serif focus:outline-none focus:border-emerald-500/50 transition-all"
                    value={editedContent}
                    onChange={(e) => {
                      setEditedContent(e.target.value);
                      socketRef.current?.emit('typing', { storyId: id, username: user?.username });
                      socketRef.current?.emit('content-change', { storyId: id, username: user?.username, content: e.target.value });
                    }}
                    placeholder="Write your story segment here..."
                  />
                </motion.div>
              ) : (
                <>
                  {branches.map((branch, i) => (
                    <motion.div 
                      key={branch.id}
                      id={`branch-${branch.id}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`relative group p-8 rounded-[32px] transition-all ${currentBranch?.id === branch.id ? 'bg-emerald-500/5 border border-emerald-500/10' : 'hover:bg-zinc-900/30 border border-transparent'}`}
                      onClick={() => setCurrentBranch(branch)}
                    >
                      {i > 0 && (
                        <div className="absolute -top-8 left-8 flex items-center gap-2 text-xs font-bold text-emerald-500/50 uppercase tracking-widest">
                          <GitBranch className="w-3 h-3" /> {branch.choice_text}
                        </div>
                      )}
                      <div className="prose prose-invert prose-emerald max-w-none">
                        <div className="text-2xl leading-relaxed text-zinc-300 font-serif">
                          {branch.target_branch_id ? (
                            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-emerald-500/20 rounded-[40px] bg-emerald-500/5 group/link">
                              <LinkIcon className="w-12 h-12 text-emerald-500/30 mb-4 group-hover/link:scale-110 transition-transform" />
                              <p className="text-zinc-400 text-center mb-6">This path leads back to an earlier discovery...</p>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const target = branches.find(b => b.id === branch.target_branch_id);
                                  if (target) setCurrentBranch(target);
                                }}
                                className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-black rounded-full font-bold uppercase tracking-widest text-xs hover:bg-emerald-400 transition-all shadow-xl"
                              >
                                <ExternalLink className="w-4 h-4" />
                                Follow the Link
                              </button>
                            </div>
                          ) : (
                            <Markdown>{branch.content}</Markdown>
                          )}
                        </div>
                      </div>
                      
                      {currentBranch?.id === branch.id && (
                        <div className="absolute top-4 right-4 flex gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                            className="p-2 bg-zinc-800/80 rounded-lg text-zinc-400 hover:text-white transition-colors backdrop-blur-sm"
                            title="Edit Segment"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteBranch(branch.id); }}
                            className="p-2 bg-zinc-800/80 rounded-lg text-zinc-400 hover:text-red-500 transition-colors backdrop-blur-sm"
                            title="Delete Segment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </>
              )}
              {!isEditing && (
                <div className="flex justify-center gap-4 pt-12">
                  <button 
                    onClick={handleAddEmptyBranch}
                    className="group flex items-center gap-3 px-8 py-4 bg-zinc-900 border border-zinc-800 rounded-3xl text-zinc-500 hover:text-emerald-500 hover:border-emerald-500/50 transition-all shadow-xl"
                  >
                    <GitBranch className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    <span className="text-xs font-black uppercase tracking-widest">Create Alternative Path</span>
                  </button>
                  <button 
                    onClick={() => {
                      setIsLinking(!isLinking);
                      if (!isLinking) setActiveTab('timeline');
                    }}
                    className={`group flex items-center gap-3 px-8 py-4 border rounded-3xl transition-all shadow-xl ${isLinking ? 'bg-emerald-500 border-emerald-500 text-black' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-emerald-500 hover:border-emerald-500/50'}`}
                  >
                    <LinkIcon className={`w-5 h-5 ${isLinking ? '' : 'group-hover:rotate-12'} transition-transform`} />
                    <span className="text-xs font-black uppercase tracking-widest">
                      {isLinking ? 'Cancel Linking' : 'Link to Existing'}
                    </span>
                  </button>
                </div>
              )}
              <div ref={scrollRef} />
              
              {loading && (
                <div className="flex items-center gap-3 text-emerald-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm font-bold uppercase tracking-widest">AI is weaving the next chapter...</span>
                </div>
              )}
            </div>
          </div>

          {/* Controls Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black via-black/90 to-transparent">
            <div className="max-w-3xl mx-auto space-y-6">
              
              {/* Audio Controls */}
              <AnimatePresence>
                {(isPlaying || progress > 0) && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-3xl backdrop-blur-xl flex items-center gap-6 shadow-2xl"
                  >
                    <button 
                      onClick={togglePlayPause}
                      className="p-3 bg-emerald-500 text-black rounded-full hover:bg-emerald-400 transition-all"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>

                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-500">Narration</span>
                          <span className="opacity-50">•</span>
                          <div className="relative group/lang-audio">
                            <button 
                              disabled={isTranslating}
                              className="flex items-center gap-1 hover:text-white transition-colors disabled:opacity-50"
                            >
                              {isTranslating ? <Loader2 className="w-2 h-2 animate-spin" /> : <Globe className="w-2 h-2" />}
                              <span>{story.language}</span>
                            </button>
                            <div className="absolute bottom-full left-0 mb-2 w-32 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-2 opacity-0 invisible group-hover/lang-audio:opacity-100 group-hover/lang-audio:visible transition-all z-50">
                              <div className="max-h-40 overflow-y-auto">
                                {LANGUAGES.map(lang => (
                                  <button
                                    key={lang}
                                    onClick={() => handleLanguageChange(lang)}
                                    className={`w-full text-left px-3 py-1.5 text-[8px] font-bold uppercase tracking-widest hover:bg-emerald-500 hover:text-black transition-colors ${story.language === lang ? 'text-emerald-500' : 'text-zinc-400'}`}
                                  >
                                    {lang}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                          <span className="opacity-50">•</span>
                          <span>{formatTime((progress / 100) * duration)} / {formatTime(duration)}</span>
                        </div>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        step="0.1"
                        value={isNaN(progress) ? 0 : progress}
                        onChange={(e) => seek(Number(e.target.value))}
                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-transparent transition-all"
                        style={{
                          background: `linear-gradient(to right, #10b981 ${progress}%, #27272a ${progress}%)`
                        }}
                      />
                    </div>

                    <div className="flex items-center gap-3 min-w-[140px] bg-black/20 p-2 rounded-2xl border border-zinc-800/50">
                      <button 
                        onClick={() => setVolume(volume === 0 ? 1 : 0)}
                        className="p-1 hover:bg-zinc-800 rounded-lg transition-colors"
                      >
                        {volume === 0 ? <VolumeX className="w-4 h-4 text-zinc-500" /> : <Volume2 className="w-4 h-4 text-emerald-500" />}
                      </button>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.01"
                        value={isNaN(volume) ? 1 : volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-transparent"
                        style={{
                          background: `linear-gradient(to right, #10b981 ${volume * 100}%, #27272a ${volume * 100}%)`
                        }}
                      />
                    </div>

                    <button 
                      onClick={stopAudio}
                      className="p-2 text-zinc-500 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input Bar */}
              <div className="relative group">
                <div className="absolute inset-0 bg-emerald-500/10 blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <form 
                  onSubmit={handleSendCommand}
                  className="relative flex items-center gap-4 bg-zinc-900/80 border border-zinc-800 p-2 rounded-[32px] backdrop-blur-xl shadow-2xl"
                >
                  <button 
                    type="button"
                    onClick={startListening}
                    className={`p-4 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                  >
                    <Mic className="w-6 h-6" />
                  </button>
                  <input 
                    ref={inputRef}
                    type="text" 
                    placeholder={isListening ? "Listening..." : "What happens next? Speak or type..."}
                    value={command}
                    onChange={(e) => handleCommandChange(e.target.value)}
                    className="flex-1 bg-transparent border-none focus:outline-none text-lg py-2"
                  />
                  <button 
                    type="button"
                    onClick={handleNarration}
                    disabled={isNarrating}
                    className={`p-4 rounded-full transition-all ${isNarrating ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                  >
                    {isNarrating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Volume2 className="w-6 h-6" />}
                  </button>
                  <button 
                    type="submit"
                    disabled={!command.trim() || loading}
                    className="p-4 bg-white text-black rounded-full hover:bg-emerald-400 transition-all disabled:opacity-50"
                  >
                    <Send className="w-6 h-6" />
                  </button>
                </form>
              </div>

              {typingUser && (
                <div className="text-xs text-zinc-500 italic ml-4">
                  {typingUser} is typing...
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Sidebar Panel */}
        <aside className="w-96 border-l border-zinc-800 bg-zinc-900/20 flex flex-col">
          <div className="flex border-b border-zinc-800">
            {[
              { id: 'timeline', icon: History, label: 'Timeline' },
              { id: 'branches', icon: GitBranch, label: 'Map' },
              { id: 'history', icon: Mic, label: 'Voice' },
              { id: 'suggestions', icon: Sparkles, label: 'Ideas' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors ${activeTab === tab.id ? 'text-emerald-500 bg-emerald-500/5' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">{tab.label}</span>
              </button>
            ))}
            <button 
              onClick={handleAddEmptyBranch}
              title="Add Empty Branch"
              className="px-4 text-emerald-500 hover:bg-emerald-500/5 transition-colors border-l border-zinc-800"
            >
              <GitBranch className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {activeTab === 'timeline' && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                  <History className="w-4 h-4" /> {isLinking ? 'Select Target Segment' : 'Story Timeline'}
                </h3>
                {isLinking && (
                  <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                    <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest leading-relaxed">
                      Select a segment from the timeline below to create a link from your current position.
                    </p>
                  </div>
                )}
                <div className="space-y-4">
                  {branches.map((b, i) => (
                    <div 
                      key={b.id} 
                      onClick={() => !isLinking && setCurrentBranch(b)}
                      className={`group/timeline p-4 rounded-2xl border transition-all relative ${isLinking ? 'border-zinc-800 hover:border-emerald-500/50 cursor-default' : 'cursor-pointer'} ${currentBranch?.id === b.id ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}`}
                    >
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Segment {i + 1}</div>
                      <div className="text-sm line-clamp-2 text-zinc-300">{b.choice_text}</div>
                      
                      {isLinking ? (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLinkToBranch(b.id);
                          }}
                          className="absolute top-1/2 -translate-y-1/2 right-4 px-4 py-2 bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-400 transition-all shadow-lg"
                        >
                          Select
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBranch(b.id);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-zinc-800/50 rounded-lg text-zinc-500 hover:text-red-500 transition-all"
                          title="Delete Segment"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'branches' && (
              <div className="h-full flex flex-col">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                  <GitBranch className="w-4 h-4" /> Story Branch Map
                </h3>
                <div className="flex-1 relative bg-black/40 rounded-3xl border border-zinc-800 p-4 overflow-auto">
                  <div className="min-w-max">
                    <TreeBranch 
                      nodes={storyTree} 
                      currentId={currentBranch?.id} 
                      onSelect={(b) => setCurrentBranch(b)} 
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                  <Mic className="w-4 h-4" /> Voice History
                </h3>
                <div className="space-y-3">
                  {commandHistory.map((cmd, i) => (
                    <div 
                      key={i}
                      className="group p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl hover:border-emerald-500/30 transition-all"
                    >
                      <div className="text-sm text-zinc-300 mb-3">"{cmd}"</div>
                      <button 
                        onClick={() => { setCommand(cmd); handleSendCommand(); }}
                        className="text-[10px] font-black uppercase tracking-widest text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" /> Replay Command
                      </button>
                    </div>
                  ))}
                  {commandHistory.length === 0 && (
                    <div className="text-center py-12 text-zinc-600 text-xs italic">
                      No voice commands used yet
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'suggestions' && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Narrative Ideas
                </h3>
                <div className="space-y-3">
                  {suggestions.map((s, i) => (
                    <button 
                      key={i}
                      onClick={() => { setCommand(s.text); handleSendCommand(); }}
                      className={`w-full text-left group p-4 bg-zinc-900/50 border rounded-2xl transition-all ${
                        s.type === 'dialogue' ? 'border-blue-500/20 hover:border-blue-500/50' :
                        s.type === 'description' ? 'border-purple-500/20 hover:border-purple-500/50' :
                        s.type === 'twist' ? 'border-orange-500/20 hover:border-orange-500/50' :
                        'border-zinc-800 hover:border-emerald-500/30'
                      }`}
                    >
                      <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${
                        s.type === 'dialogue' ? 'text-blue-400' :
                        s.type === 'description' ? 'text-purple-400' :
                        s.type === 'twist' ? 'text-orange-400' :
                        'text-emerald-500'
                      }`}>{s.type}</div>
                      <div className="text-sm text-zinc-300 group-hover:text-white transition-colors">{s.text}</div>
                    </button>
                  ))}
                  {suggestions.length === 0 && (
                    <div className="text-center py-12 text-zinc-600 text-xs italic">
                      Click "Request Plot Twist" below to get ideas
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-zinc-800 bg-black/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-emerald-500 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> AI Insight
              </h3>
              {isEditing && (
                <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest animate-pulse">Drafting...</span>
              )}
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              The story is currently in an <b>{story.tone}</b> tone. Need a spark of inspiration?
            </p>
            <button 
              onClick={fetchSuggestions}
              disabled={loadingSuggestions}
              className="w-full py-2.5 bg-emerald-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mb-6"
            >
              {loadingSuggestions ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Request Plot Twist
            </button>

            <div className="pt-6 border-t border-zinc-800/50">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Private Notes</h3>
              <textarea 
                className="w-full h-32 bg-zinc-900/30 border border-zinc-800 rounded-2xl p-4 text-xs text-zinc-400 focus:outline-none focus:border-emerald-500/30 transition-all resize-none"
                placeholder="Jot down ideas for this branch..."
                value={isEditing ? editedNotes : (currentBranch?.notes || '')}
                onChange={(e) => {
                  setEditedNotes(e.target.value);
                  if (!isEditing) setIsEditing(true);
                }}
              />
            </div>
          </div>
        </aside>
      </div>
      {/* Collaborate Modal */}
      <AnimatePresence>
        {isCollabModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-[40px] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="text-2xl font-black tracking-tighter">Collaborate</h2>
                <button onClick={() => setIsCollabModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleInvite} className="p-8 space-y-6">
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Invite other storytellers to join. <span className="text-emerald-500 font-bold">Important:</span> They must already have a registered VoxNarrative account with this email.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Collaborator Email</label>
                  <input 
                    type="email" 
                    required
                    placeholder="storyteller@example.com"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 focus:outline-none focus:border-emerald-500 transition-colors"
                    value={collabEmail}
                    onChange={(e) => setCollabEmail(e.target.value)}
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isInviting || !collabEmail}
                  className="w-full py-4 bg-emerald-500 text-black rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-500/10"
                >
                  {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                  {isInviting ? 'Sending Invite...' : 'Send Invitation'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
