import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import EmptyState from "@/components/EmptyState";
import useChatThread from "@/hooks/useChatThread";
import { useAuth } from "@/context/AuthContext";
import { formatDateTime, initials } from "@/lib/utils";
import { Send, ArrowLeft, ImagePlus, MessageCircle, Search, Plus, X, Loader2 } from "lucide-react";
import { CHAT_MAX_IMAGE_BYTES } from "@/constants/config";
import { log } from "@/lib/log";

/* -------------------------------------------------------------------------- */
/*  Utilities — resolve thread's "other" party even if API only returns id     */
/* -------------------------------------------------------------------------- */
function otherOf(thread, meId) {
  // Prefer already-populated `other`, fall back to participants list.
  if (thread?.other && (thread.other.name || thread.other.email || thread.other.id)) return thread.other;
  const parts = Array.isArray(thread?.participants) ? thread.participants : [];
  return parts.find((p) => p?.id !== meId) || {};
}

/* -------------------------------------------------------------------------- */
/*  Message bubble                                                             */
/* -------------------------------------------------------------------------- */
function MessageBubble({ message, mine }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 ${
          mine
            ? "bg-[color:var(--sc-primary)] text-white rounded-br-sm"
            : "bg-white border border-[color:var(--sc-border)] rounded-bl-sm"
        }`}
        data-testid={`msg-${message.id}`}
      >
        {message.image_data_url && (
          <img alt="" src={message.image_data_url} className="rounded-lg mb-1 max-h-64" />
        )}
        {message.deleted_for_everyone || message.deleted ? (
          <div className="text-xs italic opacity-70">message deleted</div>
        ) : (
          <div className="text-sm whitespace-pre-wrap break-words">{message.text}</div>
        )}
        <div className={`text-[10px] mt-1 ${mine ? "text-white/70" : "text-[color:var(--sc-ink-muted)]"}`}>
          {formatDateTime(message.created_at)}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Thread list item (with unread badge + avatar + last-message preview)       */
/* -------------------------------------------------------------------------- */
function ThreadListItem({ thread, meId, active, onSelect }) {
  const other = otherOf(thread, meId);
  const last = thread.last_message;
  const unread = Number(thread.unread_count || thread.unread || 0);
  const preview = last?.deleted
    ? "Message deleted"
    : last?.text || (last?.image_data_url || last?.image ? "📷 Image" : "—");

  return (
    <button
      onClick={() => onSelect(thread)}
      data-testid={`thread-${thread.id}`}
      className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 border-b border-[color:var(--sc-border)]/60 ${
        active ? "bg-[color:var(--sc-accent-light)]" : "hover:bg-[color:var(--sc-accent-light)]/60"
      }`}
    >
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-full sc-avatar text-white text-xs font-bold grid place-items-center overflow-hidden">
          {other.profile_image ? (
            <img alt="" src={other.profile_image} className="w-full h-full object-cover" />
          ) : (
            initials(other.name)
          )}
        </div>
        {unread > 0 && (
          <span
            data-testid={`thread-${thread.id}-unread`}
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[color:var(--sc-primary)] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div className={`text-sm truncate ${unread > 0 ? "font-extrabold text-[color:var(--sc-ink)]" : "font-semibold"}`}>
            {other.name || "User"}
          </div>
        </div>
        <div className={`text-xs truncate ${unread > 0 ? "text-[color:var(--sc-ink)] font-semibold" : "text-[color:var(--sc-ink-muted)]"}`}>
          {preview}
        </div>
      </div>
      {last?.created_at && (
        <div className="text-[10px] text-[color:var(--sc-ink-muted)] whitespace-nowrap shrink-0">
          {formatDateTime(last.created_at)}
        </div>
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  New-chat modal — search users to start a chat                              */
/* -------------------------------------------------------------------------- */
function NewChatModal({ open, onClose, onOpenThread }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [starting, setStarting] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!open) { setQ(""); setResults([]); setErr(""); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!q.trim()) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true); setErr("");
      const needle = q.trim();
      const collected = [];
      const seen = new Set();
      // Try every plausible search endpoint on the upstream backend.
      const attempts = [
        ["/users/search", { q: needle, limit: 20 }],
        ["/chat/users/search", { q: needle, limit: 20 }],
        ["/admin/users", { q: needle, limit: 20 }],
        ["/users", { q: needle, limit: 20 }],
      ];
      for (const [p, params] of attempts) {
        try {
          const res = await api.get(p, { params });
          const arr = Array.isArray(res.data) ? res.data : res.data?.users || res.data?.items || [];
          for (const u of arr) {
            const key = u.id || u.email || u.referral_code;
            if (!key || seen.has(key)) continue;
            // Only include users whose fields actually match the query (some endpoints ignore `q`).
            const bag = `${u.name || ""} ${u.email || ""} ${u.referral_code || ""}`.toLowerCase();
            if (bag.includes(needle.toLowerCase())) {
              seen.add(key);
              collected.push(u);
            }
          }
          if (collected.length > 0) break;
        } catch (e) {
          const s = e?.response?.status;
          if (s && s !== 404 && s !== 405 && s !== 501 && s !== 403) {
            log.error("NewChat.search fallthrough", p, e);
          }
        }
      }
      setResults(collected);
      setLoading(false);
    }, 320);
    return () => clearTimeout(debounceRef.current);
  }, [q, open]);

  const startChatWith = async (u) => {
    setErr(""); setStarting(true);
    try {
      const body = u.id ? { user_id: u.id } : (u.referral_code ? { referral_code: u.referral_code } : { email: u.email });
      const { data } = await api.post("/chat/threads", body);
      const threadId = data?.id || data?.thread_id || data?.thread?.id;
      if (threadId) {
        onOpenThread({ id: threadId, other: u });
        onClose();
        return;
      }
      setErr("Backend didn't return a thread id — check /chat/threads response.");
    } catch (e) {
      setErr(e?.response?.data?.detail || "Could not start chat.");
    } finally {
      setStarting(false);
    }
  };

  // Direct-start fallback — when the user has an exact referral code / email
  // but our search endpoints didn't return anything.
  const startByRawInput = async () => {
    const raw = q.trim();
    if (!raw) return;
    setErr(""); setStarting(true);
    // Guess whether it looks like an email or a referral code.
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
    const bodies = isEmail
      ? [{ email: raw }, { referral_code: raw }]
      : [{ referral_code: raw }, { email: raw }];
    for (const body of bodies) {
      try {
        const { data } = await api.post("/chat/threads", body);
        const threadId = data?.id || data?.thread_id || data?.thread?.id;
        if (threadId) {
          onOpenThread({ id: threadId, other: { name: raw, referral_code: !isEmail ? raw : undefined, email: isEmail ? raw : undefined } });
          onClose();
          setStarting(false);
          return;
        }
      } catch (e) {
        const s = e?.response?.status;
        if (s && s !== 404 && s !== 400 && s !== 422) {
          setErr(e?.response?.data?.detail || "Could not start chat.");
          setStarting(false);
          return;
        }
      }
    }
    setErr(`No user found with "${raw}". Ask them to share their exact referral code.`);
    setStarting(false);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()} data-testid="new-chat-modal">
        <div className="p-4 border-b border-[color:var(--sc-border)] flex items-center justify-between">
          <div>
            <div className="font-extrabold text-[color:var(--sc-ink)]">Start a new chat</div>
            <div className="text-[11px] text-[color:var(--sc-ink-muted)]">Type an email or exact referral code (e.g. EARN)</div>
          </div>
          <button onClick={onClose} className="text-[color:var(--sc-ink-muted)]" data-testid="new-chat-close">
            <X size={18} />
          </button>
        </div>
        <div className="p-3 border-b border-[color:var(--sc-border)]">
          <div className="flex items-center gap-1.5 border border-[color:var(--sc-border)] rounded-xl px-2.5 py-2">
            <Search size={14} className="text-[color:var(--sc-ink-muted)]" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") startByRawInput(); }}
              data-testid="new-chat-search"
              placeholder="Email or referral code"
              className="flex-1 text-sm bg-transparent outline-none"
            />
            {loading && <Loader2 size={14} className="animate-spin text-[color:var(--sc-ink-muted)]" />}
          </div>
          {q.trim() && !loading && (
            <button
              onClick={startByRawInput}
              disabled={starting}
              data-testid="new-chat-direct-start"
              className="mt-2 w-full sc-btn-primary text-xs inline-flex items-center justify-center gap-1.5 disabled:opacity-70"
            >
              {starting ? <Loader2 size={12} className="animate-spin" /> : <MessageCircle size={12} />}
              Start chat with "<b className="ml-1">{q.trim()}</b>"
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {err && <div className="p-3 text-xs text-[color:var(--sc-error)]" data-testid="new-chat-err">{err}</div>}
          {!q.trim() && !results.length && (
            <div className="p-8 text-center text-sm text-[color:var(--sc-ink-muted)]">
              Type an email or referral code, then tap <b>Start chat</b>.
            </div>
          )}
          {q.trim() && !loading && results.length === 0 && !err && (
            <div className="px-5 py-6 text-center text-xs text-[color:var(--sc-ink-muted)]">
              No live search results — tap <b>Start chat with "{q}"</b> above to open the thread directly.
            </div>
          )}
          {results.map((u) => (
            <button
              key={u.id || u.referral_code || u.email}
              onClick={() => startChatWith(u)}
              data-testid={`new-chat-user-${u.id || u.referral_code}`}
              className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 border-b border-[color:var(--sc-border)]/60 hover:bg-[color:var(--sc-accent-light)]/60"
            >
              <div className="w-9 h-9 rounded-full sc-avatar text-white text-xs font-bold grid place-items-center overflow-hidden">
                {u.profile_image ? <img alt="" src={u.profile_image} className="w-full h-full object-cover" /> : initials(u.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{u.name || "User"}</div>
                <div className="text-[11px] text-[color:var(--sc-ink-muted)] truncate">{u.referral_code || u.email}</div>
              </div>
              <span className="text-xs font-bold text-[color:var(--sc-primary)]">Chat →</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Thread list                                                                */
/* -------------------------------------------------------------------------- */
function ThreadList({ threads, meId, loading, activeId, onSelect }) {
  if (loading) return <Spinner />;
  if (threads.length === 0) {
    return <EmptyState icon={MessageCircle} title="No chats yet" hint="Your conversations will appear here." />;
  }
  return (
    <>
      {threads.map((t) => (
        <ThreadListItem key={t.id} thread={t} meId={meId} active={activeId === t.id} onSelect={onSelect} />
      ))}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Composer                                                                   */
/* -------------------------------------------------------------------------- */
function ChatComposer({ sending, sendError, onSend, onFile, imageData, clearImage }) {
  const [text, setText] = useState("");
  const fileRef = useRef(null);

  const doSend = useCallback(async () => {
    const ok = await onSend({ text, imageData });
    if (ok) setText("");
  }, [onSend, text, imageData]);

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    },
    [doSend]
  );

  return (
    <div className="p-3 border-t border-[color:var(--sc-border)] bg-white">
      {sendError && (
        <div data-testid="chat-send-error" className="text-xs font-semibold text-[color:var(--sc-error)] bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5 mb-2">
          {sendError}
        </div>
      )}
      {imageData && (
        <div className="relative inline-block mb-2">
          <img alt="" src={imageData} className="h-16 rounded-lg" />
          <button onClick={clearImage} className="absolute -top-1 -right-1 w-5 h-5 bg-black/70 text-white rounded-full text-xs">×</button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input type="file" accept="image/*" hidden ref={fileRef} onChange={onFile} />
        <button
          data-testid="chat-attach"
          onClick={() => fileRef.current?.click()}
          className="w-10 h-10 rounded-xl border border-[color:var(--sc-border)] grid place-items-center text-[color:var(--sc-ink-muted)] hover:bg-[color:var(--sc-accent-light)]"
        >
          <ImagePlus size={18} />
        </button>
        <textarea
          data-testid="chat-input"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message…"
          className="sc-input flex-1 resize-none max-h-32"
        />
        <button
          data-testid="chat-send"
          onClick={doSend}
          disabled={sending || (!text.trim() && !imageData)}
          className="sc-btn-primary px-3"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

function ConversationHeader({ thread, meId, onBack }) {
  const other = otherOf(thread, meId);
  return (
    <div className="p-3 border-b border-[color:var(--sc-border)] flex items-center gap-2">
      <button className="lg:hidden" onClick={onBack} data-testid="chat-back">
        <ArrowLeft size={18} />
      </button>
      <div className="w-9 h-9 rounded-full sc-avatar text-white text-xs font-bold grid place-items-center overflow-hidden">
        {other.profile_image ? (
          <img alt="" src={other.profile_image} className="w-full h-full object-cover" />
        ) : (
          initials(other.name)
        )}
      </div>
      <div className="min-w-0">
        <div className="font-extrabold text-sm truncate">{other.name || "User"}</div>
        <div className="text-[11px] text-[color:var(--sc-ink-muted)]">
          {other.referral_code || other.email || (other.last_seen ? `last seen ${formatDateTime(other.last_seen)}` : "")}
        </div>
      </div>
    </div>
  );
}

function MessageList({ messages, loading, currentUserId }) {
  if (loading && messages.length === 0) return <Spinner />;
  return (
    <>
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} mine={m.sender_id === currentUserId} />
      ))}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */
export default function Chat() {
  const { user } = useAuth();
  const meId = user?.id;
  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [active, setActive] = useState(null);
  const [imageData, setImageData] = useState("");
  const [q, setQ] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const { messages, loading: loadingMsgs, sending, sendError, scrollerRef, send, refresh } = useChatThread(active?.id || null);

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const { data } = await api.get("/chat/threads");
      const list = Array.isArray(data?.threads) ? data.threads : Array.isArray(data) ? data : data?.items || [];
      // Sort newest activity first.
      list.sort((a, b) => new Date(b.last_message?.created_at || b.updated_at || 0) - new Date(a.last_message?.created_at || a.updated_at || 0));
      setThreads(list);
    } catch (error) {
      log.error("Chat.loadThreads failed", error);
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  // Keep thread list in sync with mobile app — refresh every 20s.
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && loadThreads(), 20000);
    return () => clearInterval(t);
  }, [loadThreads]);

  const filteredThreads = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return threads;
    return threads.filter((t) => {
      const o = otherOf(t, meId);
      const bag = [o.name, o.email, o.referral_code, t.last_message?.text].filter(Boolean).join(" ").toLowerCase();
      return bag.includes(needle);
    });
  }, [threads, q, meId]);

  const onFile = useCallback((e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > CHAT_MAX_IMAGE_BYTES) {
      alert("Image must be under 3MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result?.toString() || "");
    reader.readAsDataURL(f);
  }, []);

  const handleSend = useCallback(
    async ({ text }) => {
      const ok = await send({ text, imageData });
      if (ok) {
        setImageData("");
        loadThreads(); // refresh preview + unread instantly
      }
      return ok;
    },
    [send, imageData, loadThreads]
  );

  const openThread = useCallback((thread) => {
    setActive(thread);
    // Optimistically clear unread on selection.
    setThreads((prev) => prev.map((t) => (t.id === thread.id ? { ...t, unread_count: 0 } : t)));
  }, []);

  return (
    <Layout title="Slang-Connect">
      <div className="sc-card overflow-hidden flex h-[calc(100vh-200px)] min-h-[500px]">
        <aside className={`w-full lg:w-80 border-r border-[color:var(--sc-border)] flex-col ${active ? "hidden lg:flex" : "flex"}`}>
          <div className="p-3 border-b border-[color:var(--sc-border)] flex items-center gap-2">
            <div className="font-extrabold text-sm flex-1">Chats</div>
            <button
              onClick={() => setNewChatOpen(true)}
              data-testid="chat-new"
              title="Start new chat"
              className="w-8 h-8 rounded-lg bg-[color:var(--sc-primary)] text-white grid place-items-center hover:opacity-90"
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="p-2 border-b border-[color:var(--sc-border)]/60">
            <div className="flex items-center gap-1.5 border border-[color:var(--sc-border)] rounded-lg px-2 py-1.5">
              <Search size={13} className="text-[color:var(--sc-ink-muted)]" />
              <input
                data-testid="chat-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search chats"
                className="flex-1 text-xs bg-transparent outline-none"
              />
              {q && (
                <button onClick={() => setQ("")} className="text-[color:var(--sc-ink-muted)] hover:text-[color:var(--sc-ink)]">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto" data-testid="thread-list">
            <ThreadList threads={filteredThreads} meId={meId} loading={loadingThreads} activeId={active?.id} onSelect={openThread} />
          </div>
        </aside>

        <section className={`flex-1 flex-col ${active ? "flex" : "hidden lg:flex"}`}>
          {!active ? (
            <div className="flex-1 grid place-items-center">
              <EmptyState icon={MessageCircle} title="Pick a chat" hint="Select a conversation from the list or start a new chat." />
            </div>
          ) : (
            <>
              <ConversationHeader thread={active} meId={meId} onBack={() => setActive(null)} />
              <div
                ref={scrollerRef}
                className="flex-1 overflow-y-auto p-4 space-y-2 bg-[color:var(--sc-bg)]"
                data-testid="messages-pane"
              >
                <MessageList messages={messages} loading={loadingMsgs} currentUserId={meId} />
              </div>
              <ChatComposer
                sending={sending}
                sendError={sendError}
                onSend={handleSend}
                onFile={onFile}
                imageData={imageData}
                clearImage={() => setImageData("")}
              />
            </>
          )}
        </section>
      </div>

      <NewChatModal
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onOpenThread={(t) => {
          openThread(t);
          loadThreads();
          setTimeout(refresh, 300);
        }}
      />
    </Layout>
  );
}
