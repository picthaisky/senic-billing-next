import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../services/apiClient';

type Message = {
  id: string;
  sender: 'user' | 'ai';
  text: string;
};

export default function FloatingAIChat() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', sender: 'ai', text: '' }
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
      const reply = res.data.data?.reply || t('aiChat.fallbackError');
      
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: reply }]);
    } catch (error) {
      console.error('AI Chat Error:', error);
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: t('aiChat.connectionError') }]);
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
    <div className="fixed left-4 bottom-[calc(68px+env(safe-area-inset-bottom,0px)+12px)] md:left-auto md:bottom-6 md:right-6 z-40">
      {/* Chat Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label={t('aiChat.title')}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsOpen(false);
          }}
          className="absolute bottom-16 left-0 md:left-auto md:right-0 w-[calc(100vw-2rem)] sm:w-[390px] max-w-[400px] h-[min(500px,calc(100dvh-10rem))] bg-[var(--color-surface-solid)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-xl)] flex flex-col overflow-hidden animate-fade-in-up origin-bottom-left md:origin-bottom-right"
        >
          {/* Header */}
          <div className="bg-[var(--color-primary)] text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot size={20} />
              <h3 className="font-bold">{t('aiChat.title')}</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label={t('aiChat.closeAria')}
              className="touch-target flex items-center justify-center rounded-lg text-white/80 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto bg-[var(--color-bg)] flex flex-col gap-3">
            {messages.map(msg => {
              const displayText = msg.id === 'welcome' ? t('aiChat.welcome') : msg.text;
              return (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  msg.sender === 'user' 
                    ? 'bg-[var(--color-primary)] text-white rounded-tr-sm' 
                    : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] rounded-tl-sm'
                }`}>
                  {displayText.split('\n').map((line, i) => (
                    <span key={i}>{line}<br/></span>
                  ))}
                </div>
              </div>
              );
            })}
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
              placeholder={t('aiChat.placeholder')}
              className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full px-4 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] transition-colors"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              aria-label={t('aiChat.sendAria')}
              className="w-11 h-11 shrink-0 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isTyping ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? t('aiChat.closeAria') : t('aiChat.openAria')}
        aria-expanded={isOpen}
        className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 ${
          isOpen ? 'bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)]' : 'bg-[var(--color-primary)] text-white'
        }`}
      >
        {isOpen ? <X size={24} /> : <Bot size={24} />}
      </button>
    </div>
  );
}
