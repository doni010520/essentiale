import { createClient } from "@/lib/supabase/server";
import {
  MOCK_DEPARTMENTS,
  MOCK_TAGS,
  MOCK_AGENTS,
  MOCK_QUICK_REPLIES,
  PREVIEW_MODE,
} from "@/lib/mock";
import type {
  Department, Tag, TagScope, Profile, QuickReply,
  SatisfactionSurvey, BusinessHour, AutoMessage,
} from "@/lib/types";

export async function getDepartments(): Promise<Department[]> {
  if (PREVIEW_MODE) return MOCK_DEPARTMENTS;
  const sb = await createClient();
  const { data } = await sb.from("departments").select("*").order("name");
  return (data as Department[]) ?? [];
}

export async function getTags(scope?: TagScope): Promise<Tag[]> {
  if (PREVIEW_MODE) return scope ? MOCK_TAGS.filter((t) => t.scope === scope) : MOCK_TAGS;
  const sb = await createClient();
  let q = sb.from("tags").select("*").order("name");
  if (scope) q = q.eq("scope", scope);
  const { data } = await q;
  return (data as Tag[]) ?? [];
}

export async function getAgents(): Promise<Profile[]> {
  if (PREVIEW_MODE) return MOCK_AGENTS;
  const sb = await createClient();
  const { data } = await sb.from("profiles").select("*").order("name");
  return (data as Profile[]) ?? [];
}

export async function getQuickReplies(kind?: QuickReply["kind"]): Promise<QuickReply[]> {
  if (PREVIEW_MODE) return kind ? MOCK_QUICK_REPLIES.filter((q) => q.kind === kind) : MOCK_QUICK_REPLIES;
  const sb = await createClient();
  let q = sb.from("quick_replies").select("*").order("title");
  if (kind) q = q.eq("kind", kind);
  const { data } = await q;
  return (data as QuickReply[]) ?? [];
}

export async function getSurveys(): Promise<SatisfactionSurvey[]> {
  if (PREVIEW_MODE) return [];
  const sb = await createClient();
  const { data } = await sb.from("satisfaction_surveys").select("*").order("created_at");
  return (data as SatisfactionSurvey[]) ?? [];
}

export async function getBusinessHours(): Promise<BusinessHour[]> {
  if (PREVIEW_MODE) return [];
  const sb = await createClient();
  const { data } = await sb.from("business_hours").select("*").order("day_of_week");
  return (data as BusinessHour[]) ?? [];
}

export async function getAutoMessages(): Promise<AutoMessage[]> {
  if (PREVIEW_MODE) return [];
  const sb = await createClient();
  const { data } = await sb.from("auto_messages").select("*").order("event");
  return (data as AutoMessage[]) ?? [];
}
