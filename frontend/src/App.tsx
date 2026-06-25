import { useState, useEffect, useRef } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Terminal,
  User,
  Bot,
  Database,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import HeroPage from './HeroPage';

interface Message {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  isStreaming?: boolean;
  timestamp: Date;
}

interface ReasoningLog {
  id: string;
  timestamp: string;
  node: string;
  tool: string | null;
  status: 'started' | 'completed' | 'node_started' | 'node_completed' | 'error';
  arguments?: any;
  telemetry?: any;
  output?: any;
}

interface Order {
  order_id: string;
  purchase_date: string;
  item_name: string;
  item_category: string;
  item_condition: string;
  amount: number;
}

interface CustomerProfile {
  customer_id: string;
  name: string;
  email: string;
  membership_tier: string;
  orders: Order[];
}

const BACKEND_HOST = import.meta.env.VITE_BACKEND_HOST || 'localhost:8000';
const IS_SECURE = typeof window !== 'undefined' && window.location.protocol === 'https:';
const HTTP_PROTOCOL = IS_SECURE ? 'https' : 'http';
const WS_PROTOCOL = IS_SECURE ? 'wss' : 'ws';

export default function App() {
  // Session Persistence Client ID
  const [clientId, setClientId] = useState<string>(() => {
    let id = sessionStorage.getItem('ai_support_client_id');
    if (!id) {
      id = `cust-session-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      sessionStorage.setItem('ai_support_client_id', id);
    }
    return id;
  });

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: 'Hello! I am your AI Customer Support Agent. Please provide your customer ID and order number to evaluate refund eligibility.',
      timestamp: new Date()
    }
  ]);
  const [logs, setLogs] = useState<ReasoningLog[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [isRecording, setIsRecording] = useState(false);
  const [showCrmDrawer, setShowCrmDrawer] = useState(false);
  const [crmProfiles, setCrmProfiles] = useState<CustomerProfile[]>([]);
  const [view, setView] = useState<'hero' | 'dashboard'>('hero');
  const [mobileTab, setMobileTab] = useState<'chat' | 'logs'>('chat');

  // Backend Wake-up States
  const [backendState, setBackendState] = useState<'awake' | 'waking' | 'error' | 'idle'>('idle');
  const [wakeUpProgress, setWakeUpProgress] = useState(0);
  const [wakeUpError, setWakeUpError] = useState<string | null>(null);

  // Last policy evaluation reason to synthesize refusal in case of routing cut-off
  const policyReasonRef = useRef<string>('');

  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);
  const tempUserMsgIdRef = useRef<string>('');

  // Heartbeat & Reconnection Refs
  const heartbeatIntervalRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const reconnectAttemptsRef = useRef<number>(0);

  const fetchCrmProfiles = async () => {
    try {
      const response = await fetch(`${HTTP_PROTOCOL}://${BACKEND_HOST}/api/crm/profiles`);
      if (response.ok) {
        const data = await response.json();
        setCrmProfiles(data);
      }
    } catch (err) {
      console.error('Failed to fetch CRM profiles:', err);
    }
  };

  const cleanupHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  };

  const handleReconnect = () => {
    cleanupHeartbeat();
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (reconnectAttemptsRef.current < 5) {
      const delay = Math.min(30000, Math.pow(2, reconnectAttemptsRef.current) * 2000);
      console.log(`Attempting reconnect in ${delay}ms... (Attempt ${reconnectAttemptsRef.current + 1})`);
      setConnectionStatus('connecting');
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectAttemptsRef.current += 1;
        wakeUpBackend(true).then((success) => {
          if (success) {
            reconnectAttemptsRef.current = 0;
          } else {
            setConnectionStatus('disconnected');
            handleReconnect(); // try again
          }
        });
      }, delay);
    } else {
      console.log('Max reconnect attempts reached.');
      setConnectionStatus('disconnected');
    }
  };

  const wakeUpBackend = async (silent = false) => {
    if (!silent) {
      setBackendState('waking');
      setWakeUpError(null);
      setWakeUpProgress(0);
      setConnectionStatus('connecting');
    }
    const healthUrl = `${HTTP_PROTOCOL}://${BACKEND_HOST}/health`;
    const maxAttempts = 35;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`Backend wake-up attempt ${attempt}/${maxAttempts} calling ${healthUrl}...`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

        const response = await fetch(healthUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
          console.log('Backend is awake and healthy.');
          setBackendState('awake');
          setWakeUpError(null);
          fetchCrmProfiles();
          connectWebSocket();
          return true;
        }
      } catch (err) {
        console.log(`Attempt ${attempt} failed:`, err);
      }

      if (!silent) {
        setWakeUpProgress(Math.min(100, Math.round((attempt / maxAttempts) * 100)));
      }

      // Wait 3 seconds before next check
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    if (!silent) {
      setBackendState('error');
      setWakeUpError('The support engine backend failed to respond. It may be sleeping or offline.');
      setConnectionStatus('disconnected');
    }
    return false;
  };

  // WebSocket Connection Lifecycle
  useEffect(() => {
    wakeUpBackend();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      cleanupHeartbeat();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [clientId]);

  const connectWebSocket = () => {
    setConnectionStatus('connecting');
    cleanupHeartbeat();
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = `${WS_PROTOCOL}://${BACKEND_HOST}/ws/chat/${clientId}`;
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      setBackendState('awake');
      console.log('WebSocket Connected.');
      reconnectAttemptsRef.current = 0;

      // Setup heartbeat every 30 seconds
      heartbeatIntervalRef.current = setInterval(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          console.log('Sending heartbeat ping...');
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = async (event) => {
      // 0. Handle binary data (TTS audio bytes)
      if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
        if (audioPlaybackRef.current) {
          audioPlaybackRef.current.pause();
          audioPlaybackRef.current = null;
        }
        const blob = event.data instanceof Blob ? event.data : new Blob([event.data], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audioPlaybackRef.current = audio;
        audio.play().catch(err => console.error("Speech playback failed:", err));
        return;
      }

      try {
        const data = JSON.parse(event.data);

        // Handle user transcription chunk from STT
        if (data.type === 'user-transcript-chunk') {
          const currentId = tempUserMsgIdRef.current;
          if (currentId) {
            setMessages((prev) => {
              return prev.map((msg) => {
                if (msg.id === currentId) {
                  return {
                    ...msg,
                    text: msg.text ? msg.text + ' ' + data.content : data.content
                  };
                }
                return msg;
              });
            });
          }
        }

        // Handle user transcription final from STT
        if (data.type === 'user-transcript-final') {
          const currentId = tempUserMsgIdRef.current;
          if (currentId) {
            setMessages((prev) => {
              return prev.map((msg) => {
                if (msg.id === currentId) {
                  return {
                    ...msg,
                    text: data.content,
                    isStreaming: false
                  };
                }
                return msg;
              }).filter((msg) => msg.sender !== 'user' || msg.text.trim() !== '');
            });
            tempUserMsgIdRef.current = '';
          }
          setIsThinking(true);
        }

        // 1. Handle incoming text streaming tokens
        if (data.type === 'token') {
          setIsThinking(false);
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage && lastMessage.sender === 'agent' && lastMessage.isStreaming) {
              return [
                ...prev.slice(0, -1),
                { ...lastMessage, text: lastMessage.text + data.content }
              ];
            } else {
              return [
                ...prev,
                {
                  id: Math.random().toString(),
                  sender: 'agent',
                  text: data.content,
                  isStreaming: true,
                  timestamp: new Date()
                }
              ];
            }
          });
        }

        // 2. Handle reasoning logs
        else if (data.type === 'reasoning') {
          const logPayload: ReasoningLog = {
            id: Math.random().toString(),
            timestamp: new Date().toLocaleTimeString(),
            node: data.node,
            tool: data.tool,
            status: data.log.status,
            arguments: data.log.arguments,
            telemetry: data.log.telemetry,
            output: data.log.output
          };

          setLogs((prev) => [...prev, logPayload]);

          // Capture policy evaluation outcome for synthesis
          if (data.tool === 'validate_refund_against_policy' && data.log.status === 'completed') {
            const outcome = data.log.telemetry?.outcome || '';
            if (outcome) {
              policyReasonRef.current = outcome;
            } else if (data.log.telemetry?.output) {
              policyReasonRef.current = data.log.telemetry.output;
            }
          }

          // Node completed
          if (data.node === 'finalize_decision' && data.log.status === 'node_completed') {
            setIsThinking(false);

            // Mark the active streaming message as complete
            setMessages((prev) => {
              const lastMessage = prev[prev.length - 1];
              if (lastMessage && lastMessage.sender === 'agent' && lastMessage.isStreaming) {
                return [
                  ...prev.slice(0, -1),
                  { ...lastMessage, isStreaming: false }
                ];
              }
              return prev;
            });

            // If decision is DENIED and no active text response was streamed, synthesize the refusal message
            const refundStatus = data.log.output?.refund_status;
            if (refundStatus === 'DENIED') {
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                // Check if last message is from agent and has substance.
                // If it is just a welcome or user message, or agent message is empty, add synthesized one
                const needsSynthesizedRefusal =
                  last.sender === 'user' ||
                  (last.sender === 'agent' && last.text.trim() === '') ||
                  !last.text.includes('deny') && !last.text.includes('denied') && !last.text.includes('unfortunately');

                if (needsSynthesizedRefusal) {
                  let reasonText = policyReasonRef.current || 'Order details violate the refund timeline, category rules, or membership restrictions.';
                  // Clean up the text "Evaluation complete. Eligible: False. Reason: "
                  reasonText = reasonText.replace(/Evaluation complete\. Eligible: (False|True)\.?\s*Reason:\s*/i, '');

                  return [
                    ...prev,
                    {
                      id: Math.random().toString(),
                      sender: 'agent',
                      text: `I have run a policy audit on your order. Unfortunately, your refund request is DENIED. Reason: ${reasonText}`,
                      timestamp: new Date()
                    }
                  ];
                }
                return prev;
              });
            } else if (refundStatus === 'APPROVED') {
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                const needsSynthesizedApproval =
                  last.sender === 'user' ||
                  (last.sender === 'agent' && last.text.trim() === '');

                if (needsSynthesizedApproval) {
                  return [
                    ...prev,
                    {
                      id: Math.random().toString(),
                      sender: 'agent',
                      text: `Great news! Your refund request is APPROVED. The credit will be applied to your payment method.`,
                      timestamp: new Date()
                    }
                  ];
                }
                return prev;
              });
            }
          }
        }

        // 3. Handle errors
        else if (data.type === 'error') {
          setIsThinking(false);
          setLogs((prev) => [
            ...prev,
            {
              id: Math.random().toString(),
              timestamp: new Date().toLocaleTimeString(),
              node: 'error_handler',
              tool: null,
              status: 'error',
              output: data.content
            }
          ]);
          setMessages((prev) => [
            ...prev,
            {
              id: Math.random().toString(),
              sender: 'system',
              text: `System error: ${data.content}`,
              timestamp: new Date()
            }
          ]);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket Disconnected. Reconnecting...');
      handleReconnect();
    };

    ws.onerror = (err) => {
      console.error('WebSocket Error. Reconnecting...', err);
      handleReconnect();
    };
  };

  // Auto-scroll logic
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Send message
  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text) return;

    if (connectionStatus !== 'connected') {
      console.log('Connection not active. Triggering backend wake up.');
      wakeUpBackend(false);
      return;
    }

    // Append user message
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        sender: 'user',
        text,
        timestamp: new Date()
      }
    ]);

    // Send payload
    wsRef.current?.send(JSON.stringify({ message: text }));

    if (!textToSend) {
      setInputValue('');
    }

    setIsThinking(true);
    policyReasonRef.current = ''; // Reset reason tracker
  };

  // Real Voice Recording and Streaming
  const handleMicToggle = async () => {
    if (isRecording) {
      // 1. Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      setIsRecording(false);
    } else {
      // Stop any active audio playback first
      if (audioPlaybackRef.current) {
        audioPlaybackRef.current.pause();
        audioPlaybackRef.current = null;
      }

      try {
        // Request microphone stream
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
          }
        });
        audioStreamRef.current = stream;

        const newId = 'user-trans-' + Math.random().toString();
        tempUserMsgIdRef.current = newId;

        // Add a placeholder message for the user's incoming transcript
        setMessages((prev) => [
          ...prev,
          {
            id: newId,
            sender: 'user',
            text: '',
            isStreaming: true,
            timestamp: new Date()
          }
        ]);

        // Determine supported container formats
        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }

        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            // Send binary chunk directly to websocket
            wsRef.current.send(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'audio-end' }));
          }
        };

        // Start recording and stream chunks every 250ms
        mediaRecorder.start(250);
        setIsRecording(true);
      } catch (err) {
        console.error("Failed to access microphone or start recorder:", err);
        alert("Could not access your microphone. Please check permissions.");
      }
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'agent',
        text: 'Hello! I am your AI Customer Support Agent. Please provide your customer ID and order number to evaluate refund eligibility.',
        timestamp: new Date()
      }
    ]);
    setLogs([]);
    setIsThinking(false);
  };

  // Demo shortcut messages
  const demoScenarios = [
    {
      label: 'Alice (Approve + Fee)',
      text: 'I am Alice Smith (customer CUST-001). I want a refund for my Wireless Headphones (order ORD-1001). It was opened.'
    },
    {
      label: 'Bob (Deny: Opened Cosmetics)',
      text: 'My name is Bob Jones (customer CUST-002). I would like to return the Hydrating Face Cream I purchased on order ORD-1002. I opened it.'
    },
    {
      label: 'Kevin (Deny: Clearance)',
      text: 'I am Kevin Bacon (customer CUST-011). Can I get a refund for my Clearance Socks on order ORD-1011?'
    },
    {
      label: 'Charlie (Deny: >30 Days)',
      text: 'I am Charlie Brown (customer CUST-003). I want to return my Denim Jacket on order ORD-1003. It is sealed.'
    }
  ];

  // Helper to format node and tool names in telemetry logs
  const formatNodeTitle = (log: ReasoningLog) => {
    const rawName = log.tool || log.node;
    if (!rawName) return '';
    return rawName
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => {
        const upper = word.toUpperCase();
        if (upper === 'LLM' || upper === 'CRM' || upper === 'DB' || upper === 'ID' || upper === 'API') {
          return upper;
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  };

  // Logic to determine color code of logs
  const getLogStyle = (log: ReasoningLog) => {
    // 1. Check for policy violation/denial (Red)
    const isDenial =
      (log.node === 'finalize_decision' && log.output?.refund_status === 'DENIED') ||
      (log.tool === 'validate_refund_against_policy' && log.status === 'completed' && log.telemetry?.eligible === false);

    if (isDenial) {
      return {
        bg: 'bg-[#1E293B]/45 border-rose-500/25 hover:bg-rose-500/10',
        text: 'text-rose-400 font-medium',
        badge: 'text-rose-400 border border-rose-500/25',
        icon: <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
      };
    }

    // 2. Check for database lookup (Blue)
    const isDbLookup =
      log.tool === 'lookup_customer_profile' ||
      log.tool === 'verify_order_eligibility';

    if (isDbLookup) {
      return {
        bg: 'bg-[#1E293B]/45 border-blue-500/25 hover:bg-blue-500/10',
        text: 'text-blue-400',
        badge: 'text-blue-400 border border-blue-500/25',
        icon: <Database className="w-4 h-4 text-blue-400 shrink-0" />
      };
    }

    // 3. Check for general tool call (Yellow)
    if (log.tool) {
      return {
        bg: 'bg-[#1E293B]/45 border-amber-500/25 hover:bg-amber-500/10',
        text: 'text-amber-400',
        badge: 'text-amber-400 border border-amber-500/25',
        icon: <Terminal className="w-4 h-4 text-amber-400 shrink-0" />
      };
    }

    // 4. Default: node transitions (Grey/Green)
    const isComplete = log.status === 'node_completed';
    return {
      bg: 'bg-[#1E293B]/20 border-subtle hover:bg-[#1E293B]/30',
      text: isComplete ? 'text-emerald-400 font-medium' : 'text-slate-400',
      badge: isComplete ? 'text-emerald-400 border border-emerald-500/25' : 'text-slate-400 border border-white/10',
      icon: isComplete ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
    };
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-[#0B0F19] overflow-hidden text-slate-100 font-sans">

      {/* HEADER NAVBAR */}
      <header className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3 border-b border-subtle bg-[#0B0F19]/60 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="p-1.5 sm:p-2 rounded-lg bg-indigo-600/10 border border-indigo-500/20">
            <Sparkles className="w-4 h-4 sm:w-5 h-5 text-indigo-400 animate-pulse-slow" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base md:text-lg font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
              OmniAI Refund Care
            </h1>
            <p className="text-xs text-slate-500 font-medium hidden sm:block">Twin-Panel Stream Controller</p>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex bg-[#131B2E] border border-subtle rounded-xl p-0.5 sm:p-1 space-x-0.5 sm:space-x-1">
          <button
            onClick={() => setView('hero')}
            className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-150 ${
              view === 'hero'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Product Tour
          </button>
          <button
            onClick={() => setView('dashboard')}
            className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-150 ${
              view === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Live Console
          </button>
        </div>

        {/* CONNECTION STATUS & SESSION CONTROLLER PILL */}
        <div className="flex items-center bg-[#131B2E] border border-subtle rounded-full p-0.5 sm:p-1.5 space-x-0.5 sm:space-x-1">
          <button
            onClick={() => {
              setShowCrmDrawer(true);
              fetchCrmProfiles();
            }}
            className="flex items-center space-x-1 sm:space-x-1.5 text-[10px] sm:text-xs font-semibold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-slate-300 hover:text-white hover:bg-white/5 transition duration-150"
          >
            <Database className="w-3 h-3 sm:w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">CRM Database</span>
          </button>

          <div className="h-3 sm:h-4 w-px bg-white/10" />

          <div className="flex items-center space-x-0.5 sm:space-x-1.5 px-1.5 sm:px-3 text-[10px] sm:text-xs font-mono">
            <span className="text-slate-500 hidden sm:inline">ID:</span>
            <input
              type="text"
              value={clientId}
              onChange={(e) => {
                const newId = e.target.value.trim();
                if (newId) {
                  setClientId(newId);
                  sessionStorage.setItem('ai_support_client_id', newId);
                }
              }}
              className="bg-transparent text-indigo-300 font-semibold focus:outline-none border-b border-transparent focus:border-indigo-500 w-16 sm:w-24 text-center px-0.5"
              title="Change session ID to test state checkpointer recovery"
            />
          </div>

          <div className="h-3 sm:h-4 w-px bg-white/10" />

          <div className="flex items-center space-x-0.5 sm:space-x-1.5 px-1.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold text-slate-300">
            {connectionStatus === 'connected' ? (
              <Wifi className="w-3 h-3 sm:w-3.5 h-3.5 text-emerald-400" />
            ) : connectionStatus === 'connecting' ? (
              <Wifi className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            ) : (
              <WifiOff className="w-3 h-3 sm:w-3.5 h-3.5 text-rose-400" />
            )}
            <span className="capitalize hidden md:inline">{connectionStatus}</span>
          </div>

          <div className="h-3 sm:h-4 w-px bg-white/10" />

          <button
            onClick={connectWebSocket}
            title="Reconnect WebSocket"
            className="p-1 rounded-full text-slate-400 hover:text-slate-200 hover:bg-white/5 transition duration-150"
          >
            <RefreshCw className="w-3 h-3 sm:w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* DASHBOARD CONTENT OR HERO PAGE */}
      <main className="flex flex-1 flex-row min-h-0 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {view === 'hero' ? (
            <motion.div
              key="hero"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="flex-1 min-h-full"
            >
              <HeroPage onLaunchDashboard={() => setView('dashboard')} />
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="flex flex-1 flex-col md:flex-row min-h-0 overflow-hidden w-full"
            >
              {/* Mobile Tab Switcher */}
              <div className="flex md:hidden bg-[#0B0F19] border-b border-subtle p-1.5 space-x-1.5 shrink-0">
                <button
                  onClick={() => setMobileTab('chat')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold text-center transition-all duration-150 ${
                    mobileTab === 'chat'
                      ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                      : 'bg-[#131B2E] text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  Chat Console
                </button>
                <button
                  onClick={() => setMobileTab('logs')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold text-center transition-all duration-150 ${
                    mobileTab === 'logs'
                      ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                      : 'bg-[#131B2E] text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  Live Logs ({logs.length})
                </button>
              </div>

              {/* LEFT PANEL: CUSTOMER INTERFACE */}
              <section className={`flex-col flex-1 md:border-r border-subtle bg-[#131B2E] relative min-h-0 min-w-0 ${
                mobileTab === 'chat' ? 'flex w-full' : 'hidden'
              } md:flex md:w-1/2`}>

            {backendState === 'waking' && (
              <div className="absolute inset-0 bg-[#0B0F19]/90 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center">
                <div className="max-w-md w-full bg-[#131B2E] border border-subtle p-8 rounded-2xl shadow-2xl relative overflow-hidden">
                  <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />
                  <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
                  
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="p-4 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6 animate-pulse">
                      <Sparkles className="w-8 h-8 text-indigo-400" />
                    </div>
                    
                    <h3 className="text-lg font-bold text-slate-100 mb-2">
                      Waking Up Support Engine
                    </h3>
                    
                    <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                      Our backend is hosted on a free instance which automatically spins down after 15 minutes of inactivity. It is currently booting up, which may take about a minute. Thank you for your patience!
                    </p>
                    
                    {/* Progress bar container */}
                    <div className="w-full bg-[#0B0F19] border border-white/5 rounded-full h-2 mb-2 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${wakeUpProgress}%` }}
                      />
                    </div>
                    
                    <div className="flex justify-between w-full text-[10px] font-mono text-slate-500">
                      <span>Booting dependencies...</span>
                      <span>{wakeUpProgress}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {backendState === 'error' && (
              <div className="absolute inset-0 bg-[#0B0F19]/90 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center">
                <div className="max-w-md w-full bg-[#131B2E] border border-rose-500/20 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
                  <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl" />
                  
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="p-4 rounded-full bg-rose-500/10 border border-rose-500/20 mb-6">
                      <AlertTriangle className="w-8 h-8 text-rose-400 animate-bounce" />
                    </div>
                    
                    <h3 className="text-lg font-bold text-rose-300 mb-2">
                      Connection Timeout
                    </h3>
                    
                    <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                      {wakeUpError || 'The support engine failed to respond. It may be sleeping or undergoing maintenance.'}
                    </p>
                    
                    <button
                      onClick={() => wakeUpBackend(false)}
                      className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition duration-150 flex items-center space-x-2 shadow-lg shadow-rose-950/30 animate-pulse"
                    >
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Retry Connection</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

          {/* PANEL HEADER */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-subtle bg-[#0B0F19]/40 shrink-0">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-semibold text-slate-300">Customer Support Chat</span>
            </div>
            <button
              onClick={handleClearChat}
              className="flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-300 transition duration-150"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          </div>
          {/* CHAT MESSAGES WINDOW */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start space-x-3 max-w-[85%] ${
                  msg.sender === 'user' ? 'ml-auto flex-row-reverse space-x-reverse' : ''
                }`}
              >
                {/* Avatar */}
                <div className={`p-2 rounded-lg shrink-0 ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600/10 border border-indigo-500/20'
                    : msg.sender === 'system'
                      ? 'bg-rose-500/10 border border-rose-500/20'
                      : 'bg-[#1E293B] border border-subtle'
                }`}>
                  {msg.sender === 'user' ? (
                    <User className="w-4 h-4 text-indigo-400" />
                  ) : msg.sender === 'system' ? (
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Bot className="w-4 h-4 text-emerald-400" />
                  )}
                </div>

                {/* Message Bubble */}
                <div className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-5 py-3.5 rounded-2xl text-sm leading-relaxed border ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-slate-100 border-indigo-500/35 backdrop-blur-sm rounded-tr-none'
                      : msg.sender === 'system'
                        ? 'bg-rose-950/20 text-rose-300 border-rose-900/40 rounded-tl-none font-mono text-xs'
                        : 'bg-[#1E293B]/80 text-slate-200 border-subtle rounded-tl-none'
                  }`}>
                    {msg.text}
                    {msg.isStreaming && (
                      <span className="inline-block w-1.5 h-4 ml-1 bg-indigo-400 animate-pulse align-middle" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {/* THINKING INDICATOR */}
            {isThinking && (
              <div className="flex items-start space-x-3 max-w-[85%]">
                <div className="p-2 rounded-lg bg-[#1E293B] border border-subtle shrink-0">
                  <Bot className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex flex-col items-start">
                  <div className="px-5 py-3.5 bg-[#1E293B]/50 border border-subtle/80 rounded-2xl rounded-tl-none flex items-center space-x-2">
                    <span className="text-xs text-slate-400 font-medium animate-pulse-slow">Agent evaluating policy...</span>
                    <div className="flex space-x-1">
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* QUICK CHIPS SCENARIOS */}
          <div className="px-6 py-2.5 border-t border-subtle bg-[#0B0F19]/40 shrink-0">
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-thin">
              <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase shrink-0">Scenarios:</span>
              {demoScenarios.map((scen, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(scen.text)}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#1E293B] border border-subtle hover:border-indigo-500/40 hover:bg-indigo-950/20 text-slate-300 hover:text-indigo-300 transition duration-150 shrink-0"
                >
                  {scen.label}
                </button>
              ))}
            </div>
          </div>

          {/* CHAT INPUT AREA */}
          <div className="p-4 border-t border-subtle bg-[#0B0F19]/60 backdrop-blur-sm shrink-0">
            <div className="flex items-center space-x-3 bg-[#131B2E] border border-subtle rounded-xl p-2 focus-within:border-indigo-500/40 transition duration-200">

              {/* Voice Mic Button */}
              <button
                type="button"
                onClick={handleMicToggle}
                className={`p-2.5 rounded-lg border transition duration-200 ${
                  isRecording
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse'
                    : 'bg-[#1E293B] border-subtle hover:border-slate-600 text-slate-400 hover:text-slate-300'
                }`}
                title={isRecording ? "Click to finish speaking" : "Stream microphone voice query"}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <input
                type="text"
                placeholder={isRecording ? "Listening to your voice... Speak now!" : "Ask for a refund (e.g. 'I am Alice Smith CUST-001. Return ORD-1001')"}
                value={isRecording ? "[Listening...] Click the microphone button again when finished speaking." : inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                disabled={isRecording}
                className="flex-1 bg-transparent text-sm focus:outline-none text-slate-200 placeholder-slate-600 disabled:text-slate-500"
              />

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isRecording}
                className="p-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-[#1E293B]/50 disabled:text-slate-600 border border-indigo-500/20 disabled:border-transparent transition duration-200"
              >
                <Send className="w-4 h-4" />
              </button>

            </div>
          </div>
        </section>

        {/* RIGHT PANEL: LIVE TELEMETRY & REASONING LOGS */}
        <section className={`flex-col flex-1 bg-[#131B2E] min-h-0 min-w-0 ${
          mobileTab === 'logs' ? 'flex w-full' : 'hidden'
        } md:flex md:w-1/2`}>

          {/* PANEL HEADER */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-subtle bg-[#0B0F19]/40 shrink-0">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-amber-400 animate-pulse-slow" />
              <span className="text-sm font-semibold text-slate-300">Agent Reasoning Live Logs</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold tracking-wide uppercase font-mono">Live Telemetry</span>
            </div>
          </div>

          {/* TERMINAL VIEWER CONTAINER */}
          <div className="flex-1 overflow-y-auto p-6 bg-[#0B0F19]/25 font-mono text-xs space-y-4">

            {backendState === 'waking' ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-3 font-mono">
                <div className="w-8 h-8 rounded-full border-2 border-slate-800 border-t-indigo-500 animate-spin mb-2" />
                <p className="text-[11px] text-indigo-400">
                  [SYSTEM] Initializing telemetry stream link...
                </p>
                <p className="text-[10px] text-slate-600 text-center max-w-xs leading-relaxed">
                  FastAPI container is starting on Render. Please wait up to 90 seconds.
                </p>
              </div>
            ) : backendState === 'error' ? (
              <div className="flex flex-col items-center justify-center h-full text-rose-500 space-y-3 font-mono">
                <AlertTriangle className="w-8 h-8 text-rose-500 mb-2 animate-pulse" />
                <p className="text-[11px] text-rose-400 font-bold">
                  [SYSTEM ERROR] Connection Failed
                </p>
                <p className="text-[10px] text-slate-600 text-center max-w-xs leading-relaxed">
                  The API server failed to respond. Check console logs or retry using the main panel button.
                </p>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-3">
                <Terminal className="w-10 h-10 text-slate-800" />
                <p className="text-center max-w-xs text-xs">
                  Awaiting websocket connection events... Send a refund request or select a scenario to watch reasoning loops.
                </p>
              </div>
            ) : (
              logs.map((log) => {
                const style = getLogStyle(log);
                return (
                  <div
                    key={log.id}
                    className={`p-5 rounded-lg border transition duration-150 ${style.bg}`}
                  >

                    {/* Log Event Meta Header */}
                    <div className="flex items-start justify-between mb-2.5">
                      <div className="flex items-center space-x-2">
                        {style.icon}
                        <span className="text-[11px] font-semibold text-slate-300 font-sans tracking-wide">
                          {log.tool ? 'Tool: ' : 'Node: '}
                          <span className={`${style.text} font-bold`}>{formatNodeTitle(log)}</span>
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">{log.timestamp}</span>
                    </div>

                    {/* Log Details Content */}
                    <div className={`pl-6 space-y-1.5 ${style.text}`}>

                      {/* Node Started / Tool Started */}
                      {(log.status === 'started' || log.status === 'node_started') && (
                        <div>
                          <span className="text-slate-500">
                            {log.tool ? `↳ Invoking tool with parameters:` : `❖ Entering Node: ${formatNodeTitle(log)}`}
                          </span>
                          {log.arguments && (
                            <pre className="mt-2 bg-[#0B0F19]/60 p-2.5 rounded-lg border border-subtle text-[11px] overflow-x-auto text-slate-400 max-h-40 font-mono">
                              {JSON.stringify(log.arguments, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}

                      {/* Tool Output / Completed */}
                      {log.status === 'completed' && log.telemetry && (
                        <div className="space-y-1">
                          <div>
                            <span className="text-slate-500">✓ Outcome:</span> {log.telemetry.outcome || log.telemetry.output || 'Complete.'}
                          </div>
                          {log.telemetry.arguments && (
                            <div className="text-[10px] text-slate-500 font-sans mt-1">
                              Arguments evaluated: {JSON.stringify(log.telemetry.arguments)}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Node Exit */}
                      {log.status === 'node_completed' && (
                        <div>
                          <span className="text-slate-500">✓ Node completed exit status:</span>
                          {log.output && (
                            <pre className="mt-2 bg-[#0B0F19]/60 p-2.5 rounded-lg border border-subtle text-[11px] overflow-x-auto text-slate-400 max-h-40 font-mono">
                              {JSON.stringify(log.output, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}

                      {/* Error */}
                      {log.status === 'error' && (
                        <div className="flex items-center space-x-2 text-rose-500">
                          <XCircle className="w-4 h-4" />
                          <span>Error: {log.output}</span>
                        </div>
                      )}

                    </div>
                  </div>
                );
              })
            )}

            <div ref={logsEndRef} />
          </div>

          {/* LOWER STATUS AND CONTROLS */}
          <div className="px-6 py-3 border-t border-subtle bg-[#0B0F19]/45 flex items-center justify-between shrink-0">
            <span className="text-[10px] text-slate-500 font-mono">
              Total Log Frames: {logs.length}
            </span>
            <button
              onClick={() => setLogs([])}
              className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-300 transition duration-150 px-2 py-1 bg-[#1E293B] hover:bg-slate-800 rounded-lg border border-subtle"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Terminal</span>
            </button>
          </div>

        </section>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* COLLAPSIBLE SIDE DRAWER FOR CRM DATABASE VIEWER */}
      {showCrmDrawer && (
        <div 
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
          onClick={() => setShowCrmDrawer(false)}
        >
          <div 
            className="w-full sm:max-w-xl bg-[#131B2E] border-l border-subtle h-full flex flex-col shadow-2xl p-4 sm:p-6 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >

            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-subtle pb-4 mb-4">
              <div className="flex items-center space-x-2.5">
                <Database className="w-5 h-5 text-indigo-400" />
                <div>
                  <h2 className="text-md font-bold text-slate-200">CRM Customer Database Seeding</h2>
                  <p className="text-xs text-slate-500">Available profiles & purchase histories</p>
                </div>
              </div>
              <button
                onClick={() => setShowCrmDrawer(false)}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#1E293B] hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-subtle transition duration-150"
              >
                Close
              </button>
            </div>

            {/* Profiles List */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {crmProfiles.length === 0 ? (
                <div className="flex justify-center items-center h-40 text-slate-500 text-xs">
                  No mock CRM profiles found. Is the backend API running?
                </div>
              ) : (
                crmProfiles.map((profile) => (
                  <div
                    key={profile.customer_id}
                    className="p-4 rounded-xl bg-[#0B0F19]/45 border border-subtle hover:border-slate-700/50 transition duration-150"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-bold text-slate-200">{profile.name}</span>
                        <span className="text-[10px] text-slate-500 ml-2 font-mono">{profile.customer_id}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        profile.membership_tier === 'Premium' ? 'bg-purple-500/5 text-purple-400 border-purple-500/20' :
                        profile.membership_tier === 'Gold' ? 'bg-amber-500/5 text-amber-400 border-amber-500/20' :
                        'bg-white/5 text-slate-400 border-white/10'
                      }`}>
                        {profile.membership_tier}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 mb-3">{profile.email}</div>

                    <div className="border-t border-subtle pt-2">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Orders:</span>
                      <div className="mt-1 space-y-2">
                        {profile.orders.map((order) => (
                          <div key={order.order_id} className="p-2 rounded bg-[#131B2E]/60 text-xs border border-subtle flex justify-between items-start">
                            <div className="space-y-0.5">
                              <div className="font-bold text-indigo-400 font-mono">{order.order_id}</div>
                              <div className="text-slate-300 font-semibold">{order.item_name}</div>
                              <div className="text-[10px] text-slate-500">
                                Date: {order.purchase_date} | Condition: <span className={order.item_condition === 'opened' ? 'text-amber-500 font-semibold' : 'text-emerald-500'}>{order.item_condition}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-slate-200">${order.amount.toFixed(2)}</span>
                              <div className="text-[9px] text-slate-500 uppercase">{order.item_category}</div>

                              <button
                                onClick={() => {
                                  const text = `I am ${profile.name} (${profile.customer_id}). I bought ${order.item_name} on order ${order.order_id}. Can I return it?`;
                                  handleSendMessage(text);
                                  setShowCrmDrawer(false);
                                }}
                                className="mt-2 text-[10px] bg-indigo-600/10 hover:bg-indigo-600 text-indigo-300 hover:text-white px-2.5 py-1 rounded-lg border border-indigo-500/20 hover:border-transparent transition duration-150"
                              >
                                Test Scenario
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                ))
              )}
            </div>

            {/* Bottom Note */}
            <div className="border-t border-subtle pt-4 mt-2 flex items-center space-x-2 text-[10px] text-slate-500 font-sans">
              <Info className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span>Use the CUST ID and ORD ID to evaluate refund eligibility against store policies.</span>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
