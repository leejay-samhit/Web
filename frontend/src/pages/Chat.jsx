import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { useAuth } from "@/context/AuthContext";
import { formatDateTime, initials } from "@/lib/utils";
import { Send, ArrowLeft, ImagePlus, MessageCircle } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { log } from "@/lib/log";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const POLL_INTERVAL_MS = 8000;

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

function ThreadListItem({ thread, active, onSelect }) {
  const other = thread.other || {};
  const last = thread.last_message;
  return (
    <button
      onClick={() => onSelect(thread)}
      data-testid={`thread-${thread.id}`}
      className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 border-b border-[color:var(--sc-border)]/60 ${
        active ? "bg-[color:var(--sc-accent-light)]" : "hover:bg-[color:var(--sc-accent-light)]/60"
      }`}
    >
      <div className="w-10 h-10 rounded-full sc-avatar text-white text-xs font-bold grid place-items-center overflow-hidden">
        {other.profile_image ? (
          <img alt="" src={other.profile_image} className="w-full h-full object-cover" />
        ) : (
          initials(other.name)
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">{other.name || "User"}</div>
        <div className="text-xs text-[color:var(--sc-ink-muted)] truncate">
          {last?.deleted ? "Message deleted" : last?.text || (last?.image_data_url ? "📷 Image" : "—")}
        </div>
      </div>
      {last?.created_at && (
        <div className="text-[10px] text-[color:var(--sc-ink-muted)] whitespace-nowrap">
          {formatDateTime(last.created_at)}
        </div>
      )}
    </button>
  );
}

export default function Chat() {
  const { user } = useAuth();
  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [imageData, setImageData] = useState("");
  const scrollerRef = useRef(null);
  const fileRef = useRef(null);

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const { data } = await api.get("/chat/threads");
      setThreads(data?.threads || []);
    } catch (error) {
      log.error("Chat.loadThreads failed", error);
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  const loadMessages = useCallback(async (threadId) => {
    setLoadingMsgs(true);
    try {
      const { data } = await api.get(`/chat/${threadId}/messages`, { params: { limit: 100 } });
      const arr = Array.isArray(data) ? data : data?.messages || data?.items || [];
      const sorted = arr.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      setMessages(sorted);
      setTimeout(() => {
        scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
      }, 50);
    } catch (error) {
      log.error("Chat.loadMessages failed", error);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (!active?.id) return undefined;
    loadMessages(active.id);
    const t = setInterval(() => loadMessages(active.id), POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [active?.id, loadMessages]);

  const send = useCallback(async () => {
    if (!active) return;
    const t = text.trim();
    if (!t && !imageData) return;
    setSending(true);
    try {
      await api.post(`/chat/${active.id}/messages`, {
        text: t,
        image_data_url: imageData || "",
        client_dedupe_key: `${active.id}-${Date.now()}`,
      });
      setText("");
      setImageData("");
      await loadMessages(active.id);
    } catch (error) {
      log.error("Chat.send failed", error);
    } finally {
      setSending(false);
    }
  }, [active, text, imageData, loadMessages]);

  const onFile = useCallback((e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_IMAGE_BYTES) {
      alert("Image must be under 3MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result?.toString() || "");
    reader.readAsDataURL(f);
  }, []);

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    [send]
  );

  return (
    <Layout title="Slang-Connect">
      <div className="sc-card overflow-hidden flex h-[calc(100vh-200px)] min-h-[500px]">
        {/* Threads list */}
        <aside className={`w-full lg:w-80 border-r border-[color:var(--sc-border)] flex-col ${active ? "hidden lg:flex" : "flex"}`}>
          <div className="p-3 border-b border-[color:var(--sc-border)] font-extrabold text-sm">Chats</div>
          <div className="flex-1 overflow-y-auto" data-testid="thread-list">
            {loadingThreads ? (
              <Spinner />
            ) : threads.length === 0 ? (
              <EmptyState icon={MessageCircle} title="No chats yet" hint="Your conversations will appear here." />
            ) : (
              threads.map((t) => (
                <ThreadListItem
                  key={t.id}
                  thread={t}
                  active={active?.id === t.id}
                  onSelect={setActive}
                />
              ))
            )}
          </div>
        </aside>

        {/* Conversation */}
        <section className={`flex-1 flex-col ${active ? "flex" : "hidden lg:flex"}`}>
          {!active ? (
            <div className="flex-1 grid place-items-center">
              <EmptyState icon={MessageCircle} title="Pick a chat" hint="Select a conversation from the list to view messages." />
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-[color:var(--sc-border)] flex items-center gap-2">
                <button className="lg:hidden" onClick={() => setActive(null)} data-testid="chat-back">
                  <ArrowLeft size={18} />
                </button>
                <div className="w-9 h-9 rounded-full sc-avatar text-white text-xs font-bold grid place-items-center overflow-hidden">
                  {active.other?.profile_image ? (
                    <img alt="" src={active.other.profile_image} className="w-full h-full object-cover" />
                  ) : (
                    initials(active.other?.name)
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-sm truncate">{active.other?.name}</div>
                  <div className="text-[11px] text-[color:var(--sc-ink-muted)]">{active.other?.referral_code}</div>
                </div>
              </div>

              <div ref={scrollerRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-[color:var(--sc-bg)]" data-testid="messages-pane">
                {loadingMsgs && messages.length === 0 ? (
                  <Spinner />
                ) : (
                  messages.map((m) => (
                    <MessageBubble key={m.id} message={m} mine={m.sender_id === user?.id} />
                  ))
                )}
              </div>

              <div className="p-3 border-t border-[color:var(--sc-border)] bg-white">
                {imageData && (
                  <div className="relative inline-block mb-2">
                    <img alt="" src={imageData} className="h-16 rounded-lg" />
                    <button onClick={() => setImageData("")} className="absolute -top-1 -right-1 w-5 h-5 bg-black/70 text-white rounded-full text-xs">×</button>
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
                    onClick={send}
                    disabled={sending || (!text.trim() && !imageData)}
                    className="sc-btn-primary px-3"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </Layout>
  );
}
