/**
 * Tipos do domínio SGP (Sistema de Gestão de Provedores — softwareprovedor.com).
 * Modelam as respostas da API de integração URA. Os nomes de campo do SGP variam
 * por versão (ex.: `cpfcnpj` vs `cpfCnpj`, `contrato` vs `contratoId`,
 * `linhadigitavel` vs `linhaDigitavel`); por isso o cliente normaliza
 * defensivamente e guarda a resposta crua em `raw`.
 *
 * Endpoints e shapes conferidos contra a collection oficial do Postman do SGP.
 */

/** Credenciais da integração (guardadas em integrations.config). */
export interface SgpConfig {
  /** URL base da instância, ex.: https://demo.sgp.net.br */
  url: string;
  /** Nome da aplicação de integração configurada no SGP (campo "app"). */
  app: string;
  /** Token da aplicação de integração. */
  token: string;
  /** Usuário do SGP para HTTP Basic Auth (quando a instância exige). */
  username?: string;
  /** Senha do SGP para HTTP Basic Auth. */
  password?: string;
}

/** Um contrato do assinante (consultacliente). */
export interface SgpContrato {
  contrato: number;
  status?: string;            // contratoStatusDisplay, ex.: "Ativo"
  statusModo?: number;        // contratoStatusModo
  motivoStatus?: string;
  plano?: string;             // planointernet / servico_plano
  login?: string;             // servico_login
  tipoConexao?: string;       // servico_tipo_conexao (PPPoE etc.)
  valorEmAberto?: number;     // contratoValorAberto
  titulosAReceber?: number;   // contratoTitulosAReceber
  endereco?: string;          // logradouro, nº - bairro, cidade/UF
  pop?: string;
}

/** Resultado da consulta de cliente. */
export interface SgpCliente {
  encontrado: boolean;
  mensagem?: string;
  clienteId?: number;
  nome?: string;              // razaoSocial
  cpfcnpj?: string;
  emails?: string[];
  telefones?: string[];
  contratos: SgpContrato[];
  raw?: unknown;
}

/** Um título financeiro (fatura/boleto). */
export interface SgpTitulo {
  fatura: number;             // id
  numeroDocumento?: number;
  contrato?: number;
  valor: number;
  valorCorrigido?: number;
  vencimento: string;
  diasAtraso?: number;
  status?: string;            // ex.: "Gerado", "Pago", "Vencido"
  pago?: boolean;
  linhaDigitavel?: string;
  codigoBarras?: string;
  codigoPix?: string;
  link?: string;              // link do boleto (PDF)
  linkCobranca?: string;      // página pública de pagamento (boleto+PIX)
}

/** Resultado de gerar 2ª via (uma ou mais faturas com linha digitável/link). */
export interface SgpSegundaVia {
  ok: boolean;
  protocolo?: string;
  mensagem?: string;
  contrato?: number;
  faturas: {
    fatura: number;
    valor: number;
    vencimento: string;
    linhaDigitavel?: string;
    codigoPix?: string;
    link?: string;
    linkCobranca?: string;
  }[];
  raw?: unknown;
}

/** Resultado de uma ação que confirma sucesso/falha (liberação, chamado). */
export interface SgpAcaoResult {
  ok: boolean;
  protocolo?: string;
  mensagem?: string;
  contrato?: number;
  raw?: unknown;
}

/** Status de conexão de um contrato (verificaacesso). */
export interface SgpConexao {
  contrato?: number;
  online: boolean;
  mensagem?: string;          // ex.: "Serviço Offline"
  raw?: unknown;
}

/** Erro lançado pelo cliente SGP (HTTP ou de negócio). */
export class SgpError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "SgpError";
  }
}
