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
/*  New-chat modal — look up a user by their exact referral code               */
/* -------------------------------------------------------------------------- */
function NewChatModal({ open, onClose, onOpenThread }) {
  const [q, setQ] = useState("");
  const [result, setResult] = useState(null); // { user, relationship, thread_id, request_id }
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [starting, setStarting] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!open) { setQ(""); setResult(null); setErr(""); }
  }, [open]);

  const doSearch = useCallback(async (code) => {
    const raw = (code || "").trim();
    if (!raw) { setResult(null); setErr(""); return; }
    setLoading(true); setErr(""); setResult(null);
    try {
      // The backend exposes exactly one connect-lookup: by exact referral
      // code. It returns the user + our relationship + any existing thread.
      const { data } = await api.get("/chat/search", { params: { code: raw } });
      if (data?.user) setResult(data);
      else setErr(`No user found with referral code "${raw}".`);
    } catch (e) {
      const s = e?.response?.status;
      if (s === 404) {
        const looksLikeEmail = raw.includes("@");
        const looksLikeName = /\s/.test(raw) || (!looksLikeEmail && /[^A-Za-z0-9]/.test(raw));
        setErr(
          looksLikeEmail || looksLikeName
            ? `Users can only be found by their exact referral code (e.g. EARN), not by name or email. Ask "${raw}" to share their referral code.`
            : `No user found with referral code "${raw}". Double-check the exact code.`
        );
      } else {
        setErr(e?.response?.data?.detail || "Search failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    clearTimeout(debounceRef.current);
    if (!q.trim()) { setResult(null); setErr(""); return; }
    debounceRef.current = setTimeout(() => doSearch(q), 400);
    return () => clearTimeout(debounceRef.current);
  }, [q, open, doSearch]);

  const startChat = async () => {
    if (!result?.user) return;
    setErr(""); setStarting(true);
    const u = result.user;
    try {
      if (result.thread_id) {
        onOpenThread({ id: result.thread_id, other: u });
        onClose();
        return;
      }
      const { data } = await api.post("/chat/threads", { other_user_id: u.id });
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

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()} data-testid="new-chat-modal">
        <div className="p-4 border-b border-[color:var(--sc-border)] flex items-center justify-between">
          <div>
            <div className="font-extrabold text-[color:var(--sc-ink)]">Start a new chat</div>
            <div className="text-[11px] text-[color:var(--sc-ink-muted)]">Enter the person's exact referral code (e.g. EARN)</div>
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
              onChange={(e) => setQ(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") doSearch(q); }}
              data-testid="new-chat-search"
              placeholder="Referral code"
              className="flex-1 text-sm bg-transparent outline-none uppercase tracking-wide"
            />
            {loading && <Loader2 size={14} className="animate-spin text-[color:var(--sc-ink-muted)]" />}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {err && <div className="p-3 text-xs text-[color:var(--sc-error)]" data-testid="new-chat-err">{err}</div>}
          {!q.trim() && !result && (
            <div className="p-8 text-center text-sm text-[color:var(--sc-ink-muted)]">
              Type a <b>referral code</b> to find that user, then tap <b>Chat</b>.
            </div>
          )}
          {result?.user && (
            <button
              onClick={startChat}
              disabled={starting}
              data-testid={`new-chat-user-${result.user.id || result.user.referral_code}`}
              className="w-full text-left px-3 py-3 flex items-center gap-2.5 border-b border-[color:var(--sc-border)]/60 hover:bg-[color:var(--sc-accent-light)]/60 disabled:opacity-60"
            >
              <div className="w-11 h-11 rounded-full sc-avatar text-white text-sm font-bold grid place-items-center overflow-hidden">
                {result.user.profile_image ? <img alt="" src={result.user.profile_image} className="w-full h-full object-cover" /> : initials(result.user.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold truncate">{result.user.name || "User"}</div>
                <div className="text-[11px] text-[color:var(--sc-ink-muted)] truncate">
                  Code: {result.user.referral_code}
                  {result.user.is_vendor ? " · Vendor" : ""}
                  {result.relationship === "already_chatting" ? " · Already chatting" : ""}
                </div>
              </div>
              <span className="text-xs font-bold text-[color:var(--sc-primary)] inline-flex items-center gap-1">
                {starting ? <Loader2 size={12} className="animate-spin" /> : <MessageCircle size={12} />}
                {result.thread_id ? "Open" : "Chat"} →
              </span>
            </button>
          )}
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
