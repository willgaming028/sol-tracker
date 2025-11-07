export function formatNumber(num) {
  return Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(num);
}

export function shortenAddress(addr) {
  if (!addr) return "N/A";
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}
