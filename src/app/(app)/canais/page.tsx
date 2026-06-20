import { getChannels } from "@/lib/data/channels";
import { ChannelsList } from "@/components/channels-list";
import { PageHeader, EmptyState } from "@/components/ui";
import { NewChannelDialog } from "@/components/new-channel-dialog";
import { Scroll } from "@/components/scroll";

export default async function CanaisPage() {
  const channels = await getChannels();

  return (
    <Scroll>
      <PageHeader
        title="Canais"
        subtitle={`Gerencie todas as fontes de atendimento. ${channels.length} canal(is) cadastrado(s).`}
        action={<NewChannelDialog />}
      />

      {channels.length === 0 ? (
        <EmptyState
          title="Nenhum canal cadastrado"
          hint="Clique em Cadastrar para conectar um WhatsApp (UAZAPI por QR Code ou API Oficial da Meta)."
        />
      ) : (
        <ChannelsList channels={channels} />
      )}
    </Scroll>
  );
}
