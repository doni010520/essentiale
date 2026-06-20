"""
Seed products + fragrances into Supabase.
Usage: python scripts/seed_catalog.py
Requires: pip install supabase python-dotenv
"""
import json, os, re, sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

try:
    from supabase import create_client
    from dotenv import load_dotenv
except ImportError:
    print("Install deps: pip install supabase python-dotenv")
    sys.exit(1)

load_dotenv(Path(__file__).parent.parent / ".env.local")

SUPABASE_URL  = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SERVICE_KEY   = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ORG_ID        = "aaaaaaaa-0000-0000-0000-000000000001"
CATALOG_PATH  = Path(__file__).parent.parent.parent / "extracted/catalogo/Catalogo_Essentiale/catalogo/catalogo_produtos.json"

sb = create_client(SUPABASE_URL, SERVICE_KEY)

def parse_preco(s: str) -> int:
    """'R$ 89,00' → 8900 (centavos). 'A partir de R$ 160,00' → 16000."""
    nums = re.findall(r"[\d]+[,.][\d]+", s)
    if not nums:
        return 0
    n = nums[-1].replace(".", "").replace(",", "")
    return int(n)

data = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
produtos  = data["produtos"]
frags_ok  = data["fragrancias_confirmadas"]
outras    = data["outras_fragrancias"]

# ── Fragrâncias ────────────────────────────────────────────────────────────────
frags_rows = []
for nome, info in frags_ok.items():
    frags_rows.append({
        "organization_id": ORG_ID,
        "nome":         nome,
        "perfil":       info.get("perfil", ""),
        "indicar_para": info.get("indicar_para", ""),
        "notas":        info.get("notas", {}),
        "confirmada":   True,
    })
for nome in outras:
    frags_rows.append({
        "organization_id": ORG_ID,
        "nome":       nome,
        "confirmada": False,
    })

res = sb.table("fragrances").upsert(frags_rows, on_conflict="organization_id,nome").execute()
print(f"Fragrâncias upsertadas: {len(res.data)}")

# ── Produtos ───────────────────────────────────────────────────────────────────
prod_rows = []
for p in produtos:
    prod_rows.append({
        "organization_id": ORG_ID,
        "nome":            p["nome"],
        "slug":            p["slug"],
        "categoria":       p["categoria"],
        "preco_centavos":  parse_preco(p.get("preco", "0")),
        "url_produto":     p.get("url_produto"),
        "descricao":       p.get("descricao"),
        "caracteristicas": p.get("caracteristicas", []),
        "exemplos_de_uso": p.get("exemplos_de_uso", []),
        "cuidados":        p.get("cuidados"),
        "foto_arquivo":    p.get("foto_arquivo"),
        "ativo":           True,
    })

res = sb.table("products").upsert(prod_rows, on_conflict="organization_id,slug").execute()
print(f"Produtos upsertados: {len(res.data)}")
print("✅ Seed concluído.")
