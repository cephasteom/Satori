const preset1 = `auto = ca({size: 15, reset: every(4)})
rowd = n => auto.row(n).density()

global
  cps: .5
  e: '1'

s0
  inst 0
  cut 0
  lag ctms(.5)
  _n stack('45','52','Ami%6..?','Emi%4..?')
    .at(auto.row(5).indexesOf(1))
    .add('0|*4 5|*4')
  _modi rowd(0).mtr(.5,2)
  _harm rowd(1).mtr(.5,5).step(.5)
  mods .5
  modd rowd(6).mul(100).step(1)
  moda 0
  strum ctms(1/16)
  _pan rowd(10)
  reverb .5
  delay .125
  dtime rowd(5).mtr(1,8).step(1).div(8).ctms()
  dfb .75
  m '1*16'.and(rowd(7).gt(.75))
  e '1*8'
    .and(auto.row(3).at(t().mul(15).floor()))
    
canvas
  grid auto
  e: s0.e
`;

const preset2 = `size = '16|8'.slow(1.5)
auto = ca({size, noise: every(2).ie(.15,0), preset: 10})
  .cache(1,every('2|*4 1|*4'))
harmony = 'Dmi%16|*2 Flyd%16|Ami%16'
  .at(t().mul(size).mod(floor(size.div(4))))
    
streams.slice(0,4).map((stream,i) => 
  stream
    inst 0
    cut 'all'
    reverb .5
    delay .125
    n harmony.rotate(i).sub(i*12).add(12)
    e '1'.fast(size.mul(2))
      .and(auto.hood(i*3,i*3).join(' '))
      .degrade(i.div(size/4))      
)

streams.slice(4,12).map((stream,i) => 
  stream
    inst 1
    dur ctms(1)
    bank 'cpu2'
    i i
    e '1'.fast(size)
      .and(auto.hood(i*3+10,i*5+10).join(' '))
      .degrade(i.div(size/4))      
)

canvas
  grid auto
  e '1*16'
`

export const presets: Record<number, string> = {
  1: preset1,
  2: preset2
}