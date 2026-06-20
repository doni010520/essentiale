import { PageHeader, EmptyState } from "@/components/ui";
import { Scroll } from "@/components/scroll";

export function ComingSoon({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Scroll>
      <PageHeader title={title} subtitle={subtitle} />
      <EmptyState
        title="Módulo em construção"
        hint="Esta tela será implementada nas próximas fases do projeto."
      />
    </Scroll>
  );
}
