export default `[s0,s1,s2].map((s,i) => s.set({
  inst:1, bank:'ksh', i,
  e:qm(i).cache(1, every(4))
}))

// probability weightings
k = .5; s = .3; rest = .3;

// circuit
q0.rx(k).cx(2).crx(3,rest,1)
q1.cx(2,3).crx(4,rest,1)
q2.x().crx(1,s).crx(5,rest,2)
q3.cx(0,5)
q4.cx(1,7)
q5.cx(2,9)
`