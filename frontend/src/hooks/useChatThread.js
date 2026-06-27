import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { log } from "@/lib/log";
import {
  CHAT_POLL_INTERVAL_MS,
  HTTP_FORBIDDEN,
  HTTP_UNAUTHORIZED,
} from "@/constants/config";

/**
 * useChatThread — encapsulates message-loading, polling, and sending
 * for a single thread. Returns the message list and a send() callback.
 *
 * Callers should pass `null` when no thread is selected.
 */
export default function useChatThread(activeThreadId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const scrollerRef = useRef(null);

  const load = useCallback(async (threadId) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/chat/${threadId}/messages`, { params: { limit: 100 } });
      const arr = Array.isArray(data) ? data : data?.messages || data?.items || [];
      const sorted = arr.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      setMessages(sorted);
      setTimeout(() => {
        scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
      }, 50);
    } catch (error) {
      log.error("useChatThread.load failed", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    if (!activeThreadId) return undefined;
    setSendError("");
    load(activeThreadId);
    const t = setInterval(() => load(activeThreadId), CHAT_POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [activeThreadId, load]);

  const send = useCallback(
    async ({ text, imageData }) => {
      if (!activeThreadId) return false;
      const t = (text || "").trim();
      if (!t && !imageData) return false;
      setSending(true);
      setSendError("");
      try {
        await api.post(`/chat/${activeThreadId}/messages`, {
          text: t,
          image_data_url: imageData || "",
          client_dedupe_key: `${activeThreadId}-${Date.now()}`,
        });
        await load(activeThreadId);
        return true;
      } catch (error) {
        log.error("useChatThread.send failed", error);
        const status = error?.response?.status;
        if (status === HTTP_FORBIDDEN) setSendError("You can't reply to this conversation.");
        else if (status === HTTP_UNAUTHORIZED) setSendError("Your session expired. Please re-login.");
        else setSendError(error?.response?.data?.detail || "Couldn't send. Try again.");
        return false;
      } finally {
        setSending(false);
      }
    },
    [activeThreadId, load]
  );

  return { messages, loading, sending, sendError, scrollerRef, send, refresh: () => activeThreadId && load(activeThreadId) };
}
