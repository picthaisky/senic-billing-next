import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2 } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

type Message = {
  id: string;
  sender: 'user' | 'ai';
  text: string;
};

export default function FloatingAIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', sender: 'ai', text: 'สวัสดีครับ ผมคือ Senic Billing Assistant มีอะไรให้ผมช่วยสรุปหรือวิเคราะห์เกี่ยวกับบัญชีวันนี้ไหมครับ?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const res = await apiClient.post('/AIAssistant/chat', { message: userMsg });
      const reply = res.data.data?.reply || 'ขออภัย ไม่สามารถดึงข้อมูลจาก AI ได้ในขณะนี้';
      
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: reply }]);
    } catch (error) {
      console.error('AI Chat Error:', error);
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Window */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-[350px] sm:w-[400px] h-[500px] bg-[var(--color-surface-solid)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-xl)] flex flex-col overflow-hidden animate-fade-in-up origin-bottom-right">
          {/* Header */}
          <div className="bg-[var(--color-primary)] text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot size={20} />
              <h3 className="font-bold">Senic Billing Assistant</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto bg-[var(--color-bg)] flex flex-col gap-3">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  msg.sender === 'user' 
                    ? 'bg-[var(--color-primary)] text-white rounded-tr-sm' 
                    : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] rounded-tl-sm'
                }`}>
                  {msg.text.split('\n').map((line, i) => (
                    <span key={i}>{line}<br/></span>
                  ))}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[var(--color-text-muted)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-[var(--color-text-muted)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-[var(--color-text-muted)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-[var(--color-surface-solid)] border-t border-[var(--color-border)] flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ถามอะไรฉันสิ..."
              className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full px-4 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isTyping ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-1" />}
            </button>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 ${
          isOpen ? 'bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)]' : 'bg-[var(--color-primary)] text-white'
        }`}
      >
        {isOpen ? <X size={24} /> : <Bot size={24} />}
      </button>
    </div>
  );
}
