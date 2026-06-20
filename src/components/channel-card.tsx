import { Card, StatusBadge } from "@/components/ui";
import { formatPhone } from "@/lib/utils";
import type { Channel } from "@/lib/types";

export function ChannelCard({ channel, action }: { channel: Channel; action?: React.ReactNode }) {
  const isMeta = channel.type === "meta_cloud";
  return (
    <Card className="flex items-center gap-4">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
        <WhatsAppGlyph />
        <span
          className={`absolute -bottom-1 rounded px-1 text-[8px] font-bold leading-tight ${
            isMeta ? "bg-blue-600 text-white" : "bg-gray-700 text-white"
          }`}
        >
          {isMeta ? "Meta" : "WEB"}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-ink">{channel.name}</h3>
        <p className="text-xs text-ink-soft">{formatPhone(channel.phone)}</p>
      </div>

      <StatusBadge status={channel.status} />
      {action ? <div className="shrink-0">{action}</div> : null}
    </Card>
  );
}

function WhatsAppGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.16c-.25.69-1.45 1.32-2 1.36-.51.04-1.16.06-1.87-.12-.43-.11-.99-.33-1.7-.64-2.99-1.29-4.95-4.3-5.1-4.5-.15-.2-1.22-1.62-1.22-3.09 0-1.47.77-2.19 1.05-2.49.27-.3.59-.37.79-.37.2 0 .39 0 .56.01.18.01.42-.07.66.5.25.59.84 2.04.91 2.19.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.61.17.3.76 1.25 1.63 2.02 1.12.99 2.06 1.3 2.36 1.45.3.15.47.12.65-.07.18-.2.74-.86.94-1.16.2-.3.4-.25.66-.15.27.1 1.71.81 2 .96.3.15.5.22.57.34.07.12.07.69-.18 1.38Z" />
    </svg>
  );
}
