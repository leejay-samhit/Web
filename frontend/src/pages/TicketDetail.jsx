import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { formatDateTime } from "@/lib/utils";
import { ArrowLeft, Loader2, Send, X } from "lucide-react";
import { log } from "@/lib/log";

export default function TicketDetail() {
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [attach, setAttach] = useState("");
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/tickets/${id}`);
      setTicket(data);
    } catch (error) {
      log.error("TicketDetail.load failed", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onAttach = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return alert("Attachment must be under 2 MB");
    const r = new FileReader();
    r.onload = () => setAttach(r.result?.toString() || "");
    r.readAsDataURL(f);
  };

  const reply = async () => {
    if (!text.trim() && !attach) return;
    setSending(true);
    try {
      await api.post(`/tickets/${id}/reply`, { message: text.trim(), attachment_b64: attach || undefined });
      setText(""); setAttach("");
      load();
    } catch (error) {
      log.error("TicketDetail.reply failed", error);
    } finally {
      setSending(false);
    }
  };

  const close = async () => {
    if (!window.confirm("Close this ticket?")) return;
    setClosing(true);
    try {
      await api.post(`/tickets/${id}/close`);
      load();
    } catch (error) {
      log.error("TicketDetail.close failed", error);
    } finally {
      setClosing(false);
    }
  };

  if (loading) return <Layout title="Ticket"><Spinner /></Layout>;
  if (!ticket) return <Layout title="Ticket"><div className="sc-card p-6 text-center">Ticket not found.</div></Layout>;

  const messages = ticket.messages || ticket.replies || [];

  return (
    <Layout title={`Ticket #${(ticket.id || "").slice(0, 8)}`}>
      <Link to="/support" className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--sc-ink-muted)] mb-3"><ArrowLeft size={16} /> All tickets</Link>
      <div className="sc-card p-5" data-testid="tk-detail">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-extrabold text-lg">{ticket.subject}</div>
            <div className="text-xs text-[color:var(--sc-ink-muted)]">{ticket.category} · {formatDateTime(ticket.created_at)}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="sc-chip">{ticket.status}</span>
            {ticket.status !== "closed" && (
              <button data-testid="tk-close" onClick={close} disabled={closing} className="sc-btn-outline text-xs py-1.5">
                {closing ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} Close
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 text-sm whitespace-pre-line">{ticket.message}</div>
      </div>

      <div className="mt-4 space-y-3" data-testid="tk-messages">
        {messages.map((m) => (
          <div key={m.id} className={`sc-card p-4 ${m.is_admin || m.from_admin ? "border-l-4 border-l-[color:var(--sc-primary)]" : ""}`} data-testid={`tk-msg-${m.id}`}>
            <div className="flex items-center justify-between text-xs text-[color:var(--sc-ink-muted)]">
              <div className="font-semibold">{m.is_admin || m.from_admin ? "Support" : "You"}</div>
              <div>{formatDateTime(m.created_at)}</div>
            </div>
            <div className="text-sm mt-1 whitespace-pre-line">{m.message || m.text}</div>
            {m.attachment_url && <a href={m.attachment_url} target="_blank" rel="noreferrer" className="text-xs text-[color:var(--sc-primary)] underline">attachment</a>}
          </div>
        ))}
      </div>

      {ticket.status !== "closed" && (
        <div className="sc-card p-4 mt-4" data-testid="tk-reply">
          <textarea className="sc-input min-h-[80px]" data-testid="tk-reply-text" placeholder="Write a reply…" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex items-center justify-between mt-2">
            <input type="file" accept="image/*,application/pdf" onChange={onAttach} data-testid="tk-reply-attach" className="text-sm" />
            <button data-testid="tk-reply-send" onClick={reply} disabled={sending || (!text.trim() && !attach)} className="sc-btn-primary inline-flex items-center gap-1.5">
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
