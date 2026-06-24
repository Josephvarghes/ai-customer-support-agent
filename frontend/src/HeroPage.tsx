import { motion } from 'framer-motion';
import {
  ArrowRight,
  ShieldCheck,
  Cpu,
  Zap,
  Database,
  Terminal,
  Volume2,
  Lock,
  Layers,
  ChevronRight,
  TrendingUp,
  ThumbsUp
} from 'lucide-react';

interface HeroPageProps {
  onLaunchDashboard: () => void;
}

export default function HeroPage({ onLaunchDashboard }: HeroPageProps) {
  // Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1
      }
    }
  } as const;

  const itemVariants = {
    hidden: { y: 25, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5, ease: 'easeOut' }
    }
  } as const;

  const cardHoverVariants = {
    hover: {
      y: -6,
      borderColor: 'rgba(99, 102, 241, 0.4)',
      boxShadow: '0 10px 30px -10px rgba(99, 102, 241, 0.15)',
      backgroundColor: 'rgba(30, 41, 59, 0.65)'
    }
  } as const;

  const techStack = [
    {
      name: 'LangGraph',
      category: 'Agent Orchestration',
      description: 'Defines the agent state graph, node actions, and strict conditional routing rules that bypass LLM logic when policies are violated.',
      icon: <Layers className="w-5 h-5 text-indigo-400" />,
      color: 'from-indigo-500/10 to-indigo-500/5 border-indigo-500/20'
    },
    {
      name: 'Llama 3.3 (Groq)',
      category: 'Reasoning Engine',
      description: 'Ultra-fast, high-capacity LLM equipped with native tool calling capabilities to query databases and trigger programmatic audits.',
      icon: <Cpu className="w-5 h-5 text-emerald-400" />,
      color: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20'
    },
    {
      name: 'Deepgram voice API',
      category: 'STT / TTS Voice Native',
      description: 'Nova-2 model for continuous microphone transcriptions and Aura-Asteria for ultra-low latency, natural conversational audio synthesis.',
      icon: <Volume2 className="w-5 h-5 text-sky-400" />,
      color: 'from-sky-500/10 to-sky-500/5 border-sky-500/20'
    },
    {
      name: 'FastAPI WebSockets',
      category: 'Event-Driven Server',
      description: 'Streams live token outputs, JSON execution telemetry, and binary audio buffers back and forth through a persistent client socket.',
      icon: <Zap className="w-5 h-5 text-amber-400" />,
      color: 'from-amber-500/10 to-amber-500/5 border-amber-500/20'
    },
    {
      name: 'React, TS & Tailwind',
      category: 'Telemetry Interface',
      description: 'Twin-panel client visualizer separating user interaction from developer diagnostics and detailed policy evaluation logs.',
      icon: <Terminal className="w-5 h-5 text-purple-400" />,
      color: 'from-purple-500/10 to-purple-500/5 border-purple-500/20'
    },
    {
      name: 'State Checkpointing',
      category: 'Session Memory',
      description: 'Persistent memory saver automatically mapped to a unique client ID, enabling total recovery of conversation state upon refresh.',
      icon: <Database className="w-5 h-5 text-pink-400" />,
      color: 'from-pink-500/10 to-pink-500/5 border-pink-500/20'
    }
  ];

  const businessBenefits = [
    {
      title: 'Zero Policy Leakage',
      desc: 'Enforces rigid, programmatic rule audits for timelines, tags, categories, and customer tiers. LLMs never make the final financial decision, removing compliance leakage.',
      icon: <Lock className="w-6 h-6 text-rose-400" />
    },
    {
      title: '95% Cost Reduction',
      desc: 'Handles routine queries instantly without human intervention. Standardized cases are resolved in milliseconds, reducing human support overhead to complex exceptions only.',
      icon: <TrendingUp className="w-6 h-6 text-emerald-400" />
    },
    {
      title: 'Instant Customer Gratification',
      desc: 'No more waiting on support tickets for days. Customer refunds are processed in real-time, boosting customer retention and net promoter scores.',
      icon: <ThumbsUp className="w-6 h-6 text-sky-400" />
    }
  ];

  const workflowSteps = [
    { step: '01', title: 'User Input', desc: 'Text query or mic voice stream' },
    { step: '02', title: 'LLM Reasoner', desc: 'Evaluates context & binds tools' },
    { step: '03', title: 'DB Lookup', desc: 'Queries CRM profile and order' },
    { step: '04', title: 'Policy Engine', desc: 'Runs strict, program rules check' },
    { step: '05', title: 'State Router', desc: 'Forces termination on violation' },
    { step: '06', title: 'TTS / Delivery', desc: 'Streams token copy & audio feedback' }
  ];

  return (
    <div className="relative min-h-full bg-[#0B0F19] overflow-y-auto overflow-x-hidden scrollbar-thin">
      
      {/* Background Grids & Gradients */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[250px] bg-emerald-600/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Hero Section Container */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-6xl mx-auto px-6 pt-16 pb-20 relative z-10"
      >
        
        {/* Animated Badge */}
        <motion.div variants={itemVariants} className="flex justify-center mb-5">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-xs font-semibold text-indigo-300">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Next-Gen Agentic Architecture</span>
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={itemVariants}
          className="text-center text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1] mb-6"
        >
          Programmatic Refund{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
            Orchestration
          </span>{' '}
          For Support
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={itemVariants}
          className="text-center text-slate-400 text-base sm:text-lg md:text-xl max-w-3xl mx-auto leading-relaxed mb-10 font-medium"
        >
          Evaluate refund policies deterministically against live customer profiles. Combine
          dynamic <strong className="text-slate-200">LangGraph</strong> workflows, <strong className="text-slate-200">Llama 3.3</strong> reasoning, and <strong className="text-slate-200">Deepgram voice</strong> synthesis
          with full execution telemetry.
        </motion.p>

        {/* Action CTAs */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
        >
          <button
            onClick={onLaunchDashboard}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm rounded-xl border border-indigo-400/20 shadow-lg shadow-indigo-600/10 transition-all duration-200 group"
          >
            <span>Launch Live Console</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition duration-150" />
          </button>
          
          <a
            href="#stack"
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-4 bg-[#1E293B]/70 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-sm rounded-xl border border-white/5 hover:border-slate-700/50 transition-all duration-200"
          >
            Explore Tech Stack
          </a>
        </motion.div>

        {/* Interactive Dashboard Graphic Mockup */}
        <motion.div
          variants={itemVariants}
          className="relative bg-[#131B2E]/60 border border-slate-800/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md mb-24 overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4 text-xs text-slate-500 font-mono">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/40" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/40" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
              <span className="ml-2 text-slate-400 font-semibold">omniai-telemetry-panel.log</span>
            </div>
            <span>STREAMS_ACTIVE</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            
            {/* Visual Chat Mock */}
            <div className="md:col-span-3 bg-[#0B0F19]/50 border border-slate-800/50 rounded-xl p-4 min-h-60 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start space-x-2 text-xs">
                  <div className="p-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold">USR</div>
                  <div className="bg-[#1E293B] p-2.5 rounded-lg text-slate-300">
                    "I want a return for order ORD-1002, cosmetics purchase. I opened it already."
                  </div>
                </div>
                <div className="flex items-start space-x-2 text-xs">
                  <div className="p-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">AGN</div>
                  <div className="bg-indigo-950/20 border border-indigo-500/20 p-2.5 rounded-lg text-indigo-300">
                    "I have run a policy audit on your order. Unfortunately, your refund request is DENIED. Reason: Opened cosmetics items are non-refundable."
                  </div>
                </div>
              </div>
              <div className="flex space-x-2 border-t border-slate-800/80 pt-3 mt-3 items-center">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span className="text-[10px] text-slate-500 font-mono">Simulating voice engine state...</span>
              </div>
            </div>

            {/* Visual Reasoning Logs Mock */}
            <div className="md:col-span-2 bg-[#0B0F19]/50 border border-slate-800/50 rounded-xl p-4 font-mono text-[10px] space-y-3 overflow-hidden">
              <div className="text-slate-500 border-b border-slate-800 pb-1 flex justify-between">
                <span>REASONER TRACE</span>
                <span className="text-emerald-400">REALTIME</span>
              </div>
              <div className="text-blue-400">
                <span className="text-slate-500">❖ Node:</span> Call Llm Agent <span className="text-slate-600">[done]</span>
              </div>
              <div className="text-amber-400">
                <span className="text-slate-500">↳ Tool:</span> verify_order_eligibility
                <pre className="text-[8px] bg-slate-900/60 p-1.5 rounded mt-1 border border-subtle text-slate-400">
                  {"{"} order_id: "ORD-1002" {"}"}
                </pre>
              </div>
              <div className="text-rose-400 font-bold">
                <span className="text-slate-500">↳ Tool:</span> validate_refund_against_policy
                <div className="text-[8px] text-rose-500/80 font-normal">
                  ✗ VIOLATION: Cosmetics must be sealed. Status: Opened.
                </div>
              </div>
              <div className="text-rose-400">
                <span className="text-slate-500">❖ Node:</span> Finalize Decision <span className="text-slate-600">→ DENIED</span>
              </div>
            </div>

          </div>
        </motion.div>

        {/* Business Value Benefits Section */}
        <motion.div variants={itemVariants} className="mb-28">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
              Enterprise Customer Operations Guardrails
            </h2>
            <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
              Automate customer returns securely. Maintain absolute compliance with business refund policies while providing rapid response times.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {businessBenefits.map((benefit, i) => (
              <motion.div
                key={i}
                variants={itemVariants}
                className="bg-[#131B2E]/40 border border-slate-800/60 rounded-2xl p-6 hover:border-indigo-500/20 transition-all duration-200"
              >
                <div className="p-3 bg-slate-800/40 rounded-xl w-fit mb-5">
                  {benefit.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-100 mb-3">{benefit.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{benefit.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Workflow Diagram Section */}
        <motion.div variants={itemVariants} className="mb-28 bg-[#131B2E]/30 border border-slate-800/40 rounded-2xl p-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
              Determinism Meets Cognitive AI
            </h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              How the LangGraph workflow orchestrates execution telemetry step-by-step
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {workflowSteps.map((step, idx) => (
              <div key={idx} className="relative bg-[#0B0F19]/40 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between min-h-36">
                <div>
                  <span className="text-[10px] font-bold text-indigo-400 font-mono tracking-wider">{step.step}</span>
                  <h4 className="text-xs font-bold text-slate-200 mt-2">{step.title}</h4>
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">{step.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Tech Stack Grid */}
        <motion.div variants={itemVariants} id="stack" className="mb-10">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
              Decoupled Production Tech Stack
            </h2>
            <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
              Engineered with advanced, state-of-the-art libraries for real-time telemetry streaming and voice recognition.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {techStack.map((tech, i) => (
              <motion.div
                key={i}
                variants={itemVariants}
                whileHover="hover"
                custom={i}
                className="bg-[#131B2E]/30 border border-slate-800/40 rounded-2xl p-6 transition-all duration-200 cursor-pointer overflow-hidden relative group"
              >
                <motion.div
                  variants={cardHoverVariants}
                  className="absolute inset-0 bg-gradient-to-b opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-sans">
                      {tech.category}
                    </span>
                    <div className="p-2 bg-slate-800/40 rounded-lg">
                      {tech.icon}
                    </div>
                  </div>
                  <h3 className="text-md font-extrabold text-slate-100 mb-2">{tech.name}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{tech.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          variants={itemVariants}
          className="text-center border-t border-slate-800/60 pt-16"
        >
          <h2 className="text-2xl font-bold text-slate-100 mb-4">Ready to test the engine?</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-8 font-medium">
            Launch the support client, load database scenario profiles, and watch live policy logs stream in real-time.
          </p>
          <button
            onClick={onLaunchDashboard}
            className="inline-flex items-center space-x-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl border border-indigo-400/20 shadow-lg shadow-indigo-600/10 transition duration-150 group"
          >
            <span>Enter Live Console</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition duration-150" />
          </button>
        </motion.div>

      </motion.div>
    </div>
  );
}
