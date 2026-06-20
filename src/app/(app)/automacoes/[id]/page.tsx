import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FlowEditor } from "@/components/flow-editor";
import { createClient } from "@/lib/supabase/server";
import { getDepartments, getTags } from "@/lib/data/management";
import { PREVIEW_MODE } from "@/lib/mock";

type IdName = { id: string; name: string };

export default async function AutomationEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let name = "Automação";
  let flow = { nodes: [], edges: [] };
  let departments: IdName[] = [];
  let aiAgents: IdName[] = [];
  let tags: IdName[] = [];

  if (!PREVIEW_MODE) {
    const sb = await createClient();
    const [{ data }, deptList, tagList, { data: aiList }] = await Promise.all([
      sb.from("automations").select("name, flow").eq("id", id).maybeSingle(),
      getDepartments(),
      getTags("conversation"),
      sb.from("ai_agents").select("id, name").order("name"),
    ]);
    if (data) {
      name = data.name ?? name;
      flow = (data.flow as typeof flow) ?? flow;
    }
    departments = (deptList ?? []).map((d) => ({ id: d.id, name: d.name }));
    tags = (tagList ?? []).map((t) => ({ id: t.id, name: t.name }));
    aiAgents = ((aiList as IdName[]) ?? []).map((a) => ({ id: a.id, name: a.name }));
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border bg-surface px-6 py-3">
        <Link href="/automacoes" className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
          <ArrowLeft size={15} /> Automações
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-sm font-semibold text-ink">{name}</h1>
      </div>
      <div className="min-h-0 flex-1">
        <FlowEditor
          automationId={id}
          initialFlow={flow}
          departments={departments}
          aiAgents={aiAgents}
          tags={tags}
        />
      </div>
    </div>
  );
}
