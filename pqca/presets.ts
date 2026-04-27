const preset1 = `auto = ca(15,every(1).ie(.1,0),7)
rowd = n => auto.row(n).density()

global
  cps: .5
  e: '1'

s0
  inst 0
  cut 0
  lag ctms(.5)
  _n stack('45','52','Ami%6..?','Emi%4..?')
    .at(auto.row(2).indexesOf(1))
    .add('0|*4 5|*4')
  _modi rowd(0).mtr(.5,2)
  _harm rowd(1).mtr(.5,5).step(.5)
  mods .5
  modd rowd(6).mul(100).step(1)
  moda 0
  strum ctms(1/16)
  _pan rowd(4)
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

export const presets: Record<number, string> = {
    1: preset1
}