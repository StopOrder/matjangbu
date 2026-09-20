export const won = (n: unknown): string => (Number(n) || 0).toLocaleString("ko-KR") + "원"
export const fmtTs = (ts?: string | null): string => (ts || "").replace("T", " ").slice(0, 16)
