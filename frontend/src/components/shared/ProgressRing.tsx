export function ProgressRing({ value, size=64, strokeWidth=5, className="" }: { value:number; size?:number; strokeWidth?:number; className?:string }) {
  const r = (size-strokeWidth*2)/2;
  const circ = 2*Math.PI*r;
  const offset = circ - (value/100)*circ;
  return (
    <svg width={size} height={size} className={className}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={strokeWidth} className="stroke-muted" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={strokeWidth} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="stroke-primary transition-all duration-700" transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2+5} textAnchor="middle" className="fill-foreground font-bold" fontSize={size*0.22}>{value}%</text>
    </svg>
  );
}
