import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Mic, Sparkles, Users, BookOpen } from 'lucide-react';
import { useState } from 'react';
import DemoModal from '../components/DemoModal';

export default function Landing() {
  const [isDemoOpen, setIsDemoOpen] = useState(false);

  return (
    <div className="relative overflow-hidden">
      <DemoModal isOpen={isDemoOpen} onClose={() => setIsDemoOpen(false)} />
      {/* Background Atmosphere */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Sparkles className="text-black w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tighter">VoxNarrative</span>
        </div>
        <div className="flex items-center gap-6">
          <Link to="/login" className="text-sm font-medium hover:text-emerald-400 transition-colors">Login</Link>
          <Link to="/register" className="px-5 py-2.5 bg-white text-black rounded-full text-sm font-bold hover:bg-emerald-400 transition-all">Get Started</Link>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-20 pb-32">
        <div className="grid lg:grid-template-columns-[1.2fr_0.8fr] gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-7xl lg:text-8xl font-black leading-[0.9] tracking-tighter mb-8">
              STORIES <br />
              <span className="text-emerald-500">BORN FROM</span> <br />
              YOUR VOICE.
            </h1>
            <p className="text-xl text-zinc-400 max-w-lg mb-10 leading-relaxed">
              Experience the next generation of interactive storytelling. Speak your imagination, and watch AI weave your words into immersive, branching adventures.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/register" className="px-8 py-4 bg-emerald-500 text-black rounded-2xl font-bold text-lg hover:scale-105 transition-transform flex items-center gap-2">
                Start Your Journey <Mic className="w-5 h-5" />
              </Link>
              <button 
                onClick={() => setIsDemoOpen(true)}
                className="px-8 py-4 bg-zinc-900 border border-zinc-800 rounded-2xl font-bold text-lg hover:bg-zinc-800 transition-colors"
              >
                Watch Demo
              </button>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative"
          >
            <div className="aspect-square bg-zinc-900 rounded-[48px] border border-zinc-800 p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="space-y-6 relative z-10">
                <div className="flex items-center gap-4 p-4 bg-black/40 rounded-2xl border border-white/5 backdrop-blur-sm">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Users className="text-emerald-500 w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Collaborative</div>
                    <div className="font-medium">Write with friends in real-time</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-black/40 rounded-2xl border border-white/5 backdrop-blur-sm">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <BookOpen className="text-blue-500 w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Branching</div>
                    <div className="font-medium">Infinite paths, one story</div>
                  </div>
                </div>
                <div className="p-6 bg-zinc-800/50 rounded-3xl border border-white/5">
                  <div className="text-sm italic text-zinc-300 mb-4">"Suddenly, a massive dragon emerged from the mist, its scales shimmering like emeralds..."</div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-mono text-emerald-500 uppercase tracking-widest">AI Generating...</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
