import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { sendChatMessage, buildChatContext } from "../api/chatApi";
import { loadWardrobe } from "../utils/userStorage";
import { loadAnswers } from "../utils/userStorage";
import { useAuth } from "../auth/AuthProvider";
import { CHAT_HISTORY_KEY, CURRENT_RECS_KEY } from "../utils/constants";

const GREETING = "Hi! I'm AURA. Ask me anything about the app — features, how-tos, troubleshooting, and more.";
const MAX_CHATS = 30;

// ── Persistence helpers ──

function loadChats() {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveChats(chats) {
  try {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chats.slice(0, MAX_CHATS)));
  } catch {}
}

function makeChat() {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: "New Chat",
    messages: [{ role: "assistant", content: GREETING }],
    updatedAt: Date.now(),
  };
}

/** Derive a short title from the first user message */
function deriveTitle(messages) {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New Chat";
  const text = first.content.trim();
  return text.length > 40 ? text.slice(0, 40) + "..." : text;
}

// ── Sub-components ──

function AutoResizeTextarea({ value, onChange, onKeyDown, disabled, inputRef }) {
  const adjustHeight = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  useEffect(() => {
    adjustHeight(inputRef.current);
  }, [value, inputRef]);

  return (
    <textarea
      ref={inputRef}
      className="chatbot-textarea"
      rows={1}
      value={value}
      onChange={(e) => {
        onChange(e);
        adjustHeight(e.target);
      }}
      onKeyDown={onKeyDown}
      placeholder="Message AURA..."
      disabled={disabled}
    />
  );
}

function renderMarkdown(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="chatbot-inline-code">{part.slice(1, -1)}</code>;
    }
    if (part === "\n") return <br key={i} />;
    return <span key={i}>{part}</span>;
  });
}

function MessageContent({ text }) {
  return <>{renderMarkdown(text)}</>;
}

const TYPE_SPEED = 12;

function TypewriterMessage({ text, onDone }) {
  const [charIndex, setCharIndex] = useState(0);
  const done = charIndex >= text.length;

  useEffect(() => {
    if (done) {
      if (onDone) onDone();
      return;
    }
    const id = setTimeout(() => setCharIndex((c) => c + 1), TYPE_SPEED);
    return () => clearTimeout(id);
  }, [charIndex, done, text.length, onDone]);

  const visible = text.slice(0, charIndex);
  return (
    <>
      {renderMarkdown(visible)}
      {!done && <span className="chatbot-cursor" />}
    </>
  );
}

