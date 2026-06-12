const preset0 = `/* Welcome to Satori PQCA.
 * Satori is a live coding environment for generating 
 * quantum computer music. This version is a fork for
 * exploring Partitioned Quantum Cellular Automata.
 * Click ABOUT for more information.
 * Click RUN to start exploring the datasets.
 * Click a PRESET to explore some musical starting points.
*/

canvas.set({
  grid: pqca(
    1, // dataset. 0 - 9
    count(), // timestep. 
    random().mtr(0,128).step(1) // shot
  )
    // optional classical transformations
    // .reflectx() 
    // .reflecty()
    // .reflectn(6)
  ,
  e: '1*8'
})

`

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
  reverb: 0.5, 
  rsize: .7, 
  rtail: .1,
  e: once() })

streams.slice(0,3).map((s, i) => 
s.set({
  inst: 'faust.pad',
  n: 'Cmi'.at(0,2).sub(24).add(i * 14),
  cut: i, cutr: ctms(1),
  amp: (1).sub(0.1 * i).mul(.5),
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
  stream.set({
    inst: 'faust.fm',
    dur: ctms(8),
    _harm: i.add(1).mul(3),
    _modi: grid.flat().at(transport.add(2))
      .mtr(0,tri(0,.5).slow((i+1).mul(6))),
    mods: 1,
    _amp: grid.flat().at(transport.add(4)).mtr(.75,.125)
      .mul(harmony.mtr(1,.5,36,72)),
    _pan: grid.flat().at(transport.add(6)),
    _hpfv: grid.flat().at(transport.add(8)).mtr(.125,.5),
    hpf: .3,
    a: ctms(2), d: ctms(2),
    _n: harmony.add(floor(i/2).mul(12)),
    lag: i.add(1).mul(2),
    fx0: .75, level: 0,
    m: '1*24'
      .and(grid.flat().at(transport)),
    e: every((i + 1) * 2) })
})

s4.set({
  inst: 'synth',
  n: '36|32'.slow(16),
  cut: 4,
  amp: .5,
  lforate: .75, lfodepth: .5,
  dur: ctms(16),
  a: ctms(4), r: ctms(2),
  e: every(8) })

s5.set({
  inst: 'sampler',
  bank: 'air', i: count(),
  snap: ctms(16),
  a: ctms(2), r: ctms(2),
  dur: ctms(8),
  fx0: 1, level: 0,
  e: every(8) })

fx0.set({
  reverb: .5, rsize: .7, rtail: .125,
  ftape: .6,
  _ftapesat: grid.density(),
  _ftapewow: grid.density(),
  _ftapeflutter: grid.density().mul(2).clamp(),
  delay: tri(.01,.5).slow(16), dtime: ctms(.75),
  hpf: .25,
  m: '1*24', lag: ctms(1/6),
  e: once() })

global.set({
  cps: c().lt(3).ie(1,.25),
  e: '1' })

canvas.set({
  grid: grid,
  e: '1*24' })
`

const preset3 = `// Stabat in Tenebris, Cephas Teom // Dartmoor, June 2026
load('https://raw.githubusercontent.com/cephasteom/samples/main/samples.json')

speed = 11
trigger = every((1).div(speed))

grid = pqca(3,
  c().lt(4).ie(
    t().mul(speed).floor(),
    cosine(0,10).slow(4).floor()
  ),
  sine(0,10).slow(5).floor()
)
  .gridrollx(c())

harmony = set([48,55,60,65,67,70,72,74,75,77,79,82])
  .sub(12)
  .add(c().slow(4).mul(5).mod(17))

regions = [grid.region(0,0,2,3), grid.region(3,0,5,3)]

streams.slice(0,2).map((s,i) => s.set({
  n: harmony.at(regions[i].born().indexesOf(1)),
  amp: regions[i].density(),
  pan: regions[i].density().mtr(i * .6 + .2, i * -.6 + .8),
  fx0: regions[i].density().mtr(.5,1),
  level: regions[i].density().mtr(.5,0),
  ftape: 1, ftapehiss: .01,
  _ftapesat: regions[i].density().mtr(.75,1),
  _ftapewow: regions[i].density().mtr(.5,1),
  _ftapeflutter: regions[i].density().mtr(.5,1),
  lag: 200,
  hpf: .3,
  e: trigger.and(regions[i].born().includes(1))
}))

s0.set({ 
  inst: 'tone.mono',
  vol: .3, r: 1000,
  fila: 10, fils: .1 })

s1.set({
  inst: 'tone.fm', mod: .25,
  a: 10, s: .25,
  cut: [0,1], cutr: ctms(1/4),
  lpf: 1 })
  
s2.set({
  inst: 'faust.kick',
  amp: grid.density().mtr(.5,1),
  n: harmony.at(0).mod(12).add(36),
  e: '3:8'.and('1 0') })

s3.set({
  inst: 'sampler',
  bank: 'rs808', i: 3, 
  lpf: .4,
  reverb: .5, rtail:.1,
  n: harmony.at(5).mod(12).add(48),
  e: '3:8'.and('0 1') })

fx0.set({
  ftape: .6, ftapehiss: .025,
  _ftapesat: grid.density().mtr(.5,1),
  _ftapewow: grid.density().mtr(.5,1),
  _ftapeflutter: grid.density().mtr(.5,1),
  reverb: .5, rtail:.1,
  delay: grid.density().mtr(.2, .5), dfb:.1,
  dtime: ctms(1/4),
  m: trigger,
  e: trigger })

canvas.set({
  grid: grid,
  e: trigger })

global.set({
  cps: grid.density().mtr(1/16, 1).step(1/16),
  e: trigger })`

const preset4 = `// Wonkstep, Cephas Teom // Dartmoor, 2026
load('https://raw.githubusercontent.com/mot4i/turbo-garden/main/strudel.json',
     'https://raw.githubusercontent.com/cephasteom/samples/main/samples.json')

speed = '8 | 16 8'
trigger = every((1).div(speed))

grid = pqca(1,
  cosine(0,100).slow(4).floor(),
  sine(0,10).slow(5).floor()
)
  .reflectx()
  .gridrollx(c().slow(3))
  .gridrolly(c().slow(4))

regions = [
  grid.region(0, 0, 2, 3),
  grid.region(3, 0, 5, 3),
  grid.region(0, 4, 2, 7),
  grid.region(3, 4, 5, 7),
]

s0.set({
  inst: 'sampler',
  bank: 'turbo-garden_bd',
  nudge: grid.density().step(1/8).ctms(),
  fx0: 1, level: 0,
  cut: 1,
  e: every(1/2)
    .and(regions[2].density().gt(.25)) })

s1.set({
  inst: 'sampler',
  bank: 'turbo-garden_sd',
  amp: .25,
  snap: ctms(.5).add(noise().slow(4).mtr(0,25).step(1)),
  dur: regions[3].density().mtr(1/16,1).ctms(),
  fx0: 1, level: 0,
  nudge: random().mtr(0,25).step(1),
  cut: 'all',
  e: '0 1' })

s2.set({
  inst: 'sampler',
  bank: 'toms808', i: regions[0].born().indexesOf(1),
  cut: [0,1,'self'],
  amp: regions[0].density().mtr(.5,1),
  n: 'Cmpent%8'.at(tri().mul(speed).slow(speed).floor().mod(speed)),
  fx0: 1, level: 0,
  e: trigger
    .and(regions[0].born().includes(1))
    .and(not(s0.e.or(s1.e)))
    .and('1 0'.slow(1.5)) })

s3.set({
  inst: 'sampler',
  bank: 'ct.mb145', i: 3,
  s: regions[1].density().mtr(.1,1),
  snap: ctms(1),
  cut: [0,1,3],
  fx0: 1, level: 0,
  n: 'Cmpent%8'.at(random().mul(speed).slow(speed).floor().mod(speed)),
  e: trigger
    .and(regions[1].born().includes(1))
    .and(not(s0.e.or(s1.e)))
    .and('0 1'.slow(1.5)) })

s4.set({
  inst: 'sampler',
  bank: 'ma808',
  fx0: 1, level: 0,
  e: '0 1 0 1'.fast('1?2')
    .and(not(s0.e.or(s1.e))) })

fx0.set({
  ftape: grid.density().mtr(.5,1),
  ftapehiss: .125,
  dist: .5, drive: .5,
  _ftapesat: grid.density().mtr(.5,1),
  _ftapewow: grid.density().mtr(.5,1),
  _ftapeflutter: grid.density().mtr(.5,1),
  lag: ctms(1/8), level: .5,
  e: s0.e.or(s1.e).or(s2.e).or(s3.e) })

global.set({
  cps: (.75).add(sine(0,.01).slow(2)),
  e: trigger })

canvas.set({
  grid,
  e: s0.e.or(s1.e).or(s2.e).or(s3.e) })
`

const preset5 = `// Hiroshi's Dream, Cephas Teom // Dartmoor, 2026

load('https://raw.githubusercontent.com/cephasteom/samples/main/samples.json')

speed = 12
harmony = set([0,12,18,23,24,26,28,30,35,36,38,40]).add(36)
grid = pqca(7, t().mul(speed).step(1))
  .gridroll(c().slow(4))
cresc = saw().slow(speed)

canvas.set({
  grid: grid.gridaccumx(12), 
  e: every(1).fast(speed)})

fx0.set({
  reverb: .5,
  rtail: cresc.mtr(.01,.1),
  delay: cresc, 
  dtime: grid.density()
    .mtr((1).div(speed),1)
    .step((1).div(speed))
    .ctms(),
  e: every(1).fast(speed) })

s0.set({
  inst: 'faust.kick',
  punch: cresc.mtr(.5,.7),
  n: 36,
  amp: grid.density().mtr(1,.5),
  e: every(1).fast(speed)
    .and(grid.at(c().mod(2).slow(2))) })
  
s1.set({ 
  inst: 'tone.mono',
  n: harmony.at(grid.born().indexesOf(1)),
  lpf: .7,
  vol: .3, r: 1000, fx0: grid.density(),
  fila: 10, fils: grid.density().mtr(.1,.5), 
  e: every(1).fast(speed)
    .and(grid.at((2).add(c().mod(2)))) })

s2.set({ 
  inst: 'faust.fm',
  dur: 10,
  n: harmony.at(grid.born().indexesOf(1)),
  modi: grid.density().mtr(0,4).mul(cresc), 
  mods: .1,
  cut: [1,3],
  amp: grid.density().mtr(.25,.75),
  e: every(1).fast(speed)
    .and(grid.at((4).add(c().mod(2)))) })
  
s3.set({
  inst: 'sampler', amp: saw(1,.5).fast(speed.div(2)),
  dist: cresc.mul(.25),
  bank: 'breaks.brush.113', i: 3,
  begin: saw().slow(2).step(.125),
  dur: 50,
  snap: ctms(2),
  cut: 3,
  e: s0.e.or(s2.e) })
`

export const presets: Record<number, string> = {
  0: preset0,
  1: preset1,
  2: preset2,
  3: preset3,
  4: preset4,
  5: preset5
}