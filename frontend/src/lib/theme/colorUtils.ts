export function hexToHsl(hex: string) {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h = 0, s = 0;
  const l = (max+min)/2;
  if (max !== min) {
    const d = max-min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch(max) {
      case r: h = ((g-b)/d + (g<b?6:0))/6; break;
      case g: h = ((b-r)/d + 2)/6; break;
      case b: h = ((r-g)/d + 4)/6; break;
    }
  }
  return { h: Math.round(h*360), s: Math.round(s*100), l: Math.round(l*100) };
}
export function hexToHslString(hex: string): string {
  const {h,s,l} = hexToHsl(hex);
  return `${h} ${s}% ${l}%`;
}
export function applyTheme(hex: string) {
  const hsl = hexToHslString(hex);
  document.documentElement.style.setProperty("--primary", hsl);
  document.documentElement.style.setProperty("--ring", hsl);
}
export function lighten(hex: string, amount: number): string {
  const {h,s,l} = hexToHsl(hex);
  const nl = Math.min(100, l+amount);
  return hslToHex(h, s, nl);
}
export function darken(hex: string, amount: number): string {
  const {h,s,l} = hexToHsl(hex);
  const nl = Math.max(0, l-amount);
  return hslToHex(h, s, nl);
}
function hslToHex(h:number,s:number,l:number): string {
  s/=100; l/=100;
  const k = (n:number) => (n+h/30)%12;
  const a = s*Math.min(l,1-l);
  const f = (n:number) => l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
  return "#"+[f(0),f(8),f(4)].map(x=>Math.round(x*255).toString(16).padStart(2,"0")).join("");
}