function formatRelativeDate(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

// ── Main component ──

export default function Chatbot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Chat list & active chat
  const [chats, setChats] = useState(() => {
    const saved = loadChats();
    return saved.length > 0 ? saved : [makeChat()];
  });
  const [activeChatId, setActiveChatId] = useState(() => {
    const saved = loadChats();
    return saved.length > 0 ? saved[0].id : chats[0].id;
  });

  const activeChat = chats.find((c) => c.id === activeChatId) || chats[0];
  const messages = useMemo(
    () => activeChat?.messages || [{ role: "assistant", content: GREETING }],
    [activeChat]
  );

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [typingIdx, setTypingIdx] = useState(-1);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Persist chats whenever they change
  useEffect(() => {
    saveChats(chats);
  }, [chats]);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, typingIdx]);

  useEffect(() => {
    if (open && !showHistory && inputRef.current) inputRef.current.focus();
  }, [open, showHistory, activeChatId]);

  const updateActiveChat = useCallback((updater) => {
    setChats((prev) =>
      prev.map((c) => (c.id === activeChatId ? { ...c, ...updater(c), updatedAt: Date.now() } : c))
    );
  }, [activeChatId]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text };
    const next = [...messages, userMsg];

    updateActiveChat((c) => ({
      messages: next,
      title: deriveTitle(next),
    }));
    setInput("");
    setLoading(true);

    try {
      const wardrobe = loadWardrobe(user);
      const answers = loadAnswers();
      let recommendations = [];
      try { recommendations = JSON.parse(sessionStorage.getItem(CURRENT_RECS_KEY)) || []; } catch {}
      const context = buildChatContext(wardrobe, answers, recommendations);
      const data = await sendChatMessage(next, context);
      const reply = { role: "assistant", content: data.reply };
      updateActiveChat((c) => {
        const updated = [...c.messages, reply];
        return { messages: updated };
      });
      setTypingIdx(next.length); // index of the new assistant message
    } catch {
      const errMsg = { role: "assistant", content: "Sorry, I couldn't reach the server. Please try again." };
      updateActiveChat((c) => {
        const updated = [...c.messages, errMsg];
        return { messages: updated };
      });
      setTypingIdx(next.length);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, updateActiveChat, user]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleTypeDone = useCallback(() => {
    setTypingIdx(-1);
  }, []);

  const startNewChat = () => {
    const chat = makeChat();
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    setTypingIdx(-1);
    setInput("");
    setShowHistory(false);
  };

  const switchToChat = (id) => {
    setActiveChatId(id);
    setTypingIdx(-1);
    setInput("");
    setShowHistory(false);
  };

  const deleteChat = (id, e) => {
    e.stopPropagation();
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) {
        const fresh = makeChat();
        setActiveChatId(fresh.id);
        return [fresh];
      }
      if (id === activeChatId) {
        setActiveChatId(next[0].id);
      }
      return next;
    });
  };

  const [shareToast, setShareToast] = useState("");

  const shareChat = useCallback((chat) => {
    const lines = [`AURA — ${chat.title || "Chat"}`, ""];
    for (const m of chat.messages) {
      if (m.role === "assistant" && m.content === GREETING) continue;
      const label = m.role === "assistant" ? "AURA" : "You";
      lines.push(`${label}: ${m.content}`, "");
    }
    const text = lines.join("\n").trim();

    if (navigator.share) {
      navigator.share({ title: `AURA — ${chat.title}`, text }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setShareToast("Copied to clipboard!");
        setTimeout(() => setShareToast(""), 2000);
      }).catch(() => {});
    }
  }, []);

  // Sort chats by most recent
  const sortedChats = [...chats].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  return (
    <>
      <button
        className="chatbot-toggle"
        onClick={() => setOpen((p) => !p)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        title="AURA"
      >
        {open ? "\u2715" : <img src="/fitgpt-logo.png" alt="FitGPT" className="chatbot-toggle-logo" />}
      </button>

      {open && (
        <div className="chatbot-panel">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-top">
              <div className="chatbot-header-left">
                <img src="/fitgpt-logo.png" alt="FitGPT" className="chatbot-header-logo" />
                <div className="chatbot-header-info">
                  <span className="chatbot-header-title">AURA</span>
                  <span className="chatbot-header-sub">
                    <span className="chatbot-status-dot" />
                    Always available
                  </span>
                </div>
              </div>
              <button
                className="chatbot-header-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
                title="Close"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
            <div className="chatbot-header-actions">
              <button
                className={`chatbot-action-btn${showHistory ? " active" : ""}`}
                onClick={() => setShowHistory((p) => !p)}
                aria-label="Chat history"
                title="Chat history"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="6.5" />
                  <path d="M8 4.5V8l2.5 1.5" />
                </svg>
                <span>History</span>
              </button>
              <button
                className="chatbot-action-btn"
                onClick={() => shareChat(activeChat)}
                aria-label="Share chat"
                title="Share chat"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v1a1 1 0 001 1h6a1 1 0 001-1v-1M8 2v8M5 5l3-3 3 3" />
                </svg>
                <span>Share</span>
              </button>
              <button
                className="chatbot-action-btn"
                onClick={startNewChat}
                aria-label="New chat"
                title="New chat"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M8 3v10M3 8h10" />
                </svg>
                <span>New</span>
              </button>
            </div>
          </div>

          {shareToast && <div className="chatbot-share-toast">{shareToast}</div>}

          {showHistory ? (
            /* ── History sidebar ── */
            <div className="chatbot-history">
              <div className="chatbot-history-title">Past Conversations</div>
              {sortedChats.length === 0 && (
                <div className="chatbot-history-empty">No conversations yet</div>
              )}
              {sortedChats.map((c) => {
                const msgCount = c.messages.filter((m) => m.role === "user").length;
                return (
                  <button
                    key={c.id}
                    className={`chatbot-history-item${c.id === activeChatId ? " active" : ""}`}
                    onClick={() => switchToChat(c.id)}
                  >
                    <div className="chatbot-history-item-top">
                      <span className="chatbot-history-item-title">{c.title || "New Chat"}</span>
                      <div className="chatbot-history-item-actions">
                        <button
                          className="chatbot-history-item-action"
                          onClick={(e) => { e.stopPropagation(); shareChat(c); }}
                          aria-label="Share conversation"
                          title="Share"
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 12v1a1 1 0 001 1h6a1 1 0 001-1v-1M8 2v8M5 5l3-3 3 3" />
                          </svg>
                        </button>
                        <button
                          className="chatbot-history-item-action chatbot-history-item-delete"
                          onClick={(e) => deleteChat(c.id, e)}
                          aria-label="Delete conversation"
                          title="Delete"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                    <div className="chatbot-history-item-meta">
                      {msgCount} message{msgCount !== 1 ? "s" : ""} &middot; {formatRelativeDate(c.updatedAt)}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* ── Chat view ── */
            <>
              <div className="chatbot-messages">
                {messages.map((m, i) => (
                  <div key={i} className={`chatbot-row chatbot-row-${m.role}`}>
                    <div className="chatbot-avatar">
                      {m.role === "assistant" ? (
                        <img src="/fitgpt-logo.png" alt="FitGPT" className="chatbot-avatar-logo" />
                      ) : (
                        <div className="chatbot-avatar-user">You</div>
                      )}
                    </div>
                    <div className="chatbot-bubble">
                      <div className="chatbot-sender">
                        {m.role === "assistant" ? "AURA" : "You"}
                      </div>
                      <div className="chatbot-text">
                        {i === typingIdx ? (
                          <TypewriterMessage text={m.content} onDone={handleTypeDone} />
                        ) : (
                          <MessageContent text={m.content} />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="chatbot-row chatbot-row-assistant">
                    <div className="chatbot-avatar">
                      <img src="/fitgpt-logo.png" alt="FitGPT" className="chatbot-avatar-logo" />
                    </div>
                    <div className="chatbot-bubble">
                      <div className="chatbot-sender">AURA</div>
                      <div className="chatbot-typing">
                        <span /><span /><span />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="chatbot-composer">
                <div className="chatbot-composer-inner">
                  <AutoResizeTextarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    disabled={loading || typingIdx >= 0}
                    inputRef={inputRef}
                  />
                  <button
                    className={`chatbot-send${input.trim() ? " chatbot-send--ready" : ""}`}
                    onClick={send}
                    disabled={loading || typingIdx >= 0 || !input.trim()}
                    aria-label="Send message"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 12V4M4 7l4-4 4 4" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
