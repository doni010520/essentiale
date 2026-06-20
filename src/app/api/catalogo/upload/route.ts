import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // Auth guard
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const slug = (formData.get("slug") as string | null) ?? "produto";
  const galeria = formData.get("galeria") === "true";

  if (!file) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "webp";
  const allowed = ["webp", "jpg", "jpeg", "png", "gif", "avif"];
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: "Formato não permitido. Use WEBP, JPG ou PNG." }, { status: 400 });
  }

  // Para galeria, adiciona timestamp para evitar conflito de nomes
  const filename = galeria
    ? `${slug}-gallery-${Date.now()}.${ext}`
    : `${slug}.${ext}`;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const admin = createServiceClient();
  const { error } = await admin.storage
    .from("media")
    .upload(filename, buffer, {
      contentType: file.type || "image/webp",
      upsert: true,
    });

  if (error) {
    console.error("[upload] storage error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${filename}`;
  return NextResponse.json({ filename, url });
}
