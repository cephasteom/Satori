const preset1 = `// Fugen, Teom y Puy // Berlin, May 2026

grid = pqca(0,c(),c()).when(
  square(1,0).slow(16), 
  p => p.gridroll(count(),count().mul(1.3).floor())
    .reflectx()
    .reflecty()
)

canvas.set({ grid, e: every(1)})
global.set({ cps: .75, e: once() })

fx0.set({
  _ftape: 1,
  reverb: 0.5, 
  rsize: .7, 
  rtail: .1,
  e: once() })

streams.slice(1,5).map((s, i) => 
s.set({
  inst: 'faust.pad',
  n: 'Cmi'.at(0, 2).sub(24).add(i * 14),
  cut: i + 1, cutr: ctms(1),
  amp: (1).sub(0.25 * i),
  a: ctms(4), r: ctms(4),
  dur: ctms(64),
  _pan: noise(.5 - Math.pow(0.65, i), .5 + Math.pow(0.65, i))
    .clamp().slow(4 + i * 3),
  _bpfv: sine(.1, .4).slow(4).rotate(i * (1 / 4))
    .add(.08 + i * 0.12)
    .clamp(),
  _resv: grid.row(i).at(count()).mtr(.3,.001),
  hpfv: (i * (1 / 8)).add(.3), 
  _lpfv: grid.row(i+1).at(count()).mtr(.5,.01),
  fx0: 1, level: 0,
  lag: 0,
  m: '1*12'.and(grid.row(i+2).at(count())),
  e: once() }))
`;

export const presets: Record<number, string> = {
  1: preset1
}