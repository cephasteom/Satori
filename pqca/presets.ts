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
  _ftape: .8,
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
  fx0: .8, level: 0,
  lag: 0,
  m: '1*12'.and(grid.row(i+2).at(count())),
  e: once() }))
`;

const preset2 = `// Toccata, Cephas Teom // Dartmoor, May 2026
load('https://raw.githubusercontent.com/cephasteom/samples/main/samples.json')

data = pqca(1, c().fast(4))
grid = data
.when(
  data.density().gt(.25), 
  p => p.reflectx().reflecty().reflectn(6)
)

harmony = '48 55 60 63 67 70 72 74 75 77 79 81 82 84'.sub(12)
  .when(grid.density().lt(.125), p => p.add(5))

streams.slice(0,4).map((stream, i) => {
  transport = t().mul(24).add(i*4)
  stream
    inst 'faust.fm'
    dur ctms(8)
    mods 1
    _harm i.add(1).mul(3)
    _modi grid.flat().at(transport.add(2))
      .mtr(0,tri(0,.5).slow((i+1).mul(6)))
    _amp grid.flat().at(transport.add(4)).mtr(.75,.125)
      .mul(harmony.mtr(1,.5,36,72))
    _pan grid.flat().at(transport.add(6))
    _hpfv grid.flat().at(transport.add(8)).mtr(.125,.5)
    hpf .3
    a ctms(2)
    d ctms(2)
    _n harmony.add(floor(i/2).mul(12))
    lag i.add(1).mul(2)
    fx0 .75
    level 0
    m '1*24'
      .and(grid.flat().at(transport))
    e every((i + 1) * 2)
})

s4
  inst 'synth'
  n '36|32'.slow(16)
  cut 4
  amp .5
  lforate .75
  lfodepth .5
  dur ctms(16)
  a ctms(4)
  r ctms(2)
  e every(8)

s5
  inst 'sampler'
  bank 'air'
  a ctms(2)
  r ctms(2)
  i count()
  snap ctms(16)
  dur ctms(8)
  fx0 1
  level 0
  e every(8)
  
fx0
  reverb .5
  rsize .7
  rtail .125
  ftape .6
  _ftapesat grid.density()
  _ftapewow grid.density()
  _ftapeflutter grid.density().mul(2).clamp()
  delay tri(.01,.5).slow(16)
  dtime ctms(.75)
  lag ctms(1/6)
  hpf .25
  m '1*24'
  e once()

global
  cps .25
  e once()
  
canvas 
  grid grid
  e '1*24'
`

export const presets: Record<number, string> = {
  1: preset1,
  2: preset2
}