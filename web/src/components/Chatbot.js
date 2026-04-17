import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useTheme } from "../App";
import { listChatConversations, sendChatMessage, syncChatConversations } from "../api/chatApi";
import {
  CHAT_HISTORY_KEY,
  OUTFIT_HISTORY_KEY,
  PLANNED_OUTFITS_KEY,
  SAVED_OUTFITS_KEY,
  EVT_ACCESSIBILITY_CHANGED,
} from "../utils/constants";
import {
  loadAnswers,
  loadWardrobe,
  makeLocalStore,
  readDemoAuth,
  readTimeOverride,
  readWeatherOverride,
  userKey,
} from "../utils/userStorage";
import { readAccessibilityPrefs, adaptAiText, effectiveAccessibilityPrefs } from "../utils/accessibilityPrefs";

const GREETING =
  "Hi! I'm AURA. Ask me about outfits, styling, color pairing, or what to wear for any occasion.";
const EMPTY_PROMPT = "Ask me anything about outfits or styling!";
const CLARIFY_PROMPT =
  "Can you tell me more about the occasion or style you are going for?";
const ERROR_MESSAGE = "Something went wrong. Please try again.";
const FALLBACK_MESSAGE =
  "I'm having trouble right now, but a simple neutral outfit is always a safe choice.";
const MAX_CHATS = 30;
const TYPE_SPEED = 12;

const savedOutfitsStore = makeLocalStore(SAVED_OUTFITS_KEY);
const plannedOutfitsStore = makeLocalStore(PLANNED_OUTFITS_KEY);
const outfitHistoryStore = makeLocalStore(OUTFIT_HISTORY_KEY);

const UNCLEAR_QUERIES = new Set([
  "",
  "?",
  "help",
  "advice",
  "style",
  "styling",
  "what",
  "huh",
  "idk",
  "hello",
  "hi",
  "hey",
]);

const OUTFIT_KEYWORDS = [
  "wear",
  "outfit",
  "style",
  "styling",
  "pair",
  "match",
  "look",
  "dress",
  "hoodie",
  "jeans",
  "color",
  "occasion",
  "wedding",
  "office",
  "date",
  "party",
  "casual",
  "formal",
  "shoe",
  "jacket",
  "top",
  "bottom",
  "closet",
];

function getChatStorageKey(user) {
  return userKey(CHAT_HISTORY_KEY, user);
}

function normalizeTimestamp(value, fallback = Date.now()) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse((value || "").toString());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeMessages(messages) {
  const safe = (Array.isArray(messages) ? messages : [])
    .map((message) => ({
      role: message?.role === "assistant" ? "assistant" : "user",
      content: (message?.content || "").toString(),
    }))
    .filter((message) => message.content.trim());

  return safe.length > 0 ? safe : [{ role: "assistant", content: GREETING }];
}

function normalizeChat(chat) {
  const updatedAt = normalizeTimestamp(chat?.updatedAt ?? chat?.updated_at);
  const createdAt = normalizeTimestamp(chat?.createdAt ?? chat?.created_at, updatedAt);
  return {
    id: (chat?.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).toString(),
    title: (chat?.title || "New Chat").toString().trim() || "New Chat",
    messages: normalizeMessages(chat?.messages),
    updatedAt,
    createdAt,
  };
}

function serializeChat(chat) {
  const normalized = normalizeChat(chat);
  return {
    id: normalized.id,
    title: normalized.title,
    messages: normalized.messages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: (message.content || "").toString(),
    })),
    created_at: new Date(normalized.createdAt).toISOString(),
    updated_at: new Date(normalized.updatedAt).toISOString(),
  };
}

function mergeChats(remoteChats, localChats) {
  const merged = new Map();
  for (const chat of [...(Array.isArray(remoteChats) ? remoteChats : []), ...(Array.isArray(localChats) ? localChats : [])]) {
    const normalized = normalizeChat(chat);
    const existing = merged.get(normalized.id);
    if (!existing || normalized.updatedAt >= existing.updatedAt) {
      merged.set(normalized.id, normalized);
    }
  }
  return [...merged.values()]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_CHATS);
}

