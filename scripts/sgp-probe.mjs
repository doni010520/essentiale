/**
 * Probe da API URA do SGP — autossuficiente (Node 18+, sem dependências).
 * Confere os endpoints e o shape real contra a SUA instância.
 *
 * Uso (PowerShell, dentro de web/):
 *   $env:SGP_URL="https://SEUDOMINIO.sgp.net.br"
 *   $env:SGP_APP="nome_da_aplicacao"
 *   $env:SGP_TOKEN="o_token"
 *   $env:SGP_USER="usuario"      # opcional (Basic auth)
 *   $env:SGP_PASS="senha"        # opcional (Basic auth)
 *   node scripts/sgp-probe.mjs --cpfcnpj 00000000000
 *   node scripts/sgp-probe.mjs --contrato 308
 */

const URL = (process.env.SGP_URL || "").replace(/\/+$/, "");
const APP = process.env.SGP_APP || "";
const TOKEN = process.env.SGP_TOKEN || "";
const USER = process.env.SGP_USER || "";
const PASS = process.env.SGP_PASS || "";

if (!URL || !APP || !TOKEN) {
  console.error("Defina SGP_URL, SGP_APP e SGP_TOKEN no ambiente.");
  process.exit(1);
}

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const k = process.argv[i]?.replace(/^--/, "");
  if (k) args[k] = process.argv[i + 1];
}
const onlyDigits = (s) => String(s || "").replace(/\D+/g, "");

function headers() {
  const h = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };
  if (USER && PASS) h.Authorization = "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64");
  return h;
}

async function call(path, fields) {
  const params = new URLSearchParams({ app: APP, token: TOKEN });
  for (const [k, v] of Object.entries(fields)) if (v != null && v !== "") params.set(k, String(v));
  process.stdout.write(`\n=== POST ${path} {${[...params.keys()].filter((k) => k !== "token").join(",")}} ===\n`);
  try {
    const res = await fetch(`${URL}/${path.replace(/^\/+/, "")}`, { method: "POST", headers: headers(), body: params.toString() });
    const text = await res.text();
    let out = text;
    try { out = JSON.stringify(JSON.parse(text), null, 1); } catch { /* texto cru */ }
    console.log(`HTTP ${res.status}`);
    console.log(out.slice(0, 4000));
  } catch (e) {
    console.log(`ERRO DE REDE: ${e.message}`);
  }
}

const cpfcnpj = (args.cpfcnpj ?? process.env.SGP_CPFCNPJ) ? onlyDigits(args.cpfcnpj ?? process.env.SGP_CPFCNPJ) : undefined;
const contrato = (args.contrato ?? process.env.SGP_CONTRATO) ? Number(args.contrato ?? process.env.SGP_CONTRATO) : undefined;

await call("api/ura/consultacliente/", { cpfcnpj, contrato });
await call("api/ura/titulos/", { cpfcnpj, contrato, limit: 10 });
if (contrato) await call("api/ura/verificaacesso/", { contrato });

console.log("\nProbe concluído. Cole a saída aqui se algum shape divergir do esperado.");
