"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/store/appStore";
import { useSocket } from "@/hooks/useSocket";
import { Send, X, MessageSquare, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { WSChatMessage } from "@/lib/socket";

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  createdAt: string;
}

interface ChatPanelProps {
  swapId: string;
  otherUser: { id: string; name: string; avatar?: string };
  onClose?: () => void;
  embedded?: boolean; // if true, renders inline rather than as overlay
}

export function ChatPanel({ swapId, otherUser, onClose, embedded }: ChatPanelProps) {
  const { token, user } = useAppStore();
  const { joinSwap, leaveSwap, subscribeToChat } = useSocket();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load history
  useEffect(() => {
    if (!token || !swapId) return;

    fetch(`/api/chat/${swapId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMessages(
            data.map((m: any) => ({
              id: m.id,
              senderId: m.senderId,
              senderName: m.sender?.name ?? "Unknown",
              senderAvatar: m.sender?.avatar,
              text: m.text,
              createdAt: m.createdAt,
            }))
          );
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [swapId, token]);

  // Join WS room + subscribe to incoming messages
  useEffect(() => {
    joinSwap(swapId);

    const unsub = subscribeToChat(swapId, (msg: WSChatMessage) => {
      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [
          ...prev,
          {
            id: msg.id,
            senderId: msg.senderId,
            senderName: msg.senderName,
            senderAvatar: msg.senderAvatar,
            text: msg.text,
            createdAt: msg.createdAt,
          },
        ];
      });
    });

    return () => {
      leaveSwap(swapId);
      unsub();
    };
  }, [swapId, joinSwap, leaveSwap, subscribeToChat]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !token) return;

    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      senderId: user!.id,
      senderName: user!.name,
      senderAvatar: user?.avatar,
      text: trimmed,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setText("");
    setSending(true);

    try {
      const res = await fetch(`/api/chat/${swapId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: trimmed }),
      });

      const saved = await res.json();

      // Replace optimistic message with server message
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? { ...optimistic, id: saved.id ?? m.id } : m))
      );
    } catch {
      // Remove optimistic on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setText(trimmed);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [text, sending, token, swapId, user]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const containerClass = embedded
    ? "flex flex-col bg-white rounded-2xl border border-stone-100 overflow-hidden"
    : "fixed inset-x-0 bottom-0 z-50 flex flex-col bg-white rounded-t-3xl shadow-2xl max-w-lg mx-auto";

  return (
    <div className={containerClass} style={embedded ? {} : { height: "70vh" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50">
        <div className="flex items-center gap-2.5">
          <MessageSquare size={16} className="text-green-600" />
          <div>
            <p className="text-sm font-bold text-stone-800">Chat with {otherUser.name}</p>
            <p className="text-xs text-stone-400">Swap conversation</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-stone-200 flex items-center justify-center transition-colors"
          >
            <X size={16} className="text-stone-500" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-stone-300" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare size={32} className="text-stone-200 mx-auto mb-2" />
            <p className="text-sm text-stone-400">No messages yet</p>
            <p className="text-xs text-stone-300 mt-1">Say hi to coordinate your swap!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${isMine ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                {!isMine && (
                  <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-xs shrink-0 mt-auto">
                    {msg.senderName[0].toUpperCase()}
                  </div>
                )}

                <div className={`max-w-[72%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                  <div
                    className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                      isMine
                        ? "bg-green-600 text-white rounded-tr-sm"
                        : "bg-stone-100 text-stone-800 rounded-tl-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-stone-400 px-1">
                    {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-stone-100 flex items-center gap-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          maxLength={500}
          className="flex-1 bg-stone-100 rounded-xl px-4 py-2.5 text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-all"
        />
        <button
          onClick={sendMessage}
          disabled={!text.trim() || sending}
          className="w-10 h-10 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-40 flex items-center justify-center transition-all active:scale-95"
        >
          {sending ? (
            <Loader2 size={16} className="animate-spin text-white" />
          ) : (
            <Send size={16} className="text-white" />
          )}
        </button>
      </div>
    </div>
  );
}

// Floating chat bubble button
export function ChatBubble({
  swapId,
  otherUser,
  unreadCount = 0,
}: {
  swapId: string;
  otherUser: { id: string; name: string; avatar?: string };
  unreadCount?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 w-14 h-14 bg-green-600 hover:bg-green-700 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95"
      >
        <MessageSquare size={22} className="text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setOpen(false)}
          />
          <ChatPanel
            swapId={swapId}
            otherUser={otherUser}
            onClose={() => setOpen(false)}
          />
        </>
      )}
    </>
  );
}