function loadChats(user) {
  try {
    const raw = localStorage.getItem(getChatStorageKey(user));
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.map(normalizeChat) : [];
  } catch {
    return [];
  }
}

function saveChats(chats, user) {
  try {
    localStorage.setItem(
      getChatStorageKey(user),
      JSON.stringify((Array.isArray(chats) ? chats : []).slice(0, MAX_CHATS).map(normalizeChat))
    );
  } catch {}
}

function migrateLegacyChats(user) {
  const namespacedKey = getChatStorageKey(user);
  if (!user || namespacedKey === CHAT_HISTORY_KEY) return;

  try {
    if (localStorage.getItem(namespacedKey)) return;
    const legacy = localStorage.getItem(CHAT_HISTORY_KEY);
    if (legacy) {
      localStorage.setItem(namespacedKey, legacy);
    }
  } catch {}
}

function getInitialChatState(user) {
  const saved = loadChats(user);
  if (saved.length > 0) {
    return { chats: saved, activeChatId: saved[0].id };
  }

  const fresh = makeChat();
  return { chats: [fresh], activeChatId: fresh.id };
}

function makeChat() {
  const now = Date.now();
  return {
    id: now.toString(36) + Math.random().toString(36).slice(2, 6),
    title: "New Chat",
    messages: [{ role: "assistant", content: GREETING }],
    createdAt: now,
    updatedAt: now,
  };
}

