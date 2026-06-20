import { createClient } from "@/lib/supabase/server";
import { MOCK_CHANNELS, PREVIEW_MODE } from "@/lib/mock";
import type { Channel } from "@/lib/types";

export async function getChannels(): Promise<Channel[]> {
  if (PREVIEW_MODE) return MOCK_CHANNELS;

  const supabase = await createClient();
  const { data } = await supabase
    .from("channels")
    .select("*")
    .order("created_at", { ascending: true });
  return (data as Channel[]) ?? [];
}
