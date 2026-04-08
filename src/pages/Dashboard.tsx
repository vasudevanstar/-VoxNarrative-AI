import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Book, Clock, Users, User, LogOut, ChevronRight, Sparkles, X, Mail, Loader2, Share2, Download, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { generateInitialStory } from '../services/geminiService';
import jsPDF from 'jspdf';
import { SEGMENT_LABELS } from '../constants';

export default function Dashboard() {
  const [stories, setStories] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<'my' | 'shared' | 'activity'>('my');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);
  const [selectedStoryId, setSelectedStoryId] = useState<number | null>(null);
  const [collabEmail, setCollabEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [newStory, setNewStory] = useState({
    title: '',
    genre: 'Fantasy',
    language: 'English',
    characters: '',
    tone: 'Epic',
    setting: 'Ancient Forest'
  });
  const [loading, setLoading] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchStories();
    fetchActivity();
  }, []);

  const fetchStories = async () => {
    try {
      const res = await api.get('/stories');
      setStories(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchActivity = async () => {
    try {
      const res = await api.get('/activity');
      setActivity(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateStory = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Create story in DB
      const res = await api.post('/stories', newStory);
      const storyId = res.data.id;

      // 2. Generate initial segment with Gemini
      let initialContent = await generateInitialStory(newStory);
      if (!initialContent) {
        initialContent = "The journey begins in silence, waiting for your first word to break the stillness of the world...";
      }

      // 3. Save initial branch
      await api.post(`/stories/${storyId}/branches`, {
        content: initialContent,
        parent_id: null,
        choice_text: 'The Beginning'
      });

      navigate(`/story/${storyId}`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestEmail = async () => {
    if (!user?.email) {
      alert('Your user profile is missing an email address. Please try logging out and logging back in.');
      return;
    }
    setIsTestingEmail(true);
    try {
      await api.post('/send-message', {
        to: user.email,
        subject: 'VoxNarrative: SMTP Test Successful',
        message: `Hello ${user.username}! This is a test email from your VoxNarrative application. Your SMTP settings are working correctly.`
      });
      alert('Test email sent successfully! Please check your inbox (and spam folder).');
    } catch (err: any) {
      console.error(err);
      const errorMsg = err.response?.data?.error || 'Failed to send test email.';
      const details = err.response?.data?.details;
      alert(`${errorMsg}${details ? ` (Missing: ${Object.entries(details).filter(([_, v]) => !v).map(([k]) => k).join(', ')})` : ''} Please check your Secrets configuration.`);
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleExport = async (story: any) => {
    try {
      const res = await api.get(`/stories/${story.id}`);
      const { branches } = res.data;
      const doc = new jsPDF();
      const label = SEGMENT_LABELS[story.language] || 'Segment';
      
      doc.setFontSize(20);
      doc.text(story.title, 20, 20);
      doc.setFontSize(12);
      let y = 40;
      branches.forEach((b: any, i: number) => {
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
    } catch (err) {
      console.error(err);
      alert("Failed to export story");
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collabEmail || !selectedStoryId) return;
    setIsInviting(true);
    try {
      await api.post(`/stories/${selectedStoryId}/collaborate`, { email: collabEmail });
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

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-72 bg-zinc-900/50 border-r border-zinc-800 p-8 flex flex-col">
        <div className="flex items-center gap-2 mb-12">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Sparkles className="text-black w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-tighter">VoxNarrative</span>
        </div>

        <nav className="space-y-2 flex-1">
          <button 
            onClick={() => setActiveView('my')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeView === 'my' ? 'bg-emerald-500/10 text-emerald-500' : 'text-zinc-400 hover:bg-zinc-800'}`}
          >
            <Book className="w-5 h-5" /> My Stories
          </button>
          <button 
            onClick={() => setActiveView('shared')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeView === 'shared' ? 'bg-emerald-500/10 text-emerald-500' : 'text-zinc-400 hover:bg-zinc-800'}`}
          >
            <Users className="w-5 h-5" /> Shared with me
          </button>
          <button 
            onClick={() => setActiveView('activity')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeView === 'activity' ? 'bg-emerald-500/10 text-emerald-500' : 'text-zinc-400 hover:bg-zinc-800'}`}
          >
            <Clock className="w-5 h-5" /> Recent Activity
          </button>
          
          <div className="pt-8 mt-8 border-t border-zinc-800">
            <button 
              onClick={handleTestEmail}
              disabled={isTestingEmail}
              className="w-full flex items-center gap-3 px-4 py-3 text-emerald-500 hover:bg-emerald-500/5 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {isTestingEmail ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
              Test Email Connection
            </button>
          </div>
        </nav>

        <button 
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 text-zinc-500 hover:text-white transition-colors mt-auto"
        >
          <LogOut className="w-5 h-5" /> Logout
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-12 overflow-y-auto">
        <header className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tighter mb-2">Welcome, {user?.username}</h1>
            <p className="text-zinc-500">You have {stories.length} active storytelling sessions</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 bg-white text-black rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-400 transition-all shadow-xl shadow-white/5"
          >
            <Plus className="w-5 h-5" /> New Story
          </button>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-6 mb-12">
          {[
            { label: 'Total Stories', value: stories.length, icon: Book, color: 'emerald' },
            { label: 'Collaborators', value: '0', icon: Users, color: 'blue' },
            { label: 'Words Generated', value: '12.4k', icon: Sparkles, color: 'purple' },
          ].map((stat, i) => (
            <div key={i} className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl">
              <div className={`w-12 h-12 rounded-2xl bg-${stat.color}-500/10 flex items-center justify-center mb-4`}>
                <stat.icon className={`text-${stat.color}-500 w-6 h-6`} />
              </div>
              <div className="text-3xl font-black mb-1">{stat.value}</div>
              <div className="text-sm text-zinc-500 font-medium uppercase tracking-widest">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Stories List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold mb-6">
            {activeView === 'my' ? 'My Stories' : activeView === 'shared' ? 'Shared with Me' : 'Recent Activity'}
          </h2>
          
          {activeView !== 'activity' ? (
            <>
              {stories
                .filter(s => activeView === 'my' ? s.owner_id === user?.id : s.owner_id !== user?.id)
                .map((story) => (
                <motion.div 
                  key={story.id}
                  whileHover={{ x: 10 }}
                  onClick={() => navigate(`/story/${story.id}`)}
                  className="group bg-zinc-900/30 border border-zinc-800 p-6 rounded-3xl flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-all"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
                      <Book className="text-zinc-500 group-hover:text-emerald-500 w-8 h-8 transition-colors" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold mb-1">{story.title}</h3>
                      <div className="flex items-center gap-4 text-sm text-zinc-500">
                        <span className="px-2 py-0.5 bg-zinc-800 rounded-md text-xs font-bold uppercase tracking-widest">{story.genre}</span>
                        <span>{story.language}</span>
                        <span>Created {new Date(story.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/story/${story.id}`);
                      }}
                      className="p-2.5 bg-zinc-800 border border-zinc-700 rounded-xl hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-white"
                      title="Edit Story"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStoryId(story.id);
                        setIsCollabModalOpen(true);
                      }}
                      className="p-2.5 bg-zinc-800 border border-zinc-700 rounded-xl hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-white"
                      title="Share Story"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExport(story);
                      }}
                      className="p-2.5 bg-zinc-800 border border-zinc-700 rounded-xl hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-white"
                      title="Download PDF"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <ChevronRight className="text-zinc-700 group-hover:text-white transition-colors ml-2" />
                  </div>
                </motion.div>
              ))}

              {stories.filter(s => activeView === 'my' ? s.owner_id === user?.id : s.owner_id !== user?.id).length === 0 && (
                <div className="text-center py-20 bg-zinc-900/20 rounded-[48px] border-2 border-dashed border-zinc-800">
                  <Book className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                  <p className="text-zinc-500 font-medium">
                    {activeView === 'my' ? 'No stories yet. Start your first adventure!' : 'No stories shared with you yet.'}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              {activity.map((act) => (
                <motion.div 
                  key={act.id}
                  whileHover={{ x: 10 }}
                  onClick={() => navigate(`/story/${act.story_id}`)}
                  className="group bg-zinc-900/30 border border-zinc-800 p-6 rounded-3xl flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-all"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
                      <Clock className="text-zinc-500 group-hover:text-emerald-500 w-8 h-8 transition-colors" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold mb-1">{act.story_title}</h3>
                      <p className="text-sm text-zinc-400 line-clamp-1 mb-2">"{act.choice_text}"</p>
                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {act.author_name}</span>
                        <span>{new Date(act.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/story/${act.story_id}`);
                      }}
                      className="p-2.5 bg-zinc-800 border border-zinc-700 rounded-xl hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-white"
                      title="Edit Story"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStoryId(act.story_id);
                        setIsCollabModalOpen(true);
                      }}
                      className="p-2.5 bg-zinc-800 border border-zinc-700 rounded-xl hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-white"
                      title="Share Story"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExport({ id: act.story_id, title: act.story_title });
                      }}
                      className="p-2.5 bg-zinc-800 border border-zinc-700 rounded-xl hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-white"
                      title="Download PDF"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <ChevronRight className="text-zinc-700 group-hover:text-white transition-colors ml-2" />
                  </div>
                </motion.div>
              ))}
              
              {activity.length === 0 && (
                <div className="text-center py-20 bg-zinc-900/20 rounded-[48px] border-2 border-dashed border-zinc-800">
                  <Clock className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                  <p className="text-zinc-500 font-medium">No recent activity to show.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* New Story Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-[40px] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="text-2xl font-black tracking-tighter">Create New Story</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateStory} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Story Title</label>
                  <input 
                    type="text" 
                    placeholder="The Whispering Shadows..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl p-4 focus:outline-none focus:border-emerald-500 transition-colors"
                    value={newStory.title}
                    onChange={(e) => setNewStory({...newStory, title: e.target.value})}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Genre</label>
                    <select 
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl p-4 focus:outline-none focus:border-emerald-500 transition-colors appearance-none"
                      value={newStory.genre}
                      onChange={(e) => setNewStory({...newStory, genre: e.target.value})}
                    >
                      {['Fantasy', 'Sci-Fi', 'Horror', 'Mystery', 'Romance', 'Adventure'].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Language</label>
                    <select 
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl p-4 focus:outline-none focus:border-emerald-500 transition-colors appearance-none"
                      value={newStory.language}
                      onChange={(e) => setNewStory({...newStory, language: e.target.value})}
                    >
                      {[
                        'English', 'Tamil', 'Spanish', 'French', 'German', 'Hindi', 
                        'Japanese', 'Chinese', 'Russian', 'Portuguese', 'Italian', 
                        'Arabic', 'Korean', 'Dutch', 'Turkish', 'Vietnamese'
                      ].map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Characters</label>
                  <input 
                    type="text" 
                    placeholder="A brave knight named Elara, a wise owl..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl p-4 focus:outline-none focus:border-emerald-500 transition-colors"
                    value={newStory.characters}
                    onChange={(e) => setNewStory({...newStory, characters: e.target.value})}
                  />
                </div>

                <div className="pt-4">
                  <button 
                    disabled={loading}
                    className="w-full py-4 bg-emerald-500 text-black rounded-2xl font-bold text-lg hover:bg-emerald-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? 'Generating Initial Story...' : 'Begin Adventure'}
                    <Sparkles className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Collaboration Modal */}
      <AnimatePresence>
        {isCollabModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-[40px] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="text-2xl font-black tracking-tighter">Invite Collaborator</h2>
                <button onClick={() => setIsCollabModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleInvite} className="p-8 space-y-6">
                <p className="text-sm text-zinc-400">
                  Enter the email address of the person you want to collaborate with. They must have an account on VoxNarrative.
                </p>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Email Address</label>
                  <input 
                    type="email" 
                    placeholder="collaborator@example.com"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl p-4 focus:outline-none focus:border-emerald-500 transition-colors"
                    value={collabEmail}
                    onChange={(e) => setCollabEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="pt-4">
                  <button 
                    disabled={isInviting}
                    className="w-full py-4 bg-emerald-500 text-black rounded-2xl font-bold text-lg hover:bg-emerald-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isInviting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />}
                    {isInviting ? 'Sending Invite...' : 'Send Invitation'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
