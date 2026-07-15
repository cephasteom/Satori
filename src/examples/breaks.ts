export default `// Beatslicer // Cephas Teom, 2025 */

global.set({
  cps: 1.5, e: '1*4'})

s0.set({ 
  inst:'sampler', bank:'breaks', cut: 0,
  snap: ctms(8), 
  begin: t(2).ifelse(random().step(1/16),0),
  e: '1 1?0*2 | 1?0*4' })
`