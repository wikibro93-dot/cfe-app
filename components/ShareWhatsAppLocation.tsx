"use client";

import { MessageCircle } from "lucide-react";

/**
 * Share a dish pickup location on WhatsApp.
 *
 * This is a plain share link (wa.me/?text=...): it opens WhatsApp with a
 * prefilled message containing a Google Maps link to the pickup point, and
 * the user picks who to send it to. The app never reveals anyone's phone
 * number — no number is passed in the link — and the in-app map stays the
 * private default for finding the location.
 */
interface ShareWhatsAppLocationProps {
  latitude: number;
  longitude: number;
  title: string;
  address?: string | null;
}

export function ShareWhatsAppLocation({ latitude, longitude, title, address }: ShareWhatsAppLocationProps) {
  const mapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
  const message = `Pickup location for "${title}"${address ? ` (${address})` : ""}: ${mapsUrl}`;
  const href = `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full border border-green-200 bg-green-50 text-green-700 font-semibold rounded-xl px-4 py-2.5 text-sm hover:bg-green-100 transition-colors"
      >
        <MessageCircle size={16} />
        Share location on WhatsApp
      </a>
      <p className="text-xs text-stone-400 text-center mt-1.5">
        Opens WhatsApp — you choose who to send it to. The app shares no phone numbers.
      </p>
    </div>
  );
}
