"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { saveSettings } from "@/app/(app)/ajustes/configuracoes/actions";
import type { OrgSettings, Department, Channel } from "@/lib/types";

const inputCls = "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand";
const labelCls = "text-xs font-medium text-ink-soft";

function Toggle({ name, label, hint, defaultChecked }: { name: string; label: string; hint?: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-start gap-3 py-2 cursor-pointer">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 accent-brand" />
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="text-xs text-ink-soft">{hint}</p>}
      </div>
    </label>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border pb-6 last:border-b-0">
      <h3 className="mb-1 text-base font-semibold text-ink">{title}</h3>
      {hint && <p className="mb-4 text-xs text-ink-soft">{hint}</p>}
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function SettingsForm({ settings, departments, channels = [] }: { settings: OrgSettings; departments: Department[]; channels?: Channel[] }) {
  const [tab, setTab] = useState<"general" | "attendance" | "chatv2" | "permissions">("general");
  const s = settings;

  return (
    <form action={saveSettings} className="space-y-6">
      {/* Tabs */}
      <div className="flex rounded-lg bg-gray-100 p-0.5 text-sm">
        {([
          ["general", "Geral"],
          ["attendance", "Atendimento"],
          ["chatv2", "Chat V2"],
          ["permissions", "Permissões"],
        ] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`flex-1 rounded-md py-2 font-medium transition ${tab === k ? "bg-surface text-ink shadow-sm" : "text-ink-soft"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Geral */}
      {tab === "general" && (
        <div className="space-y-6">
          <Section title="Opções gerais" hint="Ajuste o funcionamento geral do chat.">
            <Toggle name="identify_agent" label="Identificar atendente"
              hint="Enviar o nome do atendente antes da mensagem enviada." defaultChecked={s.identify_agent} />
            <div>
              <label className={labelCls}>Comando para encerrar atendimento</label>
              <input name="close_command" defaultValue={s.close_command ?? ""} placeholder="Ex.: encerrar, sair (separados por vírgula)" className={inputCls} />
              <input name="close_command_message" defaultValue={s.close_command_message ?? ""} placeholder="Mensagem enviada ao encerrar (opcional)" className={`mt-1 ${inputCls}`} />
            </div>
            <Toggle name="allow_agent_reconnect" label="Permitir que atendentes reconectem canais"
              hint="Desconectar, reconectar e ler QR Code." defaultChecked={s.allow_agent_reconnect} />
            <div>
              <label className={labelCls}>Timezone (offset UTC)</label>
              <input type="number" name="timezone_offset" defaultValue={s.timezone_offset ?? -3} step={1} className={`w-32 ${inputCls}`} />
              <p className="mt-0.5 text-[10px] text-ink-soft">Padrão: -3 (Brasília)</p>
            </div>
            <div>
              <label className={labelCls}>Canal “Siga-me” (notificações)</label>
              <select name="follow_me_channel_id" defaultValue={s.follow_me_channel_id ?? ""} className={inputCls}>
                <option value="">Nenhum</option>
                {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </Section>
          <Section title="Segurança" hint="Restrinja o acesso por endereço de IP.">
            <div>
              <label className={labelCls}>Lista de IPs permitidos</label>
              <textarea name="ip_whitelist" defaultValue={(s.ip_whitelist ?? []).join(", ")}
                placeholder="Um IP por linha ou separados por vírgula. Vazio = sem restrição." rows={2} className={inputCls} />
            </div>
          </Section>
        </div>
      )}

      {/* Atendimento */}
      {tab === "attendance" && (
        <div className="space-y-6">
          <Section title="Encerramento automático" hint="Fechar atendimentos sem interação.">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Empresa (minutos)</label>
                <input type="number" name="auto_close_company_min" defaultValue={s.auto_close_company_min ?? ""} placeholder="Ex.: 60" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Cliente (minutos)</label>
                <input type="number" name="auto_close_client_min" defaultValue={s.auto_close_client_min ?? ""} placeholder="Ex.: 120" className={inputCls} />
              </div>
            </div>
            <Toggle name="auto_close_queue" label="Fechar também os atendimentos em espera" defaultChecked={s.auto_close_queue} />
          </Section>

          <Section title="Transferência automática" hint="Transfere se não houver interação pelo tempo definido.">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Empresa (minutos)</label>
                <input type="number" name="auto_transfer_company_min" defaultValue={s.auto_transfer_company_min ?? ""} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Cliente (minutos)</label>
                <input type="number" name="auto_transfer_client_min" defaultValue={s.auto_transfer_client_min ?? ""} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Departamento destino</label>
              <select name="auto_transfer_dept_id" defaultValue={s.auto_transfer_dept_id ?? ""} className={inputCls}>
                <option value="">Nenhum</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </Section>

          <Section title="Classificação e motivo">
            <div>
              <label className={labelCls}>Tornar obrigatório a classificação</label>
              <select name="require_classification" defaultValue={s.require_classification ?? "never"} className={inputCls}>
                <option value="never">Não exigir</option>
                <option value="always">Sempre</option>
                <option value="company">Somente nos iniciados pela empresa</option>
                <option value="client">Apenas nos iniciados pelo cliente</option>
              </select>
            </div>
            <Toggle name="require_close_reason" label="Tornar obrigatório a descrição do motivo" defaultChecked={s.require_close_reason} />
          </Section>

          <Section title="Pesquisa de satisfação">
            <div>
              <label className={labelCls}>Quando enviar a pesquisa</label>
              <select name="csat_policy" defaultValue={s.csat_policy ?? "optional_on"} className={inputCls}>
                <option value="optional_on">Habilitado por padrão, com opção de desmarcar</option>
                <option value="optional_off">Desabilitado por padrão</option>
                <option value="always">Sempre enviar (sem opção de desmarcar)</option>
                <option value="admin_only">Somente administradores podem desmarcar</option>
              </select>
            </div>
            <Toggle name="csat_select_survey" label="Permitir escolher qual pesquisa enviar ao encerrar" defaultChecked={s.csat_select_survey} />
          </Section>

          <Section title="Privacidade das mensagens">
            <div>
              <label className={labelCls}>Ocultar mensagens de</label>
              <select name="hide_msgs_mode" defaultValue={s.hide_msgs_mode ?? "none"} className={inputCls}>
                <option value="none">Não ocultar</option>
                <option value="queue">Atendimentos em espera</option>
                <option value="queue_automation">Em espera e na automação</option>
              </select>
              <p className="mt-0.5 text-[10px] text-ink-soft">Esconde o conteúdo das mensagens nos cards conforme o estado do atendimento.</p>
            </div>
          </Section>

          <Section title="Distribuição e transferência">
            <div>
              <label className={labelCls}>Transferir para atendente ocioso</label>
              <select name="transfer_idle" defaultValue={s.transfer_idle ?? "none"} className={inputCls}>
                <option value="none">Não</option>
                <option value="manual">Sim, em transferências manuais</option>
                <option value="automation">Sim, somente na automação</option>
                <option value="both">Sim, em ambos</option>
              </select>
            </div>
            <Toggle name="distribute_least_loaded" label="Distribuir para o atendente com menor carga" defaultChecked={s.distribute_least_loaded} />
            <Toggle name="auto_send_assign_msg" label="Enviar mensagem de atribuição automaticamente" defaultChecked={s.auto_send_assign_msg} />
            <Toggle name="transfer_online_only" label="Transferir somente para usuários online" defaultChecked={s.transfer_online_only} />
          </Section>

          <Section title="Outros">
            <div>
              <label className={labelCls}>Busca de atendimentos</label>
              <select name="search_mode" defaultValue={s.search_mode ?? "all"} className={inputCls}>
                <option value="none">Não permitir</option>
                <option value="own">Somente os próprios</option>
                <option value="all">Todos os atendimentos</option>
              </select>
            </div>
            <Toggle name="read_confirmation" label="Confirmação de leitura (avisar ao cliente)" defaultChecked={s.read_confirmation} />
            <Toggle name="block_return_to_bot" label="Bloquear retorno do atendimento para automação" defaultChecked={s.block_return_to_bot} />
            <Toggle name="allow_company_start" label="Permitir início de atendimento pela empresa" defaultChecked={s.allow_company_start} />
            <Toggle name="show_tags_on_card" label="Exibir tags no card do atendimento" defaultChecked={s.show_tags_on_card} />
            <div>
              <label className={labelCls}>Enviar mensagem de ausente a cada (minutos)</label>
              <input type="number" name="away_msg_interval_min" defaultValue={s.away_msg_interval_min ?? ""} placeholder="Ex.: 15" className={`w-32 ${inputCls}`} />
            </div>
          </Section>
        </div>
      )}

      {/* Chat V2 */}
      {tab === "chatv2" && (
        <div className="space-y-6">
          <Section title="Atendimento V2">
            <div>
              <label className={labelCls}>Ordenar lista por</label>
              <select name="v2_order_by" defaultValue={s.v2_order_by ?? "last_message"} className={inputCls}>
                <option value="last_message">Última mensagem</option>
                <option value="transfer_date">Data de transferência</option>
              </select>
            </div>
            <Toggle name="v2_block_unassigned" label="Bloquear mensagens em atendimentos não atribuídos" defaultChecked={s.v2_block_unassigned} />
            <Toggle name="v2_auto_transcribe" label="Transcrever áudios automaticamente" defaultChecked={s.v2_auto_transcribe} />
          </Section>

          <Section title="Recorrência de atendimento">
            <Toggle name="v2_recurrence_enabled" label="Calcular recorrência" defaultChecked={s.v2_recurrence_enabled} />
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className={labelCls}>Dias</label>
                <input type="number" name="v2_recurrence_days" defaultValue={s.v2_recurrence_days ?? 30} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Baixa (vezes)</label>
                <input type="number" name="v2_recurrence_low" defaultValue={s.v2_recurrence_low ?? 2} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Média (vezes)</label>
                <input type="number" name="v2_recurrence_medium" defaultValue={s.v2_recurrence_medium ?? 5} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Alta (vezes)</label>
                <input type="number" name="v2_recurrence_high" defaultValue={s.v2_recurrence_high ?? 10} className={inputCls} />
              </div>
            </div>
          </Section>

          <Section title="Tolerância de espera">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Qtd. atendimentos</label>
                <input type="number" name="v2_queue_alert_count" defaultValue={s.v2_queue_alert_count ?? ""} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Minutos em espera</label>
                <input type="number" name="v2_queue_alert_min" defaultValue={s.v2_queue_alert_min ?? 5} className={inputCls} />
              </div>
            </div>
            <Toggle name="v2_queue_alert_popup" label="Mostrar popup" defaultChecked={s.v2_queue_alert_popup} />
            <Toggle name="v2_queue_alert_sound" label="Tocar som de alerta" defaultChecked={s.v2_queue_alert_sound} />
          </Section>

          <Section title="Interface e visual">
            <Toggle name="v2_sidebar_collapsed" label="Sidebar colapsada ao abrir o chat" defaultChecked={s.v2_sidebar_collapsed} />
            <Toggle name="v2_show_channel_on_card" label="Mostrar canal no card do atendimento" defaultChecked={s.v2_show_channel_on_card} />
            <Toggle name="v2_show_titles" label="Mostrar títulos/assunto nos cards" defaultChecked={s.v2_show_titles} />
            <Toggle name="v2_use_address" label="Usar endereço do cliente nos cards" defaultChecked={s.v2_use_address} />
            <Toggle name="v2_show_only_internet" label="Mostrar apenas atendimentos de internet" defaultChecked={s.v2_show_only_internet} />
            <Toggle name="v2_show_cancelled" label="Mostrar atendimentos de contratos cancelados" defaultChecked={s.v2_show_cancelled} />
            <Toggle name="v2_notify_high" label="Notificar atendimentos de alta prioridade" defaultChecked={s.v2_notify_high} />
          </Section>

          <Section title="Mensagem automática de fila" hint="Reenvia ao cliente enquanto ele aguarda na fila.">
            <Toggle name="v2_queue_msg_enabled" label="Enviar mensagem de fila" defaultChecked={s.v2_queue_msg_enabled} />
            <div>
              <label className={labelCls}>Texto da mensagem</label>
              <textarea name="v2_queue_msg_text" defaultValue={s.v2_queue_msg_text ?? ""} rows={2}
                placeholder="Ex.: Você está na fila, em breve um atendente irá te responder." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Reenviar a cada (minutos)</label>
              <input type="number" name="v2_queue_msg_interval_min" defaultValue={s.v2_queue_msg_interval_min ?? ""} className={`w-32 ${inputCls}`} />
            </div>
          </Section>

          <Section title="Promessa de pagamento">
            <Toggle name="v2_promise_global" label="Habilitar promessa de pagamento global" defaultChecked={s.v2_promise_global} />
            <div>
              <label className={labelCls}>Dias de validade da promessa</label>
              <input type="number" name="v2_promise_days" defaultValue={s.v2_promise_days ?? ""} className={`w-32 ${inputCls}`} />
            </div>
          </Section>

          <Section title="Boletos / faturas">
            <Toggle name="v2_search_all_boletos" label="Buscar todos os boletos do cliente" defaultChecked={s.v2_search_all_boletos} />
            <Toggle name="v2_show_nonstandard_boletos" label="Mostrar boletos fora do padrão" defaultChecked={s.v2_show_nonstandard_boletos} />
            <Toggle name="v2_only_overdue_plus_next" label="Apenas vencidos + próximo a vencer" defaultChecked={s.v2_only_overdue_plus_next} />
            <Toggle name="v2_use_billing_link" label="Usar link de cobrança" defaultChecked={s.v2_use_billing_link} />
            <div>
              <label className={labelCls}>Janela de boletos (dias)</label>
              <input type="number" name="v2_boleto_days" defaultValue={s.v2_boleto_days ?? ""} className={`w-32 ${inputCls}`} />
            </div>
          </Section>

          <Section title="Cores por tempo de espera" hint="Destaca cards do cliente/atendente conforme o tempo sem resposta.">
            <Toggle name="v2_color_no_interaction" label="Colorir card por tempo sem interação" defaultChecked={s.v2_color_no_interaction} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Cliente — normal (segundos)</label>
                <input type="number" name="v2_color_client_normal_sec" defaultValue={s.v2_color_client_normal_sec ?? ""} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Cor normal</label>
                <input type="color" name="v2_color_client_normal" defaultValue={s.v2_color_client_normal ?? "#22c55e"} className="h-10 w-20 cursor-pointer rounded-lg border border-border" />
              </div>
              <div>
                <label className={labelCls}>Cliente — médio (segundos)</label>
                <input type="number" name="v2_color_client_medium_sec" defaultValue={s.v2_color_client_medium_sec ?? ""} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Cor média</label>
                <input type="color" name="v2_color_client_medium" defaultValue={s.v2_color_client_medium ?? "#f59e0b"} className="h-10 w-20 cursor-pointer rounded-lg border border-border" />
              </div>
              <div>
                <label className={labelCls}>Cliente — alto (segundos)</label>
                <input type="number" name="v2_color_client_high_sec" defaultValue={s.v2_color_client_high_sec ?? ""} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Cor alta</label>
                <input type="color" name="v2_color_client_high" defaultValue={s.v2_color_client_high ?? "#ef4444"} className="h-10 w-20 cursor-pointer rounded-lg border border-border" />
              </div>
            </div>
            <Toggle name="v2_color_agent_enabled" label="Colorir também por tempo do atendente" defaultChecked={s.v2_color_agent_enabled} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Atendente (segundos)</label>
                <input type="number" name="v2_color_agent_sec" defaultValue={s.v2_color_agent_sec ?? ""} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Cor do atendente</label>
                <input type="color" name="v2_color_agent_color" defaultValue={s.v2_color_agent_color ?? "#3b82f6"} className="h-10 w-20 cursor-pointer rounded-lg border border-border" />
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* Permissões */}
      {tab === "permissions" && (
        <div className="space-y-6">
          <Section title="Permissões do chat">
            <Toggle name="v2_mask_cpf" label="Exibir apenas os 6 primeiros dígitos do CPF" defaultChecked={s.v2_mask_cpf} />
            <Toggle name="v2_only_v2" label="Habilitar atendimento somente na Versão 2" defaultChecked={s.v2_only_v2} />
          </Section>
          <Section title="Permissões do atendente">
            <Toggle name="v2_agent_see_closed" label="Ver todos os atendimentos encerrados na auditoria" defaultChecked={s.v2_agent_see_closed} />
            <Toggle name="v2_hide_dashboard_agents" label="Não exibir dashboard para atendentes" defaultChecked={s.v2_hide_dashboard_agents} />
            <Toggle name="v2_agent_close_queue" label="Encerrar conversas em espera" defaultChecked={s.v2_agent_close_queue} />
            <Toggle name="v2_agent_bulk_close" label="Encerramento em massa pela fila de espera" defaultChecked={s.v2_agent_bulk_close} />
            <Toggle name="v2_agent_manage_clients" label="Habilitar gerenciamento de clientes para atendentes" defaultChecked={s.v2_agent_manage_clients} />
            <Toggle name="v2_hide_contact_agents" label="Ocultar contato do cliente para o atendente" defaultChecked={s.v2_hide_contact_agents} />
          </Section>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <Button type="submit">Salvar configurações</Button>
      </div>
    </form>
  );
}
