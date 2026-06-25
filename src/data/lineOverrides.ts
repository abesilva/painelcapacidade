// Shared storage keys and utilities for line classification overrides

const OVERRIDES_KEY = 'cooispi_line_overrides';

export const LINHAS_PRODUCAO = [
  'TB 1/2', 'TB 3/4', 'TB 5/6', 'TV', 'ACMA',
  'EC 1', 'EC 2', 'EC 3', 'EC 4', 'EC 5', 'EC 6',
  'OPTIMA 1', 'OPTIMA 2', 'OPTIMA 3',
  'Ervas antigo', 'Granel 100', 'Granel 250',
] as const;

export type LinhaProducao = typeof LINHAS_PRODUCAO[number];

/** Map of textoBreve → manually assigned line */
export function getLineOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function saveLineOverrides(overrides: Record<string, string>) {
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
}

export function setLineOverride(textoBreve: string, linha: string) {
  const overrides = getLineOverrides();
  overrides[textoBreve] = linha;
  saveLineOverrides(overrides);
}

export function removeLineOverride(textoBreve: string) {
  const overrides = getLineOverrides();
  delete overrides[textoBreve];
  saveLineOverrides(overrides);
}
