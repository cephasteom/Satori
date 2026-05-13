export const preset = 
`global.set({
  cps: 1.5, e: '1*4'})

s0.set({ 
  inst:'sampler', cut:'s0', bank:'breaks', 
  snap: ctms(8),
  n: 60,
  begin: t(2).ifelse(random().step(1/16),0),
  dur: ctms(2),
  e: '1 1?0*2 | 1?0*4' })
`