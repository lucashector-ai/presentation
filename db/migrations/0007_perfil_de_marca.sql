-- 0007: perfil do manual da marca nos kits de marca (Criar com IA → passo da marca → "Manual da marca").
-- O que o manual da marca (PDF, imagens, tokens, CSS, tema de .pptx) diz da identidade, revisado pela pessoa:
-- paleta com papéis, tipografia por nível (títulos, textos, números), tom de voz, termos, faz/não faz, regras do
-- logo, estilo de imagens, ícones, grafismos e densidade (formato em lib/marca/perfil.ts, validado na rota).
-- Aditiva: uma coluna nova, nula por padrão. Kits existentes continuam iguais (sem perfil); nada é alterado ou
-- apagado. O texto do manual em si nunca é guardado, só o perfil resumido.

alter table public.brand_kits
  add column if not exists brand_profile jsonb
    check (brand_profile is null or (jsonb_typeof(brand_profile) = 'object' and octet_length(brand_profile::text) <= 65536));
