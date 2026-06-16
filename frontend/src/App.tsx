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
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [showCrmDrawer, setShowCrmDrawer] = useState(false);
  const [crmProfiles, setCrmProfiles] = useState<CustomerProfile[]>([]);

  // Last policy evaluation reason to synthesize refusal in case of routing cut-off
  const policyReasonRef = useRef<string>('');

  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const recordingIntervalRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);

  // Fetch CRM profiles on mount
  useEffect(() => {
    fetchCrmProfiles();
  }, []);

  const fetchCrmProfiles = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/crm/profiles');
      if (response.ok) {
        const data = await response.json();
        setCrmProfiles(data);
      }
    } catch (err) {
      console.error('Failed to fetch CRM profiles:', err);
    }
  };

  // WebSocket Connection Lifecycle
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [clientId]);

  const connectWebSocket = () => {
    setConnectionStatus('connecting');
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = `ws://localhost:8000/ws/chat/${clientId}`;
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      console.log('WebSocket Connected.');
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
      setConnectionStatus('disconnected');
      console.log('WebSocket Disconnected.');
    };

    ws.onerror = (err) => {
      setConnectionStatus('disconnected');
      console.error('WebSocket Error:', err);
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
      alert('WebSocket is currently disconnected. Reconnecting...');
      connectWebSocket();
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

      // 2. Send control message to backend to finalize STT
      wsRef.current?.send(JSON.stringify({ type: 'audio-end' }));
      setIsThinking(true);
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

  // Logic to determine color code of logs
  const getLogStyle = (log: ReasoningLog) => {
    // 1. Check for policy violation/denial (Red)
    const isDenial =
      (log.node === 'finalize_decision' && log.output?.refund_status === 'DENIED') ||
      (log.tool === 'validate_refund_against_policy' && log.status === 'completed' && log.telemetry?.eligible === false);

    if (isDenial) {
      return {
        bg: 'bg-rose-950/30 border-rose-800/80',
        text: 'text-rose-400 font-bold',
        badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
        icon: <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
      };
    }

    // 2. Check for database lookup (Blue)
    const isDbLookup =
      log.tool === 'lookup_customer_profile' ||
      log.tool === 'verify_order_eligibility';

    if (isDbLookup) {
      return {
        bg: 'bg-blue-950/20 border-blue-900/60',
        text: 'text-blue-400',
        badge: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
        icon: <Database className="w-4 h-4 text-blue-400 shrink-0" />
      };
    }

    // 3. Check for general tool call (Yellow)
    if (log.tool) {
      return {
        bg: 'bg-amber-950/20 border-amber-900/60',
        text: 'text-amber-400',
        badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
        icon: <Terminal className="w-4 h-4 text-amber-400 shrink-0" />
      };
    }

    // 4. Default: node transitions (Grey/Green)
    const isComplete = log.status === 'node_completed';
    return {
      bg: 'bg-slate-900/40 border-slate-800/60',
      text: isComplete ? 'text-emerald-400' : 'text-slate-400',
      badge: 'bg-slate-800 text-slate-300 border-slate-700',
      icon: isComplete ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
    };
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-slate-950 overflow-hidden text-slate-100">

      {/* HEADER NAVBAR */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/30">
            <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
              OmniAI Refund Care
            </h1>
            <p className="text-xs text-slate-500 font-medium">Twin-Panel Stream Controller</p>
          </div>
        </div>

        {/* CONNECTION STATUS & SESSION CONTROLLER */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              setShowCrmDrawer(true);
              fetchCrmProfiles();
            }}
            className="flex items-center space-x-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition duration-150"
          >
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            <span>CRM Database Records</span>
          </button>

          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1 text-xs font-mono">
            <span className="text-slate-500">Session ID:</span>
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
              className="bg-transparent text-indigo-300 font-semibold focus:outline-none border-b border-transparent focus:border-indigo-500 w-32 px-1"
              title="Change session ID to test state checkpointer recovery"
            />
          </div>

          <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${
            connectionStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
            connectionStatus === 'connecting' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse' :
            'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}>
            {connectionStatus === 'connected' ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="capitalize">{connectionStatus}</span>
          </div>

          <button
            onClick={connectWebSocket}
            title="Reconnect WebSocket"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition duration-150"
          >
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </header>

      {/* DASHBOARD SPLIT-PANEL LAYOUT */}
      <main className="flex flex-1 flex-row min-h-0 overflow-hidden relative">

        {/* LEFT PANEL: CUSTOMER INTERFACE */}
        <section className="flex flex-col flex-1 border-r border-slate-800 bg-slate-950/40 relative min-h-0 w-1/2 min-w-0">

          {/* PANEL HEADER */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-slate-900 bg-slate-900/10 shrink-0">
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
                <div className={`p-2 rounded-full shrink-0 ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600/20 border border-indigo-500/30'
                    : msg.sender === 'system'
                      ? 'bg-rose-500/20 border border-rose-500/30'
                      : 'bg-slate-800 border border-slate-700'
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
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed border ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white border-indigo-500/50 rounded-tr-none'
                      : msg.sender === 'system'
                        ? 'bg-rose-950/20 text-rose-300 border-rose-900/50 rounded-tl-none font-mono text-xs'
                        : 'bg-slate-900/80 text-slate-200 border-slate-800 rounded-tl-none'
                  }`}>
                    {msg.text}
                    {msg.isStreaming && (
                      <span className="inline-block w-1.5 h-4 ml-1 bg-indigo-400 animate-pulse align-middle" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-600 mt-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {/* THINKING INDICATOR */}
            {isThinking && (
              <div className="flex items-start space-x-3 max-w-[85%]">
                <div className="p-2 rounded-full bg-slate-800 border border-slate-700 shrink-0">
                  <Bot className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex flex-col items-start">
                  <div className="px-4 py-3 bg-slate-900/50 border border-slate-800/80 rounded-2xl rounded-tl-none flex items-center space-x-2">
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
          <div className="px-6 py-2 border-t border-slate-900 bg-slate-950 bg-opacity-80 shrink-0">
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-thin">
              <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase shrink-0">Scenarios:</span>
              {demoScenarios.map((scen, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(scen.text)}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 hover:border-indigo-500 hover:bg-indigo-950/20 text-slate-400 hover:text-indigo-300 transition duration-150 shrink-0"
                >
                  {scen.label}
                </button>
              ))}
            </div>
          </div>

          {/* CHAT INPUT AREA */}
          <div className="p-4 border-t border-slate-900 bg-slate-900/40 backdrop-blur-sm shrink-0">
            <div className="flex items-center space-x-3 bg-slate-950 border border-slate-800 rounded-xl p-2 focus-within:border-indigo-500 transition duration-200">

              {/* Voice Mic Button */}
              <button
                type="button"
                onClick={handleMicToggle}
                className={`p-2.5 rounded-lg border transition duration-200 ${
                  isRecording
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-300'
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
                className="p-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-slate-900 disabled:text-slate-600 transition duration-200"
              >
                <Send className="w-4 h-4" />
              </button>

            </div>
          </div>

        </section>

        {/* RIGHT PANEL: LIVE TELEMETRY & REASONING LOGS */}
        <section className="flex flex-col flex-1 bg-slate-950/60 min-h-0 w-1/2 min-w-0">

          {/* PANEL HEADER */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-slate-900 bg-slate-900/10 shrink-0">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-amber-400 animate-pulse" />
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
          <div className="flex-1 overflow-y-auto p-6 bg-slate-950 font-mono text-xs space-y-3">

            {logs.length === 0 ? (
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
                    className={`p-3.5 rounded-lg border transition duration-150 hover:bg-slate-900/50 ${style.bg}`}
                  >

                    {/* Log Event Meta Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {style.icon}
                        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded border font-semibold tracking-wider font-sans ${style.badge}`}>
                          {log.tool ? `tool: ${log.tool}` : `node: ${log.node}`}
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
                            {log.tool ? `↳ Invoking tool with parameters:` : `❖ Entering Graph Node: ${log.node}`}
                          </span>
                          {log.arguments && (
                            <pre className="mt-1 bg-slate-950 p-2 rounded border border-slate-900 text-[11px] overflow-x-auto text-slate-400 max-h-40">
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
                            <div className="text-[10px] text-slate-500 font-sans">
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
                            <pre className="mt-1 bg-slate-950 p-2 rounded border border-slate-900 text-[11px] overflow-x-auto text-slate-400 max-h-40">
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
          <div className="px-6 py-3 border-t border-slate-900 bg-slate-900/20 flex items-center justify-between shrink-0">
            <span className="text-[10px] text-slate-500 font-mono">
              Total Log Frames: {logs.length}
            </span>
            <button
              onClick={() => setLogs([])}
              className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-300 transition duration-150 px-2 py-1 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Terminal</span>
            </button>
          </div>

        </section>

      </main>

      {/* COLLAPSIBLE SIDE DRAWER FOR CRM DATABASE VIEWER */}
      {showCrmDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl p-6 overflow-hidden">

            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center space-x-2.5">
                <Database className="w-5 h-5 text-indigo-400" />
                <div>
                  <h2 className="text-md font-bold text-slate-200">CRM Customer Database Seeding</h2>
                  <p className="text-xs text-slate-500">Available profiles & purchase histories</p>
                </div>
              </div>
              <button
                onClick={() => setShowCrmDrawer(false)}
                className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
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
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-bold text-slate-200">{profile.name}</span>
                        <span className="text-[10px] text-slate-500 ml-2 font-mono">{profile.customer_id}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        profile.membership_tier === 'Premium' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        profile.membership_tier === 'Gold' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {profile.membership_tier}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 mb-3">{profile.email}</div>

                    <div className="border-t border-slate-900 pt-2">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Orders:</span>
                      <div className="mt-1 space-y-2">
                        {profile.orders.map((order) => (
                          <div key={order.order_id} className="p-2 rounded bg-slate-900/60 text-xs border border-slate-800 flex justify-between items-start">
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
                                className="mt-2 text-[10px] bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white px-2 py-0.5 rounded border border-indigo-500/20 hover:border-transparent transition"
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
            <div className="border-t border-slate-800 pt-4 mt-2 flex items-center space-x-2 text-[10px] text-slate-500 font-sans">
              <Info className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span>Use the CUST ID and ORD ID to evaluate refund eligibility against store policies.</span>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