function deriveTitle(messages) {
  const first = messages.find((message) => message.role === "user");
  if (!first) return "New Chat";
  const text = first.content.trim();
  return text.length > 40 ? `${text.slice(0, 40)}...` : text;
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

function normalizeQuery(text) {
  return (text || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
}

function isUnclearPrompt(text) {
  const normalized = normalizeQuery(text);
  if (!normalized) return true;
  if (!/[a-z0-9]/i.test(normalized)) return true;
  if (UNCLEAR_QUERIES.has(normalized)) return true;
  return normalized.length < 3;
}

function looksFashionRelated(text) {
  const normalized = normalizeQuery(text);
  return OUTFIT_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function normalizeCategory(category) {
  const value = (category || "").toString().trim().toLowerCase();
  if (value.startsWith("top")) return "tops";
  if (value.startsWith("bottom")) return "bottoms";
  if (value.startsWith("shoe")) return "shoes";
  if (value.startsWith("outer")) return "outerwear";
  if (value.startsWith("access")) return "accessories";
  return value;
}

function normalizeWardrobeItem(item) {
  return {
    name: (item?.name || "").toString().trim(),
    category: normalizeCategory(item?.category),
    color: (item?.color || "").toString().trim().toLowerCase(),
    fit_type: (item?.fit_type || "").toString().trim().toLowerCase(),
    style_tag: (item?.style_tag || "").toString().trim().toLowerCase(),
  };
}

function summarizeOutfitRecord(record) {
  const itemDetails = Array.isArray(record?.item_details) ? record.item_details : [];
  const items = itemDetails
    .map((item) => (item?.name || item?.label || "").toString().trim())
    .filter(Boolean)
    .slice(0, 5);

  return {
    title: (record?.name || record?.occasion || "").toString().trim(),
    items,
    occasion: (record?.occasion || "").toString().trim(),
    planned_date: (record?.planned_date || "").toString().trim(),
    worn_at: (record?.worn_at || "").toString().trim(),
  };
}

function buildChatContext(user) {
  const wardrobe = loadWardrobe(user).map(normalizeWardrobeItem).filter((item) => item.name);
  const answers = loadAnswers(user) || {};

  return {
    wardrobe: wardrobe.slice(0, 40),
    saved_outfits: savedOutfitsStore.read(user).map(summarizeOutfitRecord).slice(0, 8),
    planned_outfits: plannedOutfitsStore.read(user).map(summarizeOutfitRecord).slice(0, 6),
    recent_history: outfitHistoryStore.read(user).map(summarizeOutfitRecord).slice(0, 6),
    onboarding: {
      style: Array.isArray(answers?.style) ? answers.style.slice(0, 5) : [],
      comfort: Array.isArray(answers?.comfort) ? answers.comfort.slice(0, 5) : [],
      dressFor: Array.isArray(answers?.dressFor) ? answers.dressFor.slice(0, 5) : [],
      bodyType: (answers?.bodyType || "").toString().trim(),
      gender: (answers?.gender || "").toString().trim(),
      heightCm: (answers?.heightCm || "").toString().trim(),
    },
    weather_category: readWeatherOverride() || "",
    time_category: readTimeOverride() || "",
  };
}

function formatList(items) {
  const values = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!values.length) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function describeItem(item) {
  if (!item?.name) return "";
  const name = item.name.trim();
  const color = (item.color || "").trim();
  if (!color || name.toLowerCase().includes(color.toLowerCase())) return name;
  return `${color} ${name}`;
}

function scoreItem(item, stylePrefs, query) {
  let score = 0;
  const normalizedQuery = normalizeQuery(query);
  if (stylePrefs.includes(item.style_tag)) score += 3;
  if (item.color && normalizedQuery.includes(item.color)) score += 1;
  if (item.style_tag && normalizedQuery.includes(item.style_tag)) score += 2;
  if (["black", "white", "gray", "beige", "navy"].includes(item.color)) score += 1;
  return score;
}

function pickBestItem(items, stylePrefs, query) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return [...items]
    .sort((left, right) => scoreItem(right, stylePrefs, query) - scoreItem(left, stylePrefs, query))
    .find(Boolean);
}

function buildLocalFallbackReply(query, context) {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) return EMPTY_PROMPT;
  if (isUnclearPrompt(normalizedQuery)) return CLARIFY_PROMPT;

  const wardrobe = Array.isArray(context?.wardrobe) ? context.wardrobe : [];
  const onboarding = context?.onboarding || {};
  const stylePrefs = Array.isArray(onboarding?.style)
    ? onboarding.style.map((style) => style.toString().trim().toLowerCase()).filter(Boolean)
    : [];
  const dressFor = Array.isArray(onboarding?.dressFor) ? onboarding.dressFor.filter(Boolean) : [];
  const weather = (context?.weather_category || "").toString().trim().toLowerCase();
  const time = (context?.time_category || "").toString().trim().toLowerCase();

  if (looksFashionRelated(normalizedQuery) && wardrobe.length > 0) {
    const tops = wardrobe.filter((item) => item.category === "tops");
    const bottoms = wardrobe.filter((item) => item.category === "bottoms");
    const shoes = wardrobe.filter((item) => item.category === "shoes");
    const outerwear = wardrobe.filter((item) => item.category === "outerwear");
    const accessories = wardrobe.filter((item) => item.category === "accessories");

    const top = pickBestItem(tops, stylePrefs, normalizedQuery);
    const bottom = pickBestItem(bottoms, stylePrefs, normalizedQuery);
    const shoe = pickBestItem(shoes, stylePrefs, normalizedQuery);
    const layer =
      weather === "cold" || weather === "cool"
        ? pickBestItem(outerwear, stylePrefs, normalizedQuery)
        : null;
    const accessory =
      time === "evening" || time === "night"
        ? pickBestItem(accessories, stylePrefs, normalizedQuery)
        : null;

    const pieces = [describeItem(top), describeItem(bottom), describeItem(shoe)].filter(Boolean);
    if (pieces.length > 0) {
      const signals = [];
      if (stylePrefs.length > 0) signals.push(`${formatList(stylePrefs.slice(0, 2))} preferences`);
      if (dressFor.length > 0) signals.push(`${dressFor[0]} occasions`);
      if (weather) signals.push(`${weather} weather`);

      let response = `Based on your wardrobe${
        signals.length ? ` and your ${formatList(signals)}` : ""
      }, I'd start with ${formatList(pieces)}.`;

      if (layer) {
        response += ` Add ${describeItem(layer)} if you want a light extra layer.`;
      }
      if (accessory) {
        response += ` Finish with ${describeItem(accessory)} for a bit of polish.`;
      }
      if (!layer && !accessory) {
        response += " If you want, tell me the occasion and I can refine it further.";
      }
      return response;
    }
  }

  if (normalizedQuery.includes("hoodie")) {
    return "A hoodie works best with one cleaner piece to balance it out, like straight-leg jeans, tailored trousers, or sleek sneakers. Keep the palette simple so the outfit feels intentional instead of bulky.";
  }

  if (
    normalizedQuery.includes("color") ||
    normalizedQuery.includes("pair") ||
    normalizedQuery.includes("match")
  ) {
    return "A reliable color formula is one main color, one neutral, and one accent. If you want an easy win, pair denim, black, white, beige, or gray with a stronger statement shade.";
  }

  if (stylePrefs.length > 0 || dressFor.length > 0) {
    return `A good direction for you is a ${stylePrefs[0] || "clean"} look that feels right for ${
      dressFor[0] || "everyday wear"
    }. Start with simple layers, keep the colors cohesive, and add one standout piece instead of several competing ones.`;
  }

  return FALLBACK_MESSAGE;
}

function renderMarkdown(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="chatbot-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part === "\n") return <br key={index} />;
    return <span key={index}>{part}</span>;
  });
}

