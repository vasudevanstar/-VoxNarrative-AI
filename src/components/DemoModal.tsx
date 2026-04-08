import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Sparkles, Mic, GitBranch, Link as LinkIcon, 
  Users, Volume2, Play, Pause, ChevronRight, 
  MessageSquare, Wand2, Globe
} from 'lucide-react';

interface DemoStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

export default function DemoModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const steps: DemoStep[] = [
    {
      title: "Voice-First Creation",
      description: "Speak your imagination. Our AI listens and transforms your voice into rich, descriptive prose instantly.",
      icon: <Mic className="w-6 h-6 text-emerald-500" />,
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center animate-pulse">
              <Mic className="text-black w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">User Speaking</div>
              <div className="text-sm text-zinc-300 italic">"The ancient library was filled with floating books that whispered secrets..."</div>
            </div>
          </div>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl"
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">AI Narrator</span>
            </div>
            <p className="text-sm leading-relaxed text-zinc-400">
              Dust motes danced in the shafts of moonlight as you stepped into the Great Archive. Thousands of leather-bound volumes drifted through the air, their pages fluttering like the wings of trapped birds...
            </p>
          </motion.div>
        </div>
      )
    },
    {
      title: "Non-Linear Branching",
      description: "Create infinite paths. Link different parts of your story together to build complex, interactive narratives.",
      icon: <GitBranch className="w-6 h-6 text-blue-500" />,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl relative overflow-hidden group">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Path A</div>
              <div className="text-xs text-zinc-400">Open the golden locket...</div>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500" />
            </div>
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl relative opacity-50">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Path B</div>
              <div className="text-xs text-zinc-400">Leave the room quietly...</div>
            </div>
          </div>
          <div className="flex justify-center py-4">
            <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center gap-2">
              <LinkIcon className="w-3 h-3 text-blue-500" />
              <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Linked to "The Secret Garden"</span>
            </div>
          </div>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl border-dashed">
            <div className="flex items-center gap-2 text-zinc-500">
              <GitBranch className="w-4 h-4" />
              <span className="text-xs">Create Alternative Path</span>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Real-Time Collaboration",
      description: "Write together with friends. See every edit, every branch, and every idea as it happens.",
      icon: <Users className="w-6 h-6 text-purple-500" />,
      content: (
        <div className="space-y-4">
          <div className="flex -space-x-3">
            {[1, 2, 3].map(i => (
              <div key={i} className={`w-10 h-10 rounded-full border-2 border-black bg-zinc-800 flex items-center justify-center text-xs font-bold ${i === 1 ? 'text-emerald-500' : i === 2 ? 'text-blue-500' : 'text-purple-500'}`}>
                U{i}
              </div>
            ))}
            <div className="w-10 h-10 rounded-full border-2 border-black bg-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-500">
              +5
            </div>
          </div>
          <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">Sarah is typing...</span>
            </div>
            <div className="h-4 w-3/4 bg-zinc-800 rounded animate-pulse" />
          </div>
        </div>
      )
    },
    {
      title: "Immersive Narration",
      description: "Bring your stories to life with AI-powered text-to-speech in multiple languages.",
      icon: <Volume2 className="w-6 h-6 text-orange-500" />,
      content: (
        <div className="space-y-6 py-4">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-orange-500/20 blur-2xl rounded-full animate-pulse" />
              <div className="relative w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <div className="flex gap-1 items-end h-8">
                  {[1, 2, 3, 4, 5, 4, 3, 2, 1].map((h, i) => (
                    <motion.div 
                      key={i}
                      animate={{ height: [h * 4, h * 8, h * 4] }}
                      transition={{ repeat: Infinity, duration: 1, delay: i * 0.1 }}
                      className="w-1 bg-orange-500 rounded-full"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-2">
            {["English", "French", "Japanese"].map(lang => (
              <div key={lang} className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {lang}
              </div>
            ))}
          </div>
        </div>
      )
    }
  ];

  useEffect(() => {
    let interval: any;
    if (isAutoPlaying && isOpen) {
      interval = setInterval(() => {
        setCurrentStep(prev => (prev + 1) % steps.length);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isAutoPlaying, isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-5xl bg-zinc-950 border border-zinc-800 rounded-[40px] overflow-hidden shadow-2xl flex flex-col md:flex-row h-[80vh] md:h-[600px]"
          >
            {/* Sidebar Navigation */}
            <div className="w-full md:w-80 bg-zinc-900/50 border-r border-zinc-800 p-8 flex flex-col">
              <div className="flex items-center gap-2 mb-12">
                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <Sparkles className="text-black w-5 h-5" />
                </div>
                <span className="font-bold tracking-tight">VoxNarrative Demo</span>
              </div>

              <div className="flex-1 space-y-2">
                {steps.map((step, i) => (
                  <button 
                    key={i}
                    onClick={() => {
                      setCurrentStep(i);
                      setIsAutoPlaying(false);
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-left ${currentStep === i ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'}`}
                  >
                    <div className={`p-2 rounded-xl ${currentStep === i ? 'bg-zinc-700' : 'bg-zinc-900'}`}>
                      {step.icon}
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest mb-0.5">{step.title}</div>
                      <div className="text-[10px] opacity-60 line-clamp-1">Feature Showcase</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-8 pt-8 border-t border-zinc-800 flex items-center justify-between">
                <button 
                  onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                  className="p-2 rounded-full hover:bg-zinc-800 transition-colors text-zinc-500"
                >
                  {isAutoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <div className="flex gap-1">
                  {steps.map((_, i) => (
                    <div 
                      key={i} 
                      className={`h-1 rounded-full transition-all ${currentStep === i ? 'w-4 bg-emerald-500' : 'w-1 bg-zinc-800'}`} 
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-8 md:p-12 flex flex-col relative overflow-hidden">
              <button 
                onClick={onClose}
                className="absolute top-8 right-8 p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white transition-all z-20"
              >
                <X className="w-5 h-5" />
              </button>

              <AnimatePresence mode="wait">
                <motion.div 
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="h-full flex flex-col"
                >
                  <div className="max-w-xl mb-12">
                    <h2 className="text-4xl font-black tracking-tight mb-4">{steps[currentStep].title}</h2>
                    <p className="text-zinc-400 leading-relaxed">{steps[currentStep].description}</p>
                  </div>

                  <div className="flex-1 flex items-center justify-center">
                    <div className="w-full max-w-md">
                      {steps[currentStep].content}
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between pt-8 border-t border-zinc-900">
                    <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">Step {currentStep + 1} of {steps.length}</div>
                    <button 
                      onClick={() => setCurrentStep((currentStep + 1) % steps.length)}
                      className="flex items-center gap-2 text-emerald-500 font-bold uppercase tracking-widest text-xs hover:gap-3 transition-all"
                    >
                      Next Feature <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