function AutoResizeTextarea({ value, onChange, onKeyDown, disabled, inputRef, helperTextId }) {
  const adjustHeight = (element) => {
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 120)}px`;
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
      onChange={(event) => {
        onChange(event);
        adjustHeight(event.target);
      }}
      onKeyDown={onKeyDown}
      placeholder="Ask about outfits, styling, or what to wear..."
      disabled={disabled}
      aria-label="Ask AURA about outfits or styling"
      aria-describedby={helperTextId}
    />
  );
}

function MessageContent({ text }) {
  return <>{renderMarkdown(text)}</>;
}

function TypewriterMessage({ text, onDone }) {
  const [charIndex, setCharIndex] = useState(0);
  const done = charIndex >= text.length;

  useEffect(() => {
    setCharIndex(0);
  }, [text]);

  useEffect(() => {
    if (done) {
      if (onDone) onDone();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCharIndex((current) => current + 1);
    }, TYPE_SPEED);

    return () => window.clearTimeout(timeoutId);
  }, [charIndex, done, text.length, onDone]);

  return (
    <>
      {renderMarkdown(text.slice(0, charIndex))}
      {!done && <span className="chatbot-cursor" />}
    </>
  );
}

export default function Chatbot() {
  const { user } = useAuth();
  const { theme } = useTheme() || {};
  const demoUser = readDemoAuth();
  const effectiveUser = user || demoUser;
  const remoteChatUser = user || null;
  const storageKey = getChatStorageKey(effectiveUser);
  const titleId = "chatbot-title";
  const helperTextId = "chatbot-helper-text";

  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [shareToast, setShareToast] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [typingIdx, setTypingIdx] = useState(-1);
  const [composerStatus, setComposerStatus] = useState("");
  const [accessibilityPrefs, setAccessibilityPrefs] = useState(() => readAccessibilityPrefs(effectiveUser));

  useEffect(() => {
    setAccessibilityPrefs(readAccessibilityPrefs(effectiveUser));
    const onChange = () => setAccessibilityPrefs(readAccessibilityPrefs(effectiveUser));
    window.addEventListener(EVT_ACCESSIBILITY_CHANGED, onChange);
    return () => window.removeEventListener(EVT_ACCESSIBILITY_CHANGED, onChange);
  }, [effectiveUser]);
  const submitLockRef = useRef(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const initialChatStateRef = useRef(null);
  const remoteHydratedRef = useRef(false);
  const lastSyncedPayloadRef = useRef("");
  const lastFocusedElementRef = useRef(null);

  if (!initialChatStateRef.current) {
    initialChatStateRef.current = getInitialChatState(effectiveUser);
  }

  const [chats, setChats] = useState(initialChatStateRef.current.chats);
  const [activeChatId, setActiveChatId] = useState(initialChatStateRef.current.activeChatId);

  useEffect(() => {
    let alive = true;

    migrateLegacyChats(effectiveUser);
    const saved = loadChats(effectiveUser);
    const nextChats = saved.length > 0 ? saved : [makeChat()];
    setChats(nextChats);
    setActiveChatId(nextChats[0].id);
    setInput("");
    setTypingIdx(-1);
    setLoading(false);
    setComposerStatus("");
    submitLockRef.current = false;
    remoteHydratedRef.current = !remoteChatUser;
    lastSyncedPayloadRef.current = JSON.stringify(nextChats.map(serializeChat));

    if (!remoteChatUser) {
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const res = await listChatConversations();
        if (!alive) return;

        const remoteChats = Array.isArray(res?.conversations) ? res.conversations.map(normalizeChat) : [];
        const mergedChats = mergeChats(remoteChats, nextChats);
        const finalChats = mergedChats.length > 0 ? mergedChats : [makeChat()];

        setChats(finalChats);
        setActiveChatId((current) =>
          finalChats.some((chat) => chat.id === current) ? current : finalChats[0].id
        );
        saveChats(finalChats, effectiveUser);
        remoteHydratedRef.current = true;

        const remotePayload = JSON.stringify(remoteChats.map(serializeChat));
        const mergedPayload = JSON.stringify(finalChats.map(serializeChat));
        lastSyncedPayloadRef.current = remotePayload === mergedPayload ? mergedPayload : remotePayload;
      } catch {
        if (!alive) return;
        remoteHydratedRef.current = true;
      }
    })();

    return () => {
      alive = false;
    };
  }, [storageKey, effectiveUser, remoteChatUser]);

  useEffect(() => {
    saveChats(chats, effectiveUser);
  }, [chats, effectiveUser, storageKey]);

  useEffect(() => {
    if (!remoteChatUser || !remoteHydratedRef.current) return;

    const serialized = chats.map(serializeChat);
    const nextPayload = JSON.stringify(serialized);
    if (nextPayload === lastSyncedPayloadRef.current) return;

    const timeoutId = window.setTimeout(async () => {
      try {
        await syncChatConversations(serialized);
        lastSyncedPayloadRef.current = nextPayload;
      } catch {}
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [chats, remoteChatUser]);

  const activeChat = chats.find((chat) => chat.id === activeChatId) || chats[0] || makeChat();
  const messages = useMemo(
    () => activeChat?.messages || [{ role: "assistant", content: GREETING }],
    [activeChat]
  );
  const sortedChats = useMemo(
    () => [...chats].sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0)),
    [chats]
  );

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, typingIdx]);

  useEffect(() => {
    if (open && !showHistory && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open, showHistory, activeChatId]);

  useEffect(() => {
    if (!open) return;

    lastFocusedElementRef.current = document.activeElement;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )].filter((element) => !element.hasAttribute("disabled"));

      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (lastFocusedElementRef.current?.focus) {
        lastFocusedElementRef.current.focus();
      }
    };
  }, [open]);

  const updateActiveChat = useCallback(
    (updater) => {
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === activeChatId
            ? { ...chat, ...updater(chat), updatedAt: Date.now() }
            : chat
        )
      );
    },
    [activeChatId]
  );

  const appendAssistantMessage = useCallback(
    (content, assistantIndex) => {
      updateActiveChat((chat) => ({
        messages: [...chat.messages, { role: "assistant", content }],
      }));
      setTypingIdx(assistantIndex);
    },
    [updateActiveChat]
  );

  const send = useCallback(async () => {
    if (loading || typingIdx >= 0 || submitLockRef.current) return;

    const text = input.trim();
    if (!text) {
      setComposerStatus("");
      appendAssistantMessage(EMPTY_PROMPT, messages.length);
      return;
    }

    if (isUnclearPrompt(text)) {
      const unclearMessages = [
        ...messages,
        { role: "user", content: text },
        { role: "assistant", content: CLARIFY_PROMPT },
      ];
      updateActiveChat(() => ({
        messages: unclearMessages,
        title: deriveTitle(unclearMessages),
      }));
      setInput("");
      setComposerStatus("");
      setTypingIdx(messages.length + 1);
      return;
    }

    const context = buildChatContext(effectiveUser);
    const userMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMessage];

    updateActiveChat(() => ({
      messages: nextMessages,
      title: deriveTitle(nextMessages),
    }));
    setInput("");
    setLoading(true);
    setComposerStatus("");
    submitLockRef.current = true;

    try {
      const data = await sendChatMessage(nextMessages, context);
      const replyText =
        typeof data?.reply === "string" && data.reply.trim()
          ? data.reply.trim()
          : buildLocalFallbackReply(text, context);

      appendAssistantMessage(replyText, nextMessages.length);
    } catch {
      setComposerStatus(ERROR_MESSAGE);
      appendAssistantMessage(buildLocalFallbackReply(text, context), nextMessages.length);
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }, [
    appendAssistantMessage,
    effectiveUser,
    input,
    loading,
    messages,
    typingIdx,
    updateActiveChat,
  ]);

  const handleKey = useCallback(
    (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        send();
      }
    },
    [send]
  );

  const handleTypeDone = useCallback(() => {
    setTypingIdx(-1);
  }, []);

  const startNewChat = useCallback(() => {
    const chat = makeChat();
    setChats((prev) => [chat, ...prev].slice(0, MAX_CHATS));
    setActiveChatId(chat.id);
    setTypingIdx(-1);
    setInput("");
    setComposerStatus("");
    setShowHistory(false);
  }, []);

  const switchToChat = useCallback((id) => {
    setActiveChatId(id);
    setTypingIdx(-1);
    setInput("");
    setComposerStatus("");
    setShowHistory(false);
  }, []);

  const deleteChat = useCallback(
    (id, event) => {
      event.stopPropagation();
      setChats((prev) => {
        const next = prev.filter((chat) => chat.id !== id);
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
    },
    [activeChatId]
  );

  const shareChat = useCallback((chat) => {
    const lines = [`AURA - ${chat.title || "Chat"}`, ""];
    for (const message of chat.messages) {
      if (message.role === "assistant" && message.content === GREETING) continue;
      const label = message.role === "assistant" ? "AURA" : "You";
      lines.push(`${label}: ${message.content}`, "");
    }

    const text = lines.join("\n").trim();

    if (navigator.share) {
      navigator.share({ title: `AURA - ${chat.title || "Chat"}`, text }).catch(() => {});
      return;
    }

    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setShareToast("Copied to clipboard!");
          window.setTimeout(() => setShareToast(""), 2000);
        })
        .catch(() => {});
    }
  }, []);

  return (
    <>
      <button
        className="chatbot-toggle"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Close AURA" : "Open AURA"}
        title="AURA"
      >
        {open ? (
          "\u2715"
        ) : (
          <img src="/fitgpt-logo.png" alt="FitGPT" className="chatbot-toggle-logo" />
        )}
      </button>

      {open && (
        <>
          <div className="chatbot-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            ref={panelRef}
            className="chatbot-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
          <div className="chatbot-header">
            <div className="chatbot-header-top">
              <div className="chatbot-header-left">
                <img src="/fitgpt-logo.png" alt="FitGPT" className="chatbot-header-logo" />
                <div className="chatbot-header-info">
                  <span id={titleId} className="chatbot-header-title">AURA</span>
                  <span className="chatbot-header-sub">
                    <span className="chatbot-status-dot" />
                    Outfit advice and styling help
                  </span>
                </div>
              </div>
              <button
                className="chatbot-header-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
                title="Close"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
            <div className="chatbot-header-actions">
              <button
                className={`chatbot-action-btn${showHistory ? " active" : ""}`}
                onClick={() => setShowHistory((current) => !current)}
                aria-label="Chat history"
                title="Chat history"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
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
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
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
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="M8 3v10M3 8h10" />
                </svg>
                <span>New</span>
              </button>
            </div>
          </div>

          {shareToast && <div className="chatbot-share-toast">{shareToast}</div>}

          {showHistory ? (
            <div className="chatbot-history" aria-label="Past AURA conversations">
              <div className="chatbot-history-title">Past Conversations</div>
              {sortedChats.length === 0 && (
                <div className="chatbot-history-empty">No conversations yet</div>
              )}
              {sortedChats.map((chat) => {
                const messageCount = chat.messages.filter((message) => message.role === "user").length;
                return (
                  <button
                    key={chat.id}
                    className={`chatbot-history-item${chat.id === activeChatId ? " active" : ""}`}
                    onClick={() => switchToChat(chat.id)}
                  >
                    <div className="chatbot-history-item-top">
                      <span className="chatbot-history-item-title">{chat.title || "New Chat"}</span>
                      <div className="chatbot-history-item-actions">
                        <button
                          className="chatbot-history-item-action"
                          onClick={(event) => {
                            event.stopPropagation();
                            shareChat(chat);
                          }}
                          aria-label="Share conversation"
                          title="Share"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M4 12v1a1 1 0 001 1h6a1 1 0 001-1v-1M8 2v8M5 5l3-3 3 3" />
                          </svg>
                        </button>
                        <button
                          className="chatbot-history-item-action chatbot-history-item-delete"
                          onClick={(event) => deleteChat(chat.id, event)}
                          aria-label="Delete conversation"
                          title="Delete"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                    <div className="chatbot-history-item-meta">
                      {messageCount} message{messageCount !== 1 ? "s" : ""} &middot;{" "}
                      {formatRelativeDate(chat.updatedAt)}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div
                className="chatbot-messages"
                role="log"
                aria-live="polite"
                aria-relevant="additions text"
              >
                {messages.map((message, index) => {
                  const effectivePrefs = effectiveAccessibilityPrefs(accessibilityPrefs, theme);
                  const display = message.role === "assistant"
                    ? adaptAiText(message.content, effectivePrefs)
                    : message.content;
                  return (
                    <div key={index} className={`chatbot-row chatbot-row-${message.role}`}>
                      <div className="chatbot-avatar">
                        {message.role === "assistant" ? (
                          <img src="/fitgpt-logo.png" alt="FitGPT" className="chatbot-avatar-logo" />
                        ) : (
                          <div className="chatbot-avatar-user">You</div>
                        )}
                      </div>
                      <div className="chatbot-bubble">
                        <div className="chatbot-sender">
                          {message.role === "assistant" ? "AURA" : "You"}
                        </div>
                        <div className="chatbot-text">
                          {index === typingIdx ? (
                            <TypewriterMessage text={display} onDone={handleTypeDone} />
                          ) : (
                            <MessageContent text={display} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {loading && (
                  <div className="chatbot-row chatbot-row-assistant">
                    <div className="chatbot-avatar">
                      <img src="/fitgpt-logo.png" alt="FitGPT" className="chatbot-avatar-logo" />
                    </div>
                    <div className="chatbot-bubble">
                      <div className="chatbot-sender">AURA</div>
                      <div className="chatbot-typing" aria-label="AURA is typing">
                        <span />
                        <span />
                        <span />
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
                    onChange={(event) => {
                      setInput(event.target.value);
                      if (composerStatus) setComposerStatus("");
                    }}
                    onKeyDown={handleKey}
                    disabled={loading || typingIdx >= 0}
                    inputRef={inputRef}
                    helperTextId={helperTextId}
                  />
                  <button
                    type="button"
                    className={`chatbot-send${input.trim() ? " chatbot-send--ready" : ""}`}
                    onClick={send}
                    disabled={loading || typingIdx >= 0}
                    aria-label="Send message"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M8 12V4M4 7l4-4 4 4" />
                    </svg>
                  </button>
                </div>
                <div
                  id={helperTextId}
                  className={`chatbot-composer-meta${composerStatus ? " is-error" : ""}`}
                  role={composerStatus ? "alert" : "status"}
                  aria-live={composerStatus ? "assertive" : "polite"}
                >
                  {composerStatus || "Press Enter to send. Shift+Enter adds a new line."}
                </div>
              </div>
            </>
          )}
          </div>
        </>
      )}
    </>
  );
}
