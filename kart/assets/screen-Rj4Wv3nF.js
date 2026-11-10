import{$ as e,A as t,B as n,C as r,D as i,E as a,F as o,G as s,H as c,I as l,J as u,K as d,L as f,O as p,Q as m,R as h,S as g,T as _,U as v,V as y,X as b,Y as x,Z as S,_ as C,a as w,at as T,b as E,c as D,d as O,et as k,f as A,g as j,h as ee,i as M,it as N,l as P,m as F,n as te,nt as ne,o as re,p as ie,q as ae,r as oe,rt as se,s as ce,t as le,tt as ue,u as I,v as de,w as fe,x as pe,y as me,z as he}from"./items-CroLd52v.js";var ge=(e,t,n)=>e<t?t:e>n?n:e,_e=e=>440*2**((e-69)/12),ve=2,ye=.7,be=.26,xe=.62,L=e=>{let t=ge(e,0,1);return t*t};function Se(){let e=4097,t=new Float32Array(e);for(let n=0;n<e;n++){let e=n/4096*2-1,r=Math.abs(e),i=r<=ye?r:ye+be*(1-Math.exp(-(r-ye)/be));t[n]=e<0?-i:i}return t}var Ce=class{constructor(e,t,n,r,i){T(this,`ctx`,void 0),T(this,`live`,void 0),T(this,`musicIn`,void 0),T(this,`sfxIn`,void 0),T(this,`engineIn`,void 0),T(this,`output`,void 0),T(this,`white`,void 0),T(this,`brown`,void 0),T(this,`stats`,{started:0,ended:0}),T(this,`duckGain`,void 0),T(this,`musicVol`,void 0),T(this,`sfxVol`,void 0),T(this,`master`,void 0),T(this,`pulses`,new Map),T(this,`canPan`,void 0),T(this,`resumeAsked`,-1e9),this.ctx=e,this.live=t,this.canPan=typeof e.createStereoPanner==`function`,this.musicIn=e.createGain(),this.duckGain=e.createGain(),this.musicVol=e.createGain(),this.sfxIn=e.createGain(),this.engineIn=e.createGain(),this.sfxVol=e.createGain(),this.master=e.createGain(),this.musicVol.gain.value=L(n),this.sfxVol.gain.value=L(r),this.master.gain.value=+!i;let a=e.createDynamicsCompressor();a.threshold.value=-15,a.knee.value=12,a.ratio.value=8,a.attack.value=.003,a.release.value=.2;let o=e.createGain();o.gain.value=xe;let s=e.createWaveShaper();s.curve=Se(),this.musicIn.connect(this.duckGain),this.duckGain.connect(this.musicVol),this.musicVol.connect(this.master),this.sfxIn.connect(this.sfxVol),this.engineIn.connect(this.sfxVol),this.sfxVol.connect(this.master),this.master.connect(a),a.connect(o),o.connect(s),s.connect(e.destination),this.output=s,this.white=this.makeNoise(!1),this.brown=this.makeNoise(!0)}canPlay(){return!this.live||this.ctx.state===`running`||performance.now()-this.resumeAsked<600}noteResume(){this.resumeAsked=performance.now()}setVolumes(e,t){let n=this.ctx.currentTime;this.musicVol.gain.setTargetAtTime(L(e),n,.03),this.sfxVol.gain.setTargetAtTime(L(t),n,.03)}setMuted(e){this.master.gain.setTargetAtTime(+!e,this.ctx.currentTime,.02)}duck(e,t){let n=this.ctx.currentTime,r=this.duckGain.gain;r.cancelScheduledValues(n),r.setTargetAtTime(1-ge(e,0,1),n,.03),r.setTargetAtTime(1,n+Math.max(0,t),.15)}panner(e){if(!this.canPan)return null;let t=this.ctx.createStereoPanner();return t.pan.value=ge(e,-1,1),t}setWave(e,t){t===`pulse25`?e.setPeriodicWave(this.pulse(.25)):t===`pulse12`?e.setPeriodicWave(this.pulse(.125)):e.type=t}noise(e=!1){let t=this.ctx.createBufferSource();return t.buffer=e?this.brown:this.white,t.loop=!0,t}noiseOffset(){return Math.random()*1.95}pulse(e){let t=this.pulses.get(e);if(t)return t;let n=new Float32Array(41),r=new Float32Array(41);for(let t=1;t<=40;t++){let r=Math.PI*t/41,i=Math.sin(r)/r;n[t]=2/(t*Math.PI)*Math.sin(t*Math.PI*e)*i}return t=this.ctx.createPeriodicWave(n,r),this.pulses.set(e,t),t}makeNoise(e){let t=this.ctx,n=Math.floor(t.sampleRate*ve),r=t.createBuffer(1,n,t.sampleRate),i=r.getChannelData(0);for(let e=0;e<n;e++)i[e]=Math.random()*2-1;if(e){let e=i.slice(),t=0,r=0;for(let a=0;a<2;a++)for(let o=0;o<n;o++)t=.985*t+.12*e[o],i[o]=t,a===1&&Math.abs(t)>r&&(r=Math.abs(t));let a=r>0?.95/r:1;for(let e=0;e<n;e++)i[e]*=a}return r}},we=.5,R=.16,Te=60,z=8,B=.6,Ee=[{idle:52,top:186,ratio:2.01,sub:`square`,formant:520,far:`sawtooth`},{idle:60,top:208,ratio:1.5,sub:`pulse25`,formant:650,far:`pulse25`},{idle:46,top:168,ratio:2.02,sub:`square`,formant:430,far:`sawtooth`},{idle:66,top:228,ratio:2.99,sub:`pulse25`,formant:760,far:`square`}],De=[0,.3,.62],Oe=[.36,.7,1],ke=[.1,.48,.58],Ae=[.92,.95,1],je=[.36,.7],Me=[.27,.58],Ne=class{constructor(e){T(this,`param`,void 0),T(this,`last`,NaN),this.param=e}set(e,t,n){Math.abs(e-this.last)<1e-4+Math.abs(e)*.002||(this.last=e,this.param.setTargetAtTime(e,t,n))}},Pe=class{constructor(){T(this,`rpm`,.1),T(this,`load`,0),T(this,`cut`,1),T(this,`gear`,0),T(this,`cutTimer`,0)}step(e,t){let n=ge(t.speed,0,1.5);this.gear<2&&n>je[this.gear]?this.gear++:this.gear>0&&n<Me[this.gear-1]&&this.gear--;let r=this.gear,i=ge((n-De[r])/(Oe[r]-De[r]),0,1),a=ke[r]+(Ae[r]-ke[r])*i;n>1&&(a+=(n-1)*.45),t.throttle?a=Math.max(a,.5*(1-n/.2)):a-=.06,t.boost&&(a+=.07),t.air&&(a+=t.throttle?.24:.05),a=ge(a,.05,1.35);let o=a>this.rpm?t.air?.07:.15:.06;this.rpm+=(a-this.rpm)*(1-Math.exp(-e/o));let s=t.throttle||t.boost?1:0;this.load+=(s-this.load)*(1-Math.exp(-e/(s>this.load?.05:.12))),t.stall?(this.cutTimer-=e,this.cutTimer<=0&&(this.cut=Math.random()<.55?.08:1,this.cutTimer=.04+Math.random()*.09)):(this.cut=1,this.cutTimer=0)}},Fe=class{constructor(e,t){T(this,`mx`,void 0),T(this,`local`,void 0),T(this,`rev`,new Pe),T(this,`missing`,0),T(this,`nodes`,[]),T(this,`sources`,[]),T(this,`disposed`,!1),this.mx=e,this.local=t}dispose(){if(this.disposed)return;this.disposed=!0;let e=this.mx.ctx.currentTime;for(let t of this.sources){try{t.stop(e)}catch{}this.mx.stats.ended++}for(let e of this.nodes)try{e.disconnect()}catch{}}gain(e){let t=this.mx.ctx.createGain();return t.gain.value=e,this.nodes.push(t),t}filter(e,t,n){let r=this.mx.ctx.createBiquadFilter();return r.type=e,r.frequency.value=t,r.Q.value=n,this.nodes.push(r),r}osc(e,t){let n=this.mx.ctx.createOscillator();return this.mx.setWave(n,e),n.frequency.value=t,this.started(n),n.start(this.mx.ctx.currentTime),n}noise(e){let t=this.mx.noise(e);return this.started(t),t.start(this.mx.ctx.currentTime,this.mx.noiseOffset()),t}started(e){this.nodes.push(e),this.sources.push(e),this.mx.stats.started++}},Ie=class extends Fe{constructor(e,t){super(e,!0),T(this,`tone`,void 0),T(this,`freqA`,void 0),T(this,`freqB`,void 0),T(this,`freqC`,void 0),T(this,`freqPulse`,void 0),T(this,`pulseDepth`,void 0),T(this,`cutoff`,void 0),T(this,`motor`,void 0),T(this,`raspFreq`,void 0),T(this,`rasp`,void 0),T(this,`hiss`,void 0),T(this,`hissFreq`,void 0),T(this,`wind`,void 0),T(this,`windFreq`,void 0),T(this,`squeal`,void 0),T(this,`squealFreqA`,void 0),T(this,`squealFreqB`,void 0),T(this,`rumble`,void 0),T(this,`wander`,0),T(this,`rumbleTimer`,0),T(this,`rumbleLevel`,1);let n=Ee[(t%Ee.length+Ee.length)%Ee.length];this.tone=n;let r=this.gain(we);r.connect(e.engineIn);let i=this.osc(`sawtooth`,n.idle),a=this.osc(n.sub,n.idle/2),o=this.osc(`sawtooth`,n.idle*n.ratio),s=this.gain(.34),c=this.gain(.8),l=this.gain(.4);i.connect(s),a.connect(c),c.connect(s),o.connect(l),l.connect(s);let u=this.noise(!1),d=this.filter(`bandpass`,900,1.4),f=this.gain(0);u.connect(d),d.connect(f),f.connect(s);let p=this.filter(`peaking`,n.formant,1.6);p.gain.value=8;let m=this.filter(`lowpass`,400,.9);s.connect(p),p.connect(m);let h=this.gain(1),g=this.osc(`sine`,n.idle/2),_=this.gain(0);g.connect(_),_.connect(h.gain);let v=this.gain(0);m.connect(h),h.connect(v),v.connect(r);let y=this.filter(`bandpass`,1600,.7),b=this.gain(0);u.connect(y),y.connect(b),b.connect(r);let x=this.filter(`lowpass`,400,.5),S=this.gain(0);u.connect(x),x.connect(S),S.connect(r);let C=this.filter(`bandpass`,1e3,16),w=this.filter(`bandpass`,1520,10),E=this.gain(.45),D=this.gain(0);u.connect(C),u.connect(w),C.connect(D),w.connect(E),E.connect(D),D.connect(r);let O=this.noise(!0),k=this.filter(`lowpass`,170,1.5),A=this.gain(0);O.connect(k),k.connect(A),A.connect(r),this.freqA=new Ne(i.frequency),this.freqB=new Ne(a.frequency),this.freqC=new Ne(o.frequency),this.freqPulse=new Ne(g.frequency),this.pulseDepth=new Ne(_.gain),this.cutoff=new Ne(m.frequency),this.motor=new Ne(v.gain),this.raspFreq=new Ne(d.frequency),this.rasp=new Ne(f.gain),this.hiss=new Ne(b.gain),this.hissFreq=new Ne(y.frequency),this.wind=new Ne(S.gain),this.windFreq=new Ne(x.frequency),this.squeal=new Ne(D.gain),this.squealFreqA=new Ne(C.frequency),this.squealFreqB=new Ne(w.frequency),this.rumble=new Ne(A.gain)}update(e,t,n){let r=this.rev;r.step(e,t);let{rpm:i,load:a,cut:o}=r,s=this.tone,c=ge(t.speed,0,1.5),l=+!t.air;this.wander+=(Math.random()-.5)*e*14,this.wander*=Math.exp(-e*3),this.wander=ge(this.wander,-1,1);let u=(s.idle+(s.top-s.idle)*i)*(o<1?.8:1);this.freqA.set(u,n,.02),this.freqB.set(u*.5,n,.02),this.freqC.set(u*s.ratio,n,.02),this.freqPulse.set(u*.5,n,.02),this.pulseDepth.set((.42-.3*Math.min(1,i))*(1.25-.25*a),n,.05),this.cutoff.set(260+(700+2400*a)*i**1.2,n,.04),this.motor.set((.5+.5*a)*(.72+.28*Math.min(1,i))*o,n,o<1?.006:.02),this.raspFreq.set(600+1700*i,n,.05),this.rasp.set((.1+.5*i)*(.4+.6*a),n,.05),this.hiss.set(t.boost?.3+.05*this.wander:0,n,t.boost?.04:.14),this.hissFreq.set(1500+700*Math.min(1.4,c)+250*this.wander,n,.05),this.wind.set(.16*c*c*(t.air?1.5:1),n,.1),this.windFreq.set(300+1e3*c,n,.1);let d=t.drift>0&&l>0,f=900*2**(ge(t.drift,0,3)*.37)*(1+.035*this.wander);this.squeal.set(d?1.1*Math.min(1,c/.45):0,n,d?.03:.07),this.squealFreqA.set(f,n,.04),this.squealFreqB.set(f*1.52,n,.04),this.rumbleTimer-=e,this.rumbleTimer<=0&&(this.rumbleLevel=.45+.55*Math.random(),this.rumbleTimer=.04+Math.random()*.05);let p=t.offroad&&l>0;this.rumble.set(p?1.5*Math.min(1,c/.4)*this.rumbleLevel:0,n,p?.02:.08)}fade(e){for(let t of[this.motor,this.rasp,this.hiss,this.wind,this.squeal,this.rumble])t.set(0,e,.05)}},Le=class extends Fe{constructor(e,t){super(e,!1),T(this,`tone`,void 0),T(this,`freq`,void 0),T(this,`cutoff`,void 0),T(this,`level`,void 0),T(this,`pan`,void 0);let n=Ee[(t%Ee.length+Ee.length)%Ee.length];this.tone=n;let r=this.osc(n.far,n.idle),i=this.filter(`lowpass`,300,2),a=this.gain(0);r.connect(i),i.connect(a);let o=e.panner(0);o?(this.nodes.push(o),a.connect(o),o.connect(e.engineIn)):a.connect(e.engineIn),this.freq=new Ne(r.frequency),this.cutoff=new Ne(i.frequency),this.level=new Ne(a.gain),this.pan=o?new Ne(o.pan):null}update(e,t,n){let r=this.rev;r.step(e,t);let{rpm:i,load:a,cut:o}=r,s=this.tone,c=ge(1-t.distance/Te,0,1);this.freq.set((s.idle+(s.top-s.idle)*i)*(o<1?.8:1),n,.03),this.cutoff.set(240+(500+1300*a)*i*(.4+.6*c),n,.05),this.level.set(R*c*c*(.55+.45*a)*(.7+.3*Math.min(1,i))*o,n,.04),this.pan?.set(ge(t.pan,-1,1)*.85,n,.05)}fade(e){this.level.set(0,e,.05)}},Re=class{constructor(e){T(this,`mx`,void 0),T(this,`voices`,new Map),T(this,`seen`,new Set),this.mx=e}update(e,t){let n=ge(Number.isFinite(e)?e:0,0,.1),r=this.mx.ctx.currentTime,i=this.seen;i.clear();for(let e of t){if(i.has(e.slot))continue;let t=this.voices.get(e.slot);if(t&&t.local!==e.local&&(t.dispose(),this.voices.delete(e.slot),t=void 0),!t){if(!e.local&&(e.distance>=Te||this.voices.size>=z))continue;t=e.local?new Ie(this.mx,e.slot):new Le(this.mx,e.slot),this.voices.set(e.slot,t)}i.add(e.slot),t.missing=0,t.update(n,e,r)}for(let[e,t]of this.voices)i.has(e)||(t.missing===0&&t.fade(r),t.missing+=Math.max(n,.001),t.missing>B&&(t.dispose(),this.voices.delete(e)))}release(){if(this.voices.size===0)return;let e=this.mx.ctx.currentTime;for(let t of this.voices.values())t.fade(e),t.dispose();this.voices.clear()}get voiceCount(){return this.voices.size}},ze={menu:{bpm:104,swing:.14,race:!1,level:1,lead:{wave:`pulse25`,cutoff:2100,gain:.2,detune:7,vibrato:7,send:.3,gate:.86},bass:{wave:`triangle`,cutoff:620,pluck:500,q:1.2,gain:.5,gate:.8},comp:{wave:`triangle`,cutoff:1900,gain:.13,gate:.55,send:.25,low:55,pan:.25},drums:{kick:.62,snare:.26,hat:.07,perc:`shaker`,percGain:.07},order:`AB`,sections:{A:{bars:8,melody:`- a4 c5 f5:3 e5:3 c5:4 | - a4 c5 d5:3 f5:3 a4:4
             | - bb4 d5 f5:3 a5:3 g5:4 | e5:3 g5:3 e5 d5:4 c5 -
             | - a4 c5 f5:3 e5:3 c5:4 | - a4 c5 d5:3 f5:3 a5:4
             | g5:3 f5:3 d5 bb4:4 d5 c5 | c5:6 e5 g5 bb5:4 -`,bass:`f2:3 f2:3 c3 - f2 a2 c3 | d2:3 d2:3 a2 - d2 f2 a2
           | bb2:3 bb2:3 f2 - bb2 d3 f3 | c3:3 c3:3 g2 - c3 bb2 g2
           | f2:3 f2:3 c3 - f2 a2 c3 | d2:3 d2:3 a2 - d2 f2 a2
           | g2:3 g2:3 d3 - g2 bb2 d3 | c3:3 c3:3 g2 - c3 d3 e3`,chords:`Fmaj7 | Dm7 | Bbmaj7 | C7 | Fmaj7 | Dm7 | Gm7 | C7`,comp:`....x..x....x...|....x..x..x.x...`,kick:`x.....x...x.....|x.....x...x..x..`,snare:`....x.......x...|....x.......x..g`,hat:`x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.o.`,perc:`..g...g...g...g.`},B:{bars:8,melody:`a5:4 f5 d5 f5:4 - d5 | g5:4 e5 c5 e5:6 -
             | f5:4 d5 bb4 d5:4 f5 g5 | e5:3 d5:3 c5 e5:4 g5:4
             | a5:4 f5 d5 f5:4 a5 bb5 | c6:4 a5 e5 g5:6 -
             | f5:3 e5:3 d5 a4:4 d5 f5 | g5:4 bb5 a5 g5:3 e5:3 c5`,bass:`bb2:4 - bb2 f2:4 bb2 d3 | a2:4 - a2 e2:4 a2 c3
           | g2:4 - g2 d2:4 g2 bb2 | c3:4 - c3 g2:4 c3 e3
           | bb2:4 - bb2 f2:4 bb2 d3 | a2:4 - a2 e2:4 a2 c3
           | d3:4 - d3 a2:4 d3 c3 | g2:3 g2:3 d3 c3:3 c3:3 e3`,chords:`Bbmaj7 | Am7 | Gm7 | C7 | Bbmaj7 | Am7 | Dm7 | Gm7 C7`,comp:`x..x..x.....x...`,kick:`x.....x.x.......|x.....x.x.....x.`,snare:`....x.......x...`,hat:`x.xgx.xgx.xgx.o.`,perc:`..g...g...g...g.`}}},werkshof:{bpm:124,swing:.1,race:!0,level:1,lead:{wave:`pulse25`,cutoff:2500,gain:.2,detune:6,vibrato:6,send:.22,gate:.8},bass:{wave:`sawtooth`,cutoff:420,pluck:1500,q:4,gain:.34,gate:.72},comp:{wave:`pulse12`,cutoff:2300,gain:.085,gate:.4,send:.12,low:57,pan:.3},drums:{kick:.7,snare:.3,hat:.075,perc:`clank`,percGain:.1},order:`AB`,sections:{A:{bars:8,melody:`-:4 b4 d5 e5:3 d5:1 b4 g4 | a4:3 b4:3 -:10
             | -:4 c#5 e5 g5:3 e5:1 c#5 a4 | b4:3 c#5:3 e5:4 -:6
             | -:4 b4 d5 e5:3 g5:1 e5 d5 | e5:3 g5:3 b5:6 -:4
             | bb5:3 g5:3 e5 c5:3 e5:3 g5 | f#5:3 d#5:3 b4 a4:3 b4:5`,bass:`e2 -:1 e2:1 - e3 -:1 d3:1 e3:1 -:1 g2 a2 | e2 -:1 e2:1 - e3 -:1 d3:1 e3:1 -:1 b2 d3
           | a2 -:1 a2:1 - a3 -:1 g3:1 a3:1 -:1 c3 c#3 | a2 -:1 a2:1 - a3 -:1 g3:1 a3:1 -:1 d3 d#3
           | e2 -:1 e2:1 - e3 -:1 d3:1 e3:1 -:1 g2 a2 | e2 -:1 e2:1 - e3 -:1 d3:1 e3:1 -:1 b2 d3
           | c3 -:1 c3:1 - c3:1 -:1 bb2 g2:1 bb2:1 c3 - | b2 -:1 b2:1 - b2:1 -:1 a2 f#2:1 a2:1 b2 d#3`,chords:`Em7 | Em7 | A7 | A7 | Em7 | Em7 | C7 | B7`,comp:`..x..x.x..x..x..|..x..x.x..x.x..x`,kick:`x..x......x.....|x..x......x..x..`,snare:`....x..g.g..x...|....x..g.g..x..g`,hat:`x.xxx.x.x.xxx.x.|x.xxx.x.x.xxx.o.`,perc:`......x.........|......x...x.....`},B:{bars:8,melody:`e5:4 c5 a4 c5:3 e5:3 g5 | f#5:4 d5 a4 d5:3 f#5:3 a5
             | b5:3 a5:3 g5 d5:4 g5 a5 | g5:3 e5:3 c5 e5:6 -
             | e5:4 c5 a4 c5:3 e5:3 a5 | c6:3 a5:3 f#5 d5:4 f#5 a5
             | b5:3 g5:3 e5 d5:3 e5:5 | d#5 f#5 a5 b5:4 - b4:1 d5:1 d#5`,bass:`a2:3 a2:1 - e3 a2:1 -:1 g2 a2 c3 | d3:3 d3:1 - a2 d3:1 -:1 c3 d3 f#2
           | g2:3 g2:1 - d3 g2:1 -:1 f#2 g2 b2 | c3:3 c3:1 - g2 c3:1 -:1 b2 c3 e3
           | a2:3 a2:1 - e3 a2:1 -:1 g2 a2 c3 | d3:3 d3:1 - a2 d3:1 -:1 c3 d3 f#2
           | e2:3 e2:1 - b2 e2:1 -:1 d3 e3 g2 | b2:3 b2:1 - f#2 b2:1 -:1 a2 b2 d#3`,chords:`Am7 | D7 | Gmaj7 | Cmaj7 | Am7 | D7 | Em7 | B7`,comp:`x..x..x...x..x..`,kick:`x.....x...x.....|x.....x...x..x..`,snare:`....x.......x...|....x.......x.gg`,hat:`x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.o.`,perc:`..x.......x.....`}}},klippe:{bpm:138,swing:0,race:!0,level:1,lead:{wave:`pulse25`,cutoff:2700,gain:.19,detune:8,vibrato:7,send:.34,gate:.88},bass:{wave:`pulse25`,cutoff:520,pluck:700,q:1.5,gain:.33,gate:.6},comp:{wave:`triangle`,cutoff:3e3,gain:.15,gate:.6,send:.4,low:62,pan:-.3},drums:{kick:.66,snare:.27,hat:.07,perc:`shaker`,percGain:.065},order:`AB`,sections:{A:{bars:8,melody:`f#5:4 a5 d6:4 c#6 a5 f#5 | e5:4 a5 c#6:4 b5 a5 e5
             | d5:4 f#5 b5:4 a5 f#5 d5 | b5:3 a5:3 g5 d5:6 -
             | f#5:4 a5 d6:4 e6 d6 a5 | c#6:4 e6 c#6:4 b5 a5 e5
             | g5:3 b5:3 d6 b5:3 g5:3 b5 | a5:6 c#6 e6:6 -`,bass:`d2 d2 d3 d2 d2 d3 a2 d3 | a2 a2 a3 a2 a2 a3 e3 a2
           | b2 b2 b3 b2 b2 b3 f#3 b2 | g2 g2 g3 g2 g2 g3 d3 g2
           | d2 d2 d3 d2 d2 d3 a2 d3 | a2 a2 a3 a2 a2 a3 e3 a2
           | g2 g2 g3 g2 g2 g3 d3 g2 | a2 a2 a3 a2 a2 a3 c#3 e3`,chords:`D | A | Bm | G | D | A | G | A`,comp:`0.1.2.1.3.2.1.2.`,kick:`x...x...x...x...`,snare:`....x.......x...|....x.......x.x.`,hat:`g.x.g.x.g.x.g.x.`,perc:`x.gxx.gxx.gxx.gx`},B:{bars:8,melody:`d6:6 b5 g5:4 b5 d6 | c#6:6 a5 e5:4 a5 c#6
             | a5:3 f#5:3 c#5 f#5:4 a5 c#6 | b5:6 f#5 d5:6 -
             | d6:6 b5 g5:4 b5 d6 | e6:6 c#6 a5:4 c#6 e6
             | d6:3 a5:3 f#5 d5:4 f#5 a5 | e5 a5 c#6 e6:4 c#6 a5:4`,bass:`g2 g2 g3 g2 g2 g3 d3 g2 | a2 a2 a3 a2 a2 a3 e3 a2
           | f#2 f#2 f#3 f#2 f#2 f#3 c#3 f#2 | b2 b2 b3 b2 b2 b3 f#3 b2
           | g2 g2 g3 g2 g2 g3 d3 g2 | a2 a2 a3 a2 a2 a3 e3 a2
           | d2 d2 d3 d2 d2 d3 a2 d3 | a2 a2 a3 a2 e3 e3 c#3 a2`,chords:`G | A | F#m | Bm | G | A | D | A`,comp:`0.2.3.2.0.2.3.2.|1.2.3.2.1.2.3.4.`,kick:`x.....x.x.....x.|x.....x.x...x...`,snare:`....x.......x...`,hat:`x.x.x.x.x.x.x.o.`,perc:`x.gxx.gxx.gxx.gx`}}},glut:{bpm:148,swing:0,race:!0,level:1,lead:{wave:`sawtooth`,cutoff:2e3,gain:.15,detune:10,vibrato:8,send:.24,gate:.84},bass:{wave:`sawtooth`,cutoff:330,pluck:900,q:3,gain:.38,gate:.62},comp:{wave:`pulse25`,cutoff:1700,gain:.075,gate:.5,send:.15,low:53,pan:.2},drums:{kick:.72,snare:.3,hat:.06,perc:`tom`,percGain:.4},order:`AB`,sections:{A:{bars:8,melody:`d5:3 d5:3 f5 e5:3 d5:3 a4 | d5:3 d5:3 f5 a5:4 g5 f5
             | d5:3 d5:3 f5 g5:3 f5:3 d5 | e5:3 e5:3 g5 c6:4 bb5 g5
             | a5:3 a5:3 f5 d5:3 f5:3 a5 | d6:6 c6 a5:4 f5 a5
             | bb5:3 a5:3 f5 d5:3 f5:3 bb5 | a5:4 e5 c#5:4 e5 a5 c#6`,bass:`d2 d2:1 d2:1 d2 d2:1 d2:1 d2 d2:1 d2:1 d3 c3 | d2 d2:1 d2:1 d2 d2:1 d2:1 d2 d2:1 d2:1 d3 a2
           | bb1 bb1:1 bb1:1 bb1 bb1:1 bb1:1 bb1 bb1:1 bb1:1 bb2 a2 | c2 c2:1 c2:1 c2 c2:1 c2:1 c2 c2:1 c2:1 c3 e2
           | d2 d2:1 d2:1 d2 d2:1 d2:1 d2 d2:1 d2:1 d3 c3 | d2 d2:1 d2:1 d2 d2:1 d2:1 d2 d2:1 d2:1 d3 a2
           | bb1 bb1:1 bb1:1 bb1 bb1:1 bb1:1 bb1 bb1:1 bb1:1 bb2 f2 | a1 a1:1 a1:1 a1 a1:1 a1:1 a1 a1:1 a1:1 a2 c#3`,chords:`Dm | Dm | Bb | C | Dm | Dm | Bb | A`,comp:`x..x..x...x..x..`,kick:`x...x...x...x..x|x...x...x...x.x.`,snare:`....x.......x...|....x.......x..x`,hat:`x.xgx.xgx.xgx.xg`,perc:`................|................|................|..........x.x.xx`},B:{bars:8,melody:`d6:6 bb5 g5:6 bb5 | a5:6 f5 d5:6 f5
             | f5:3 g5:3 a5 bb5:4 d6:4 | c#6:6 a5 e5:4 a5 c#6
             | d6:6 bb5 g5:4 bb5 d6 | f6:6 d6 a5:6 d6
             | eb6:3 d6:3 bb5 g5:3 bb5:3 eb5 | e5:3 a5:3 c#6 e6:4 c#6 a5`,bass:`g2 g2:1 g2:1 g2 g2:1 g2:1 g2 g2:1 g2:1 d2 f2 | d2 d2:1 d2:1 d2 d2:1 d2:1 d2 d2:1 d2:1 d3 c3
           | bb1 bb1:1 bb1:1 bb1 bb1:1 bb1:1 bb1 bb1:1 bb1:1 bb2 f2 | a1 a1:1 a1:1 a1 a1:1 a1:1 a1 a1:1 a1:1 a2 e2
           | g2 g2:1 g2:1 g2 g2:1 g2:1 g2 g2:1 g2:1 d2 f2 | d2 d2:1 d2:1 d2 d2:1 d2:1 d2 d2:1 d2:1 d3 c3
           | eb2 eb2:1 eb2:1 eb2 eb2:1 eb2:1 eb2 eb2:1 eb2:1 bb1 eb2 | a1 a1:1 a1:1 a1 a1:1 a1:1 a1 a1:1 a1:1 a2 c#3`,chords:`Gm | Dm | Bb | A | Gm | Dm | Eb | A`,comp:`0.1.2.3.2.1.2.3.`,kick:`x.....x.x...x...|x.....x.x...x.x.`,snare:`....x.......x...`,hat:`xgxgxgxgxgxgxgxg`,perc:`................|............x.xx`}}},nacht:{bpm:128,swing:0,race:!0,level:1,lead:{wave:`square`,cutoff:1900,gain:.15,detune:9,vibrato:6,send:.4,gate:.82},bass:{wave:`pulse25`,cutoff:360,pluck:1900,q:5,gain:.36,gate:.55},comp:{wave:`pulse12`,cutoff:2600,gain:.1,gate:.42,send:.45,low:56,pan:-.25},drums:{kick:.74,snare:.22,hat:.07,perc:`clap`,percGain:.2},order:`AB`,sections:{A:{bars:8,melody:`- c5:3 eb5:3 f5:4 - eb5 | c5:3 ab4:3 bb4:6 -:4
             | - c5:3 eb5:3 f5:4 - ab5 | g5:3 eb5:3 bb4:6 -:4
             | - c5:3 eb5:3 f5:4 - g5 | ab5:3 g5:3 eb5:3 c5:3 eb5:4
             | f5:3 ab5:3 c6:6 - bb5 | g5:3 e5:3 c5:3 e5:3 g5:4`,bass:`f2:3 f2:3 f3 -:1 f2 eb3:1 f3 c3 | f2:3 f2:3 f3 -:1 f2 eb3:1 f3 c3
           | db2:3 db2:3 db3 -:1 db2 c3:1 db3 ab2 | eb2:3 eb2:3 eb3 -:1 eb2 db3:1 eb3 bb2
           | f2:3 f2:3 f3 -:1 f2 eb3:1 f3 c3 | f2:3 f2:3 f3 -:1 f2 eb3:1 f3 c3
           | db2:3 db2:3 db3 -:1 db2 c3:1 db3 ab2 | c2:3 c2:3 c3 -:1 c2 bb2:1 c3 e2`,chords:`Fm9 | Fm9 | Dbmaj7 | Eb | Fm9 | Fm9 | Dbmaj7 | C7`,comp:`0..1..2.0..1..3.`,kick:`x...x...x...x...`,snare:`....x.......x...`,hat:`..o.g.o...o.g.o.`,perc:`....x.......x...|....x.......x.x.`},B:{bars:8,melody:`f5:6 db5 bb4:3 db5:3 f5 | g5:6 eb5 db5:3 eb5:3 g5
             | c6:3 bb5:3 ab5 eb5:3 ab5:3 c6 | ab5:6 f5 c5:6 -
             | f5:6 db5 bb4:3 db5:3 f5 | g5:6 bb5 db6:3 bb5:3 g5
             | ab5:3 f5:3 c5 f5:3 ab5:3 c6 | bb5:3 g5:3 e5 c5:4 - c5:1 e5:1`,bass:`bb1:3 bb1:3 bb2 -:1 bb1 ab2:1 bb2 f2 | eb2:3 eb2:3 eb3 -:1 eb2 db3:1 eb3 bb2
           | ab2:3 ab2:3 ab3 -:1 ab2 g3:1 ab3 eb3 | db2:3 db2:3 db3 -:1 db2 c3:1 db3 ab2
           | bb1:3 bb1:3 bb2 -:1 bb1 ab2:1 bb2 f2 | eb2:3 eb2:3 eb3 -:1 eb2 db3:1 eb3 bb2
           | f2:3 f2:3 f3 -:1 f2 eb3:1 f3 c3 | c2:3 c2:3 c3 -:1 c2 bb2:1 c3 e2`,chords:`Bbm7 | Eb7 | Abmaj7 | Dbmaj7 | Bbm7 | Eb7 | Fm | C7`,comp:`x..x..x...x..x..`,kick:`x...x...x...x...|x...x...x...x.x.`,snare:`....x.......x...`,hat:`x.o.x.o.x.o.x.o.`,perc:`....x.......x...`}}},results:{bpm:96,swing:.18,race:!1,level:1,lead:{wave:`triangle`,cutoff:3200,gain:.3,detune:6,vibrato:8,send:.3,gate:.88},bass:{wave:`triangle`,cutoff:700,pluck:400,q:1,gain:.5,gate:.85},comp:{wave:`pulse25`,cutoff:1500,gain:.075,gate:.5,send:.3,low:55,pan:.25},drums:{kick:.6,snare:.22,hat:.06,perc:`shaker`,percGain:.07},order:`AB`,sections:{A:{bars:8,melody:`e5:4 g5 c6:6 a5 g5 | e5:4 g5 a5:6 g5 e5
             | f5:4 a5 c6:4 a5 f5 a5 | g5:6 d5 b4:4 d5 g5
             | e5:4 g5 c6:6 d6 c6 | e6:4 c6 a5:6 g5 e5
             | f5:3 a5:3 d6 c6:3 a5:3 f5 | g5:8 b5:4 d6:4`,bass:`c3:6 g2 c3:4 e3 g2 | a2:6 e2 a2:4 c3 e3
           | f2:6 c3 f2:4 a2 c3 | g2:6 d3 g2:4 b2 d3
           | c3:6 g2 c3:4 e3 g2 | a2:6 e2 a2:4 c3 e3
           | d3:6 a2 d3:4 f3 a2 | g2:6 d3 g2:4 a2 b2`,chords:`C | Am7 | Fmaj7 | G | C | Am7 | Dm7 | G`,comp:`....x.....x.x...`,kick:`x.....x.x.......|x.....x.x.....x.`,snare:`....x.......x...`,hat:`x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.o.`,perc:`..g...g...g...g.`},B:{bars:8,melody:`c6:3 a5:3 f5 a5:4 c6 a5 | b5:3 g5:3 d5 g5:4 b5 d6
             | g5:3 e5:3 b4 e5:4 g5 b5 | a5:6 e5 c5:6 -
             | c6:3 a5:3 f5 a5:4 c6 d6 | d6:3 b5:3 g5 b5:4 d6 b5
             | c6:6 g5 e5:4 g5 c6 | e6:4 c6 g5 c6:6 -`,bass:`f2:6 c3 f2:4 a2 c3 | g2:6 d3 g2:4 b2 d3
           | e2:6 b2 e2:4 g2 b2 | a2:6 e3 a2:4 g2 e2
           | f2:6 c3 f2:4 a2 c3 | g2:6 d3 g2:4 b2 d3
           | c3:6 g2 c3:4 e3 g2 | c3:6 g2 c3:4 g2 b2`,chords:`F | G | Em7 | Am7 | F | G | C | C`,comp:`x.....x...x.....`,kick:`x.....x...x.....`,snare:`....x.......x..g`,hat:`x.xgx.xgx.xgx.o.`,perc:`..g...g...g...g.`}}}},Be=16,Ve={c:0,d:2,e:4,f:5,g:7,a:9,b:11},He={"":[0,4,7],m:[0,3,7],7:[0,4,7,10],m7:[0,3,7,10],maj7:[0,4,7,11],9:[4,7,10,14],m9:[3,7,10,14],sus4:[0,5,7],dim:[0,3,6]};function Ue(e){return e.split(`|`).map(e=>e.trim()).filter(e=>e.length>0)}function We(e,t){let n=/^([a-g])([#b]?)(\d)$/.exec(e);if(!n)throw Error(`${t}: unbekannter Ton "${e}"`);let r=n[2]===`#`?1:n[2]===`b`?-1:0;return 12*(Number(n[3])+1)+Ve[n[1]]+r}function Ge(e,t,n){let r=Array(t*Be).fill(null),i=Ue(e),a=null;for(let e=0;e<t;e++){let t=i[e%i.length].split(/\s+/),o=0;for(let i of t){let[t,s]=i.split(`:`),c=s===void 0?2:Number(s);if(!Number.isInteger(c)||c<1)throw Error(`${n}, Takt ${e+1}: Länge in "${i}"`);t===`~`?a&&(a.steps+=c):t===`-`?a=null:(a={midi:We(t,`${n}, Takt ${e+1}`),steps:c},o<Be&&(r[e*Be+o]=a)),o+=c}if(o!==Be)throw Error(`${n}, Takt ${e+1}: ${o} statt ${Be} Schritte`)}return r}function Ke(e,t,n){let r=/^([A-G])([#b]?)(.*)$/.exec(e),i=r?He[r[3]]:void 0;if(!r||!i)throw Error(`${n}: unbekannter Akkord "${e}"`);let a=Ve[r[1].toLowerCase()]+(r[2]===`#`?1:r[2]===`b`?-1:0);return i.map(e=>t+((a+e-t)%12+12)%12).sort((e,t)=>e-t)}function qe(e,t,n,r){let i=[],a=Ue(e);for(let e=0;e<t;e++){let t=a[e%a.length].split(/\s+/);if(Be%t.length!==0)throw Error(`${r}, Takt ${e+1}: Akkorde nicht teilbar`);let o=Be/t.length;for(let a of t){let t=Ke(a,n,`${r}, Takt ${e+1}`);for(let e=0;e<o;e++)i.push(t)}}return i}function Je(e,t,n){let r=Ue(e.replace(/\s+/g,``)),i=``;for(let e=0;e<t;e++){let t=r[e%r.length];if(t.length!==Be)throw Error(`${n}, Takt ${e+1}: ${t.length} Zeichen`);i+=t}return i}function Ye(e,t){let n=[];for(let r=0;r<e.length;r++){let i=e[r],a=t[r],o=1;for(;(r+o)%Be!==0&&`.-`.includes(e[r+o]);)o++;if(i===`x`||i===`X`||i===`o`)n.push({midis:a,steps:i===`o`?o:Math.min(o,2),vel:i===`X`?1.2:i===`o`?.8:1});else if(i>=`0`&&i<=`9`){let e=Number(i),t=a[e%a.length]+12*Math.floor(e/a.length);n.push({midis:[t],steps:Math.min(o,3),vel:1})}else n.push(null)}return n}function Xe(e,t){let n=[];for(let r of e)r===`x`?n.push(1):r===`X`?n.push(1.25):r===`g`?n.push(.4):r===`o`?n.push(t?-1:.7):n.push(0);return n}function Ze(e,t=`Stück`){let n={def:e,steps:0,lead:[],bass:[],comp:[],kick:[],snare:[],hat:[],perc:[]};for(let r of e.order){let i=e.sections[r];if(!i)throw Error(`${t}: Abschnitt "${r}" fehlt`);let a=`${t}/${r}`,o=qe(i.chords,i.bars,e.comp.low,`${a} Akkorde`);n.lead.push(...Ge(i.melody,i.bars,`${a} Melodie`)),n.bass.push(...Ge(i.bass,i.bars,`${a} Bass`)),n.comp.push(...Ye(Je(i.comp,i.bars,`${a} Begleitung`),o)),n.kick.push(...Xe(Je(i.kick,i.bars,`${a} Kick`),!1)),n.snare.push(...Xe(Je(i.snare,i.bars,`${a} Snare`),!1)),n.hat.push(...Xe(Je(i.hat,i.bars,`${a} Hi-Hat`),!0)),n.perc.push(...Xe(Je(i.perc??`................`,i.bars,`${a} Percussion`),!1)),n.steps+=i.bars*Be}return n}var Qe=.12,$e=1.12,et=2,tt=1,nt=3,rt=class{constructor(e,t,n,r){T(this,`mx`,void 0),T(this,`song`,void 0),T(this,`out`,void 0),T(this,`nodes`,[]),T(this,`sources`,[]),T(this,`leadA`,void 0),T(this,`leadB`,void 0),T(this,`leadEnv`,void 0),T(this,`vibDepth`,void 0),T(this,`bassOsc`,void 0),T(this,`bassLp`,void 0),T(this,`bassEnv`,void 0),T(this,`compOsc`,[]),T(this,`compEnv`,[]),T(this,`kickOsc`,void 0),T(this,`kickEnv`,void 0),T(this,`snareOsc`,void 0),T(this,`snareBody`,void 0),T(this,`snareNoise`,void 0),T(this,`hatEnv`,void 0),T(this,`percEnv`,void 0),T(this,`percOsc`,null),T(this,`echo`,void 0),T(this,`step`,0),T(this,`nextTime`,void 0),T(this,`tempo`,1),T(this,`shift`,0),T(this,`arp`,0),T(this,`echoTime`,void 0),T(this,`disposed`,!1),T(this,`dying`,!1),T(this,`endAt`,1/0),this.mx=e,this.song=t;let i=e.ctx,a=t.def,o=tt*a.level;this.out=this.gain(0),this.out.gain.setValueAtTime(0,n),this.out.gain.linearRampToValueAtTime(o,n+Math.max(.005,r)),this.out.connect(e.musicIn),this.echoTime=45/a.bpm,this.echo=i.createDelay(1),this.echo.delayTime.value=this.echoTime;let s=this.filter(`lowpass`,2200,.5),c=this.gain(.3),l=this.gain(.8);this.nodes.push(this.echo),this.echo.connect(s),s.connect(c),c.connect(this.echo),s.connect(l),l.connect(this.out),this.leadEnv=this.gain(0);let u=this.filter(`lowpass`,a.lead.cutoff,.8),d=this.gain(a.lead.gain);if(this.vibDepth=this.gain(0),this.osc(`sine`,5.4).connect(this.vibDepth),this.leadA=this.osc(a.lead.wave,440),this.leadA.connect(this.leadEnv),this.vibDepth.connect(this.leadA.detune),a.lead.detune>0){this.leadB=this.osc(a.lead.wave,440),this.leadB.detune.value=a.lead.detune;let e=this.gain(.7);this.leadB.connect(e),e.connect(this.leadEnv),this.vibDepth.connect(this.leadB.detune)}else this.leadB=null;this.leadEnv.connect(u),u.connect(d),d.connect(this.out),this.send(d,a.lead.send),this.bassOsc=this.osc(a.bass.wave,110),this.bassLp=this.filter(`lowpass`,a.bass.cutoff,a.bass.q),this.bassEnv=this.gain(0);let f=this.gain(a.bass.gain);this.bassOsc.connect(this.bassLp),this.bassLp.connect(this.bassEnv),this.bassEnv.connect(f),f.connect(this.out);let p=this.filter(`lowpass`,a.comp.cutoff,.7),m=this.gain(a.comp.gain);for(let e=0;e<4;e++){let e=this.osc(a.comp.wave,220),t=this.gain(0);e.connect(t),t.connect(p),this.compOsc.push(e),this.compEnv.push(t)}p.connect(m);let h=e.panner(a.comp.pan);h?(this.nodes.push(h),m.connect(h),h.connect(this.out)):m.connect(this.out),this.send(m,a.comp.send);let g=e.noise();this.sources.push(g),this.nodes.push(g),e.stats.started++,g.start(i.currentTime,e.noiseOffset()),this.kickOsc=this.osc(`sine`,50),this.kickEnv=this.gain(0),this.kickOsc.connect(this.kickEnv),this.kickEnv.connect(this.out),this.snareOsc=this.osc(`triangle`,180),this.snareBody=this.gain(0),this.snareOsc.connect(this.snareBody),this.snareBody.connect(this.out);let _=this.filter(`bandpass`,2100,.6);this.snareNoise=this.gain(0),g.connect(_),_.connect(this.snareNoise),this.snareNoise.connect(this.out);let v=this.filter(`highpass`,7200,.8);switch(this.hatEnv=this.gain(0),g.connect(v),v.connect(this.hatEnv),this.hatEnv.connect(this.out),this.percEnv=this.gain(0),this.percEnv.connect(this.out),a.drums.perc){case`shaker`:{let e=this.filter(`bandpass`,5200,1.4);g.connect(e),e.connect(this.percEnv);break}case`clap`:{let e=this.filter(`bandpass`,1350,1.3);g.connect(e),e.connect(this.percEnv);break}case`clank`:{let e=this.filter(`bandpass`,1900,1.2),t=this.osc(`square`,587),n=this.osc(`square`,845);t.connect(e),n.connect(e),e.connect(this.percEnv);break}case`tom`:this.percOsc=this.osc(`sine`,150),this.percOsc.connect(this.percEnv)}this.nextTime=n}schedule(e,t){if(this.disposed)return;this.nextTime<e-.03&&(this.nextTime=e+.02);let n=this.song.def,r=t&&n.race,i=r?$e:1;for(;this.nextTime<e+Qe;){let e=this.step;e%16==0&&(this.shift=r?et:0),this.tempo+=ge(i-this.tempo,-.015,.015);let t=15/(n.bpm*this.tempo),a=this.nextTime+(e%2==1?n.swing*t:0);this.playStep(e,a,t,r),this.nextTime+=t,this.step=(e+1)%this.song.steps}}fadeOut(e,t){let n=Math.max(.02,t);this.dying=!0,this.endAt=e+n+.1,this.out.gain.cancelScheduledValues(e),this.out.gain.setTargetAtTime(0,e,n/5)}dispose(){if(this.disposed)return;this.disposed=!0;let e=this.mx.ctx.currentTime;for(let t of this.sources){try{t.stop(e)}catch{}this.mx.stats.ended++}for(let e of this.nodes)try{e.disconnect()}catch{}}gain(e){let t=this.mx.ctx.createGain();return t.gain.value=e,this.nodes.push(t),t}filter(e,t,n){let r=this.mx.ctx.createBiquadFilter();return r.type=e,r.frequency.value=t,r.Q.value=n,this.nodes.push(r),r}osc(e,t){let n=this.mx.ctx.createOscillator();return this.mx.setWave(n,e),n.frequency.value=t,this.nodes.push(n),this.sources.push(n),this.mx.stats.started++,n.start(this.mx.ctx.currentTime),n}send(e,t){if(t<=0)return;let n=this.gain(t);e.connect(n),n.connect(this.echo)}playStep(e,t,n,r){let i=this.song,a=i.def.drums,o=i.lead[e];o&&this.leadNote(_e(o.midi+this.shift),t,o.steps*n);let s=i.bass[e];s&&this.bassNote(_e(s.midi+this.shift),t,s.steps*n);let c=i.comp[e];if(c){let e=i.def.comp.gate;if(c.midis.length===1)this.compNote(this.arp,_e(c.midis[0]+this.shift),t,c.steps*n,c.vel,e),this.arp=(this.arp+1)%this.compOsc.length;else{let r=Math.min(c.midis.length,this.compOsc.length);for(let i=0;i<r;i++)this.compNote(i,_e(c.midis[i]+this.shift),t,c.steps*n,c.vel*.8,e)}}i.kick[e]>0&&this.kick(t,i.kick[e]*a.kick),i.snare[e]>0&&this.snare(t,i.snare[e]*a.snare,i.snare[e]<.6);let l=i.hat[e];l===0?r&&this.hat(t,.4*a.hat,!1):this.hat(t,Math.abs(l)*a.hat,l<0),i.perc[e]>0&&this.perc(t,i.perc[e]*a.percGain,e%16);let u=nt*n;Math.abs(u-this.echoTime)>1e-4&&(this.echoTime=u,this.echo.delayTime.setTargetAtTime(u,t,.1))}leadNote(e,t,n){let r=this.song.def.lead;this.leadA.frequency.setValueAtTime(e,t),this.leadB?.frequency.setValueAtTime(e,t);let i=Math.max(t+.05,t+n*r.gate),a=this.leadEnv.gain;a.setTargetAtTime(1,t,.006),a.setTargetAtTime(.7,t+.035,.12),a.setTargetAtTime(0,i,.035);let o=this.vibDepth.gain;o.setValueAtTime(0,t),r.vibrato>0&&n>.3&&o.setTargetAtTime(r.vibrato,t+.16,.1)}bassNote(e,t,n){let r=this.song.def.bass;this.bassOsc.frequency.setValueAtTime(e,t);let i=this.bassLp.frequency;i.setValueAtTime(r.cutoff+r.pluck,t),i.setTargetAtTime(r.cutoff,t,.06);let a=Math.max(t+.04,t+n*r.gate),o=this.bassEnv.gain;o.setTargetAtTime(1,t,.004),o.setTargetAtTime(.75,t+.03,.15),o.setTargetAtTime(0,a,.025)}compNote(e,t,n,r,i,a){this.compOsc[e].frequency.setValueAtTime(t,n);let o=Math.max(n+.03,n+r*a),s=this.compEnv[e].gain;s.setTargetAtTime(i,n,.004),s.setTargetAtTime(i*.55,n+.025,.08),s.setTargetAtTime(0,o,.04)}kick(e,t){let n=this.kickOsc.frequency;n.setValueAtTime(160,e),n.exponentialRampToValueAtTime(47,e+.07);let r=this.kickEnv.gain;r.setTargetAtTime(t,e,.0012),r.setTargetAtTime(0,e+.03,.05)}snare(e,t,n){let r=this.snareNoise.gain;r.setTargetAtTime(t,e,.001),r.setTargetAtTime(0,e+.008,n?.018:.045);let i=this.snareOsc.frequency;i.setValueAtTime(245,e),i.exponentialRampToValueAtTime(175,e+.045);let a=this.snareBody.gain;a.setTargetAtTime(t*.7,e,.001),a.setTargetAtTime(0,e+.01,.028)}hat(e,t,n){let r=this.hatEnv.gain;r.setTargetAtTime(t,e,8e-4),r.setTargetAtTime(0,e+.004,n?.065:.013)}perc(e,t,n){let r=this.percEnv.gain;switch(this.song.def.drums.perc){case`shaker`:r.setTargetAtTime(t,e,.006),r.setTargetAtTime(0,e+.02,.018);break;case`clap`:for(let n=0;n<3;n++)r.setTargetAtTime(t,e+n*.011,8e-4),r.setTargetAtTime(t*.15,e+n*.011+.004,.003);r.setTargetAtTime(t*.9,e+.033,8e-4),r.setTargetAtTime(0,e+.037,.05);break;case`clank`:r.setTargetAtTime(t,e,8e-4),r.setTargetAtTime(0,e+.004,.03);break;case`tom`:{let i=230-n*6;this.percOsc&&(this.percOsc.frequency.setValueAtTime(i,e),this.percOsc.frequency.exponentialRampToValueAtTime(i*.6,e+.08)),r.setTargetAtTime(t,e,.0015),r.setTargetAtTime(0,e+.02,.05);break}}}},it=class{constructor(e){T(this,`mx`,void 0),T(this,`decks`,[]),T(this,`songs`,new Map),T(this,`current`,null),T(this,`id`,null),T(this,`finalLap`,!1),this.mx=e}play(e,t=.7){if(e===this.id)return;let n=this.mx.ctx.currentTime,r=this.current!==null;if(this.current&&this.current.fadeOut(n,t),this.current=null,this.id=e,e===null)return;let i=this.song(e);i&&(this.current=r?new rt(this.mx,i,n+.25,.3):new rt(this.mx,i,n+.06,.01),this.decks.push(this.current),this.pump())}setFinalLap(e){this.finalLap=e}pump(){let e=this.mx.ctx.currentTime;for(let t=this.decks.length-1;t>=0;t--){let n=this.decks[t];n.dying&&e>=n.endAt?(n.dispose(),this.decks.splice(t,1)):n.schedule(e,this.finalLap)}}get deckCount(){return this.decks.length}song(e){let t=this.songs.get(e);if(t===void 0){try{t=Ze(ze[e],e)}catch(e){console.warn(`[audio] Musik nicht lesbar:`,e),t=null}this.songs.set(e,t)}return t}},at=16,ot={"roulette-tick":.06,wall:.25,bump:.2,land:.15,"drift-start":.2,boost:.12},st=.04,ct={"ui-click":3,"ui-back":2.7,join:1.1,ready:1.3,count:3,go:3,boost:4.6,turbo1:3.8,turbo2:4,turbo3:4.4,"drift-start":13,pickup:1.8,"roulette-tick":3.8,"item-ready":1.3,"use-tire":3,"use-oil":3.2,"use-top":2.8,"use-guard":3.6,"use-emp":3.4,"use-smoke":2.2,"use-spring":3.8,hit:3.8,"guard-block":4.4,stall:2.2,bump:3.4,wall:3.1,land:3.4,fall:3.8,respawn:3,lap:1.4,"final-lap":1.45,finish:1.35,win:1.5,lose:1.3},lt=class{constructor(e,t,n){T(this,`mx`,void 0),T(this,`out`,void 0),T(this,`t0`,void 0),T(this,`end`,0),T(this,`sources`,[]),this.mx=e;let r=e.ctx;this.t0=r.currentTime+.006,this.out=r.createGain(),this.out.gain.value=t;let i=n===0?null:e.panner(n);i?(this.out.connect(i),i.connect(e.sfxIn)):this.out.connect(e.sfxIn)}track(e,t,n){this.sources.push(e),this.mx.stats.started++,e.onended=()=>{this.mx.stats.ended++,e.disconnect()},e.start(t),e.stop(n),n-this.t0>this.end&&(this.end=n-this.t0)}tone(e,t,n,r,i,a={}){let o=this.mx.ctx,s=this.t0+(a.at??0),c=o.createOscillator();this.mx.setWave(c,e);let l=s+r*(a.hold??0);c.frequency.setValueAtTime(Math.max(20,t),s),a.hold&&c.frequency.setValueAtTime(Math.max(20,t),l),c.frequency.exponentialRampToValueAtTime(Math.max(20,n),s+r);let u=o.createGain(),d=Math.min(a.attack??.004,r*.5);if(u.gain.setValueAtTime(1e-4,s),u.gain.linearRampToValueAtTime(i,s+d),u.gain.exponentialRampToValueAtTime(1e-4,s+r),c.connect(u),u.connect(this.out),a.vibHz){let e=o.createOscillator();e.frequency.value=a.vibHz;let n=o.createGain();n.gain.value=t*(a.vibDepth??.03),e.connect(n),n.connect(c.frequency),this.track(e,s,s+r+.02)}if(a.tremHz){let e=o.createOscillator();e.type=`square`,e.frequency.value=a.tremHz;let t=o.createGain();t.gain.value=i*.5,e.connect(t),t.connect(u.gain),this.track(e,s,s+r+.02)}return this.track(c,s,s+r+.02),this}noise(e,t,n,r,i={}){let a=this.mx.ctx,o=this.t0+(i.at??0),s=this.mx.noise(i.brown??!1),c=a.createBiquadFilter();c.type=i.type??`bandpass`,c.Q.value=i.q??1,c.frequency.setValueAtTime(Math.max(30,e),o),c.frequency.exponentialRampToValueAtTime(Math.max(30,t),o+n);let l=a.createGain(),u=Math.min(i.attack??.003,n*.5);return l.gain.setValueAtTime(1e-4,o),l.gain.linearRampToValueAtTime(r,o+u),l.gain.exponentialRampToValueAtTime(1e-4,o+n),s.connect(c),c.connect(l),l.connect(this.out),this.sources.push(s),this.mx.stats.started++,s.onended=()=>{this.mx.stats.ended++,s.disconnect()},s.start(o,this.mx.noiseOffset()),s.stop(o+n+.02),o+n-this.t0>this.end&&(this.end=o+n-this.t0),this}notes(e,t,n,r=0){for(let[i,a,o]of t){let t=_e(i);this.tone(e,t,t*.995,o,n,{at:a,attack:.008,vibHz:r?5.5:0,vibDepth:r})}return this}get length(){return this.end+.05}},ut=class{constructor(e){T(this,`mx`,void 0),T(this,`last`,new Map),T(this,`busyUntil`,[]),T(this,`tick`,0),this.mx=e}get active(){let e=this.mx.ctx.currentTime;return this.busyUntil.filter(t=>t>e).length}play(e,t=0,n=1){if(!this.mx.canPlay())return;let r=this.mx.ctx.currentTime,i=ot[e]??st;if(r-(this.last.get(e)??-1)<i)return;for(let e=this.busyUntil.length-1;e>=0;e--)this.busyUntil[e]<=r&&this.busyUntil.splice(e,1);if(this.busyUntil.length>=at)return;this.last.set(e,r);let a=new lt(this.mx,ge(n,0,1)*ct[e],ge(t,-1,1));this.build(e,a);let o=r+a.length;this.busyUntil.push(o);let s=a.out;window.setTimeout(()=>s.disconnect(),(a.length+.2)*1e3)}build(e,t){switch(e){case`ui-click`:t.tone(`pulse25`,940,700,.05,.22).noise(4e3,2500,.02,.1,{type:`highpass`});break;case`ui-back`:t.tone(`triangle`,520,300,.09,.3).noise(1500,600,.03,.08);break;case`join`:t.notes(`triangle`,[[72,0,.12],[79,.09,.2]],.3).notes(`pulse12`,[[84,.09,.16]],.08);break;case`ready`:t.notes(`triangle`,[[76,0,.1],[83,.08,.24]],.3).notes(`pulse12`,[[88,.08,.18]],.07);break;case`count`:t.tone(`pulse25`,440,438,.2,.3,{attack:.005}).tone(`sine`,220,219,.24,.3).noise(3e3,1500,.03,.12,{type:`highpass`});break;case`go`:t.tone(`pulse25`,880,878,.6,.28,{attack:.005,vibHz:6,vibDepth:.006}).tone(`pulse12`,1320,1318,.5,.12,{attack:.01}).tone(`sine`,440,438,.6,.3).noise(1200,6e3,.35,.16,{type:`bandpass`,q:.7});break;case`boost`:t.noise(500,3800,.45,.32,{q:1.2,attack:.03}).tone(`sawtooth`,160,620,.4,.14,{attack:.03}).tone(`sine`,90,55,.18,.35);break;case`turbo1`:t.tone(`sawtooth`,300,900,.22,.16,{attack:.01}).noise(900,3500,.22,.22,{q:1.5}).tone(`sine`,100,60,.12,.3);break;case`turbo2`:t.tone(`sawtooth`,340,1300,.3,.17,{attack:.01}).tone(`pulse25`,680,1560,.26,.08).noise(900,4500,.3,.25,{q:1.5}).tone(`sine`,110,60,.14,.32);break;case`turbo3`:t.tone(`sawtooth`,380,1900,.42,.18,{attack:.01}).tone(`pulse25`,760,2280,.36,.09).noise(900,6e3,.42,.27,{q:1.4}).tone(`sine`,120,55,.18,.34).notes(`pulse12`,[[96,.3,.07],[100,.36,.07],[103,.42,.12]],.09);break;case`drift-start`:t.noise(1700,2300,.1,.2,{q:9,attack:.01}).noise(2600,1900,.07,.1,{q:12,at:.03});break;case`pickup`:t.notes(`triangle`,[[83,0,.09],[88,.06,.2]],.32).noise(5e3,3e3,.03,.14,{type:`highpass`}).tone(`sine`,300,120,.08,.2);break;case`roulette-tick`:{let e=[1180,1400,990][this.tick++%3];t.tone(`pulse25`,e,e*.96,.03,.14);break}case`item-ready`:t.notes(`pulse25`,[[79,0,.07],[83,.06,.07],[88,.12,.22]],.2).notes(`triangle`,[[76,.12,.24]],.2);break;case`use-tire`:t.tone(`sine`,170,55,.14,.45).noise(700,1100,.16,.16,{q:6,attack:.02}).noise(250,120,.1,.25,{type:`lowpass`,brown:!0});break;case`use-oil`:t.noise(1400,180,.28,.3,{type:`lowpass`,q:2}).tone(`sine`,320,70,.2,.3).tone(`sine`,520,880,.05,.14,{at:.12}).tone(`sine`,420,760,.05,.1,{at:.2});break;case`use-top`:t.tone(`sawtooth`,170,560,.55,.16,{attack:.03,tremHz:31}).tone(`triangle`,340,1120,.55,.1,{attack:.03,tremHz:31}).noise(2500,5e3,.5,.06,{q:3,attack:.05});break;case`use-guard`:t.tone(`triangle`,1240,1232,.45,.18).tone(`triangle`,1866,1850,.4,.12).tone(`sine`,620,616,.3,.14).noise(6e3,4e3,.08,.12,{type:`highpass`});break;case`use-emp`:t.tone(`sawtooth`,1900,110,.22,.2).noise(3e3,5e3,.04,.22,{q:2}).noise(3500,2500,.04,.2,{q:2,at:.09}).noise(2500,4500,.05,.18,{q:2,at:.17}).tone(`square`,55,50,.3,.16,{tremHz:50});break;case`use-smoke`:t.noise(4200,900,.65,.26,{type:`highpass`,attack:.04}).tone(`sine`,130,60,.16,.3).noise(400,200,.2,.2,{type:`lowpass`,brown:!0});break;case`use-spring`:t.tone(`sine`,190,760,.42,.34,{hold:0,vibHz:21,vibDepth:.16}).tone(`triangle`,380,1500,.3,.1,{vibHz:21,vibDepth:.16}).noise(800,2400,.06,.12,{q:2});break;case`hit`:t.noise(2600,260,.4,.42,{type:`lowpass`,q:1.2}).tone(`sine`,230,46,.34,.45).tone(`square`,183,90,.2,.12).noise(5e3,2e3,.05,.2,{type:`highpass`});break;case`guard-block`:t.tone(`triangle`,430,170,.07,.4).tone(`triangle`,1510,1490,.3,.16,{at:.01}).tone(`triangle`,2260,2230,.24,.1,{at:.01}).noise(3e3,1500,.04,.2,{q:1});break;case`stall`:t.tone(`sawtooth`,120,100,.07,.24).tone(`sawtooth`,105,88,.07,.22,{at:.11}).tone(`sawtooth`,92,76,.07,.2,{at:.24}).tone(`sawtooth`,80,60,.12,.18,{at:.4}).noise(900,300,.5,.1,{type:`lowpass`,brown:!0});break;case`bump`:t.tone(`sine`,160,62,.11,.45).noise(1800,700,.05,.22,{q:1}).tone(`triangle`,520,260,.05,.12);break;case`wall`:t.noise(700,320,.11,.3,{q:1.2}).tone(`sine`,118,58,.1,.38);break;case`land`:t.noise(320,120,.16,.5,{type:`lowpass`,brown:!0}).tone(`sine`,96,46,.14,.42).noise(2200,900,.05,.1,{q:1});break;case`fall`:t.tone(`sine`,1250,180,.75,.26,{vibHz:9,vibDepth:.02}).tone(`triangle`,1880,270,.75,.08).noise(2e3,400,.3,.18,{type:`lowpass`,at:.6});break;case`respawn`:t.tone(`triangle`,390,940,.3,.22,{attack:.03}).notes(`pulse12`,[[84,.18,.06],[88,.24,.06],[91,.3,.14]],.1);break;case`lap`:t.notes(`triangle`,[[79,0,.14],[84,.12,.3]],.28).notes(`pulse12`,[[91,.12,.2]],.06);break;case`final-lap`:t.notes(`pulse25`,[[79,0,.1],[79,.12,.1],[83,.24,.1],[86,.36,.45]],.2,.004).notes(`triangle`,[[67,0,.1],[67,.12,.1],[71,.24,.1],[74,.36,.45]],.22).noise(5e3,8e3,.3,.07,{type:`highpass`,at:.36});break;case`finish`:t.notes(`pulse25`,[[72,0,.12],[76,.1,.12],[79,.2,.12],[84,.3,.9]],.2,.005).notes(`triangle`,[[60,0,.3],[64,.3,.9],[67,.3,.9]],.2).noise(3e3,9e3,.9,.12,{type:`highpass`,at:.3,attack:.01}).tone(`sine`,130,65,.3,.3,{at:.3});break;case`win`:t.notes(`pulse25`,[[72,0,.14],[76,.15,.14],[79,.3,.14],[84,.45,.3],[79,.8,.14],[84,.95,.9]],.2,.005).notes(`triangle`,[[48,0,.42],[55,.45,.32],[48,.8,.14],[60,.95,.9]],.26).notes(`pulse12`,[[88,.95,.9],[91,.95,.9]],.06).noise(4e3,9e3,.6,.1,{type:`highpass`,at:.95,attack:.01});break;case`lose`:t.notes(`triangle`,[[67,0,.24],[65,.26,.24],[63,.52,.24],[60,.78,.8]],.26,.006).notes(`sine`,[[43,0,.5],[41,.52,.26],[36,.78,.8]],.28)}}},dt=`kart.audio`;function ft(){let e={music:.5,sfx:.8,muted:!1};try{let t=JSON.parse(localStorage.getItem(dt)??`null`);return t?{music:typeof t.music==`number`?Math.max(0,Math.min(1,t.music)):e.music,sfx:typeof t.sfx==`number`?Math.max(0,Math.min(1,t.sfx)):e.sfx,muted:t.muted===!0}:e}catch{return e}}var pt=class{constructor(){T(this,`ctx`,null),T(this,`mx`,null),T(this,`engines`,null),T(this,`music`,null),T(this,`sfxPlayer`,null),T(this,`state`,ft()),T(this,`wantMusic`,null),T(this,`finalLap`,!1),T(this,`timer`,0),T(this,`paused`,!1),T(this,`failed`,!1)}unlock(){if(!this.failed){if(!this.ctx)try{let e=window.AudioContext??window.webkitAudioContext;if(!e)throw Error(`kein AudioContext`);this.ctx=new e({latencyHint:`interactive`}),this.mx=new Ce(this.ctx,!0,this.state.music,this.state.sfx,this.state.muted),this.engines=new Re(this.mx),this.music=new it(this.mx),this.sfxPlayer=new ut(this.mx),this.music.setFinalLap(this.finalLap),this.timer=window.setInterval(()=>{this.paused||this.music?.pump()},25)}catch(e){console.warn(`[audio] Ton nicht verfügbar:`,e),this.failed=!0;return}this.ctx.state!==`running`&&!this.paused&&(this.mx?.noteResume(),this.ctx.resume().catch(()=>void 0)),this.wantMusic&&this.music?.play(this.wantMusic)}}get running(){return this.ctx?.state===`running`}setVolumes(e,t){this.state.music=Math.max(0,Math.min(1,e)),this.state.sfx=Math.max(0,Math.min(1,t)),this.mx?.setVolumes(this.state.music,this.state.sfx),this.save()}getVolumes(){return{music:this.state.music,sfx:this.state.sfx}}setMuted(e){this.state.muted=e,this.mx?.setMuted(e),this.save()}isMuted(){return this.state.muted}playMusic(e){this.wantMusic=e,this.mx?.canPlay()&&this.music?.play(e)}stopMusic(e=.7){this.wantMusic=null,this.music?.play(null,e)}setFinalLap(e){this.finalLap=e,this.music?.setFinalLap(e)}duck(e,t){this.mx?.duck(e,t)}sfx(e,t={}){this.paused||this.sfxPlayer?.play(e,t.pan??0,t.gain??1)}update(e,t){this.mx&&!this.paused&&this.mx.canPlay()&&(this.wantMusic&&this.music?.play(this.wantMusic),this.engines?.update(e,t),this.music?.pump())}suspend(){this.ctx&&!this.paused&&(this.paused=!0,this.engines?.release(),this.ctx.suspend().catch(()=>void 0))}resume(){this.ctx&&this.paused&&(this.paused=!1,this.mx?.noteResume(),this.ctx.resume().catch(()=>void 0))}get debug(){return this.mx?{...this.mx.stats,state:this.ctx?.state??`none`}:null}dispose(){window.clearInterval(this.timer),this.engines?.release(),this.ctx?.close().catch(()=>void 0)}save(){try{localStorage.setItem(dt,JSON.stringify(this.state))}catch{}}},mt=[`Kolben-Kalle`,`Vera Vergaser`,`Bremsen-Bert`,`Zünd-Zoe`],ht=[.95,.91,.93,.89],gt=[-.09,0,.055],_t=[[1,1,1,1],[1/30,1/19,1/22,1],[1/36,1/26,1/30,1/22]],vt=[1.6,1,.7];function yt(e,t=1){let n=Math.max(0,Math.min(2,t|0));return{level:n,skill:ht[e%4]+gt[n],driftFrom:_t[n][e%4],line:[-1.6,1.4,.2,-.6][e%4],stuck:0,reverse:0,holding:0,patience:240,drifting:0,itemPressed:!1,rand:12345+e*7919}}function bt(e){return e.rand=e.rand*16807%2147483647,e.rand/2147483647}function xt(e){return e>Math.PI?e-2*Math.PI:e<-Math.PI?e+2*Math.PI:e}var St=4.5,Ct=31,wt=.55,Tt=1.55;function Et(e,t,n){let r=s,i=0,a=0;for(let o=t;o<=n;o+=2)i+=r.curv[se(r,e+Math.round(o/r.step))],a++;return i/a}function Dt(e,t){let n=s,r=0;for(let i=0;i<=t;i+=2)r=Math.max(r,Math.abs(n.curv[se(n,e+Math.round(i/n.step))]));return r}function Ot(e,t){let n=s,r=0;for(let i=0;i<=t;i+=3)r|=n.edge[se(n,e+Math.round(i/n.step))];return r}function kt(t,n,r,i,a){let o=s;if(!i||t.respawn>0)return n.stuck=0,n.reverse=0,n.drifting=0,{steer:0,buttons:0};let c=f(t),l=Math.abs(c),u=!!(t.flags&8),d=Et(t.seg,0,14),p=!!(Ot(t.seg,46)&4),h=!!(Ot(t.seg,24)&3),g=Math.max(8,Math.min(24,6+l*.6)),_=se(o,t.seg+Math.round(g/o.step)),v=Et(t.seg,0,34),y=Math.max(.5,o.rh[_]-(h?3.2:2.2)),x=p?0:n.line*.6*o.rh[_]/6.5+v*110;for(let e of o.hazards){let n=ue(o,t.seg,e.seg)*o.step;if(n<2||n>42)continue;let r=b(e,a.tick+n/Math.max(l,8)*60);x=r>0?Math.min(x,r-4.6):Math.max(x,r+4.6)}x=Math.max(-y,Math.min(y,x));let C=o.px[_]+e(o,_)*x,w=o.pz[_]+k(o,_)*x,T=xt(Math.atan2(C-t.x,w-t.z)-t.heading),E=-T*4.2;if(n.reverse>0)return n.reverse--,{steer:Math.round(Math.max(-1,Math.min(1,T*2))*127),buttons:2};l<1.5&&t.spin===0&&!u?++n.stuck>80&&(n.stuck=0,n.reverse=45):n.stuck=0;let D=l*l/70+8,O=Dt(t.seg,D),A=!h&&!p,j=O>n.driftFrom&&A?Ct*Tt*.86:Ct*(h?.8:.92),ee=O>1e-4?Math.sqrt(j/O):99,M=0;p||l<ee+.5?M|=1:l>ee+5&&(M|=2);let N=l<.3?0:Math.min(l/St,Ct/l),P;if(u)P=Math.max(-.5,Math.min(.5,-T*2));else if(t.driftDir!==0){n.drifting++;let e=d*t.driftDir>1/55;A&&(e||n.drifting<40&&d*t.driftDir>1/120)&&(M|=4);let r=((N>0?E*t.driftDir/N:0)-wt)/1*2-1;P=Math.max(-1,Math.min(1,r))*t.driftDir}else{n.drifting=0,P=N>0?Math.max(-1,Math.min(1,E/N)):0;let e=d>0?1:-1,r=Math.abs(Et(t.seg,0,30))*30;A&&Math.abs(d)>n.driftFrom&&r>.55&&c>14&&Math.sign(P)===e&&Math.abs(T)<.6&&(M|=4,P=e*Math.max(.3,Math.abs(P)))}a.smoke&&!u&&(P=Math.max(-1,Math.min(1,P+Math.sin(a.tick*.23+n.line)*.45)));let F=!1;if(t.item===0)n.holding=0;else{n.holding++===0&&(n.patience=Math.round((150+Math.floor(bt(n)*330))*vt[n.level]));let e=Math.abs(T)<.2,i=Dt(t.seg,45)<1/70,s=n.holding>n.patience;m(o,t.x,t.z,t.seg);let c=S.lat,d=1/0,f=1/0,p=!1;for(let e of r){let n=ue(o,t.seg,e.seg)*o.step;n>0?d=Math.min(d,n):f=Math.min(f,-n),n>4&&n<34&&Math.abs(e.y-t.y)<2&&(m(o,e.x,e.z,e.seg),Math.abs(S.lat-c)<3.5&&(p=!0))}switch(t.item){case 1:F=t.boost===0&&l>12&&i&&n.holding>30&&!h;break;case 2:F=e&&p||s&&e;break;case 3:case 7:F=f>2&&f<16||s;break;case 4:F=n.holding>40&&(d>6&&d<110||s);break;case 5:F=n.holding>50;break;case 6:F=n.holding>50&&(a.place>1||s);break;case 8:F=s&&i&&!u&&!(Ot(t.seg,70)&7)}}return F&&!n.itemPressed&&(M|=8),n.itemPressed=!!(M&8),{steer:Math.round(P*127),buttons:M}}var At=[.2,.14,.07],jt=[.03,.06,.1];function Mt(e,t=1){let n=Math.max(0,Math.min(2,t|0)),r=Math.max(-1,Math.min(1,e/80));return r>0?1-r*At[n]:1-r*jt[n]}var Nt=.1;function Pt(e,t,n){let r=t-e;return r>Math.PI?r-=2*Math.PI:r<-Math.PI&&(r+=2*Math.PI),e+r*n}function Ft(e,t,n,r){return l(e,r<.5?t:n),Math.abs(n.x-t.x)+Math.abs(n.z-t.z)>8?l(e,n):(e.x=t.x+(n.x-t.x)*r,e.y=t.y+(n.y-t.y)*r,e.z=t.z+(n.z-t.z)*r,e.heading=Pt(t.heading,n.heading,r),e.vx=t.vx+(n.vx-t.vx)*r,e.vy=t.vy+(n.vy-t.vy)*r,e.vz=t.vz+(n.vz-t.vz)*r,e)}var It=class{constructor(e){T(this,`delay`,void 0),T(this,`underruns`,0),T(this,`samples`,[]),T(this,`offset`,0),T(this,`clock`,NaN),this.delay=e}reset(){this.samples=[],this.clock=NaN}push(e,r,i){let a=e*t,o=this.samples[this.samples.length-1];if(o&&a<=o.t){if(a<o.t-1)this.reset();else return}let s=a-i;(this.samples.length===0||s>this.offset||s<this.offset-.25)&&(this.offset=s),this.samples.push({t:a,s:l(n(),r)});let c=(Number.isNaN(this.clock)?a:this.clock)-.5;for(;this.samples.length>2&&this.samples[1].t<c;)this.samples.shift()}sample(e,t,n){let r=this.samples.length;if(r===0)return!1;this.offset-=t*.002;let i=e+this.offset-this.delay;if(Number.isNaN(this.clock)||Math.abs(i-this.clock)>.3)this.clock=i;else{let e=1+Math.max(-.1,Math.min(.1,(i-this.clock)*3));this.clock+=t*e}let a=this.samples[r-1];if(this.clock>=a.t){let e=Math.min(this.clock-a.t,Nt);return l(n,a.s),n.x+=n.vx*e,n.z+=n.vz*e,n.flags&8&&n.respawn===0&&(n.y+=n.vy*e),this.clock-a.t>.016666666666666666&&this.underruns++,!0}if(this.clock<=this.samples[0].t)return l(n,this.samples[0].s),!0;for(let e=r-2;e>=0;e--){let t=this.samples[e];if(t.t<=this.clock){let r=this.samples[e+1];return Ft(n,t.s,r.s,(this.clock-t.t)/(r.t-t.t)),!0}}return l(n,a.s),!0}},Lt=.085,Rt=.1,zt=6,Bt=180;function Vt(e){return e>Math.PI?e-2*Math.PI:e<-Math.PI?e+2*Math.PI:e}var Ht=class{constructor(e,t){T(this,`localSlot`,void 0),T(this,`rttMs`,void 0),T(this,`ready`,!1),T(this,`stats`,{snapshots:0,lastCorrection:0,peakCorrection:0,pending:0,underruns:0}),T(this,`onFx`,null),T(this,`seq`,0),T(this,`pending`,[]),T(this,`predicted`,n()),T(this,`prev`,n()),T(this,`replay`,n()),T(this,`scratch`,n()),T(this,`env`,{canDrive:!1,speedFactor:1}),T(this,`err`,{x:0,y:0,z:0,h:0}),T(this,`remotes`,new Map),T(this,`own`,null),T(this,`lastSnapTick`,-1),T(this,`hardSync`,!0),T(this,`raceId`,-1),T(this,`phase`,0),T(this,`goTick`,0),T(this,`laps`,0),T(this,`boxes`,0),T(this,`thingList`,[]),T(this,`thingsAt`,0),T(this,`wrongTrack`,-1),T(this,`clockOffset`,NaN),T(this,`couldDrive`,!1),this.localSlot=e,this.rttMs=t}resync(){this.hardSync=!0,this.lastSnapTick=-1,this.pending=[],this.clockOffset=NaN}hostTick(e){return Number.isNaN(this.clockOffset)?0:(e+this.clockOffset)*60}rttTicks(){let e=this.rttMs();return e>0?Math.min(e,500)*.06:0}localCanDrive(e){return!this.own||this.own.finished?!1:this.phase===1||this.phase===0&&this.hostTick(e)+this.rttTicks()>=this.goTick}tick(e,t){if(!this.ready)return null;let n=this.localCanDrive(t);n&&!this.couldDrive&&this.phase===0&&this.onFx?.(`go`),this.couldDrive=n,this.seq++,this.pending.push({seq:this.seq,cmd:{steer:e.steer,buttons:e.buttons},canDrive:n}),this.pending.length>Bt&&this.pending.shift(),l(this.prev,this.predicted),this.env.canDrive=n;let i=c(this.predicted,e,this.env);i&41&&this.onFx?.(`boost`),i&16&&this.onFx?.(`wall`),i&128&&this.onFx?.(`item`),i&8192&&this.onFx?.(`land`),i&16384&&this.onFx?.(`fall`),this.stats.pending=this.pending.length;let a=this.pending.slice(-4).map(e=>e.cmd);return r(this.seq,a)}onSnapshot(e,n){if(e.tick<=this.lastSnapTick)return;if(e.track!==s.index){this.wrongTrack=e.track;return}this.wrongTrack=-1,this.lastSnapTick=e.tick,this.stats.snapshots++;let r=e.tick*t-n;if((Number.isNaN(this.clockOffset)||r>this.clockOffset||r<this.clockOffset-.5)&&(this.clockOffset=r),e.raceId!==this.raceId){this.raceId=e.raceId,this.hardSync=!0,this.couldDrive=!1;for(let e of this.remotes.values())e.interp.reset()}this.phase=e.phase,this.goTick=e.goTick,this.laps=e.laps,this.boxes=e.boxes,this.thingList=e.things,this.thingsAt=n;let i=new Set;for(let t of e.karts){if(i.add(t.slot),t.slot===this.localSlot){this.own=t,this.reconcile(t.state,t.ack);continue}let e=this.remotes.get(t.slot);e||this.remotes.set(t.slot,e={interp:new It(Lt),info:t}),e.info=t,e.interp.push(t.ptick,t.state,n)}for(let e of[...this.remotes.keys()])i.has(e)||this.remotes.delete(e)}entities(e,t,n,r){if(r.length=0,this.ready&&this.own){let t=Math.exp(-n/Rt);this.err.x*=t,this.err.y*=t,this.err.z*=t,this.err.h*=t;let i=Ft(this.scratch,this.prev,this.predicted,e);r.push({...i,x:i.x+this.err.x,y:i.y+this.err.y,z:i.z+this.err.z,heading:i.heading+this.err.h,slot:this.localSlot,bot:!1,lap:this.own.lap,place:this.own.place,finished:this.own.finished})}let i=0;for(let[e,a]of this.remotes)a.interp.sample(t,n,this.scratch)&&(i+=a.interp.underruns,r.push({...this.scratch,slot:e,bot:a.info.bot,lap:a.info.lap,place:a.info.place,finished:a.info.finished}));this.stats.underruns=i}race(e){let t=this.hostTick(e)+this.rttTicks()/2;return{raceId:this.raceId,phase:this.phase,laps:this.laps,untilGo:Number.isNaN(this.clockOffset)?99:(this.goTick-t)/60,boxes:this.boxes,hostTick:t}}standings(){let e=[],t=t=>{e.push({slot:t.slot,bot:t.bot,place:t.place,lap:t.lap,finished:t.finished,finishTicks:t.finishTicks})};this.own&&t(this.own);for(let e of this.remotes.values())t(e.info);return e.sort((e,t)=>e.place-t.place)}things(e){let t=Math.min(.12,Math.max(0,e-this.thingsAt));return this.thingList.map(e=>e.vx===0&&e.vz===0?e:{...e,x:e.x+e.vx*t,z:e.z+e.vz*t})}predictedState(){return this.predicted}reconcile(e,t){if(this.hardSync){this.hardSync=!1,this.ready=!0,l(this.predicted,e),l(this.prev,e),this.pending=[],this.err.x=this.err.y=this.err.z=this.err.h=0;return}for(;this.pending.length>0&&this.pending[0].seq<=t;)this.pending.shift();let n=l(this.replay,e);for(let e of this.pending)this.env.canDrive=e.canDrive,c(n,e.cmd,this.env);let r=this.predicted.x-n.x,i=this.predicted.y-n.y,a=this.predicted.z-n.z,o=Vt(this.predicted.heading-n.heading),s=Math.hypot(r,a);this.stats.lastCorrection=s,s>this.stats.peakCorrection&&(this.stats.peakCorrection=s),this.err.x+=r,this.err.y+=i,this.err.z+=a,this.err.h+=o,this.prev.x-=r,this.prev.y-=i,this.prev.z-=a,this.prev.heading-=o,l(this.predicted,n),Math.hypot(this.err.x,this.err.z)>zt&&(this.err.x=this.err.y=this.err.z=this.err.h=0,l(this.prev,this.predicted))}},Ut=.05,Wt=12,Gt=90,Kt=3,qt=30,Jt=8,Yt=150,Xt=2400,Zt=2,Qt=180,$t=70,en=40,tn=.8,nn=360,rn=4,an=1.6,on=3e3,sn=46,cn=1.7,ln=600,un=7.5,dn=540,fn=6,pn=class{constructor(e,t={}){T(this,`localSlot`,void 0),T(this,`tick`,0),T(this,`raceId`,0),T(this,`phase`,0),T(this,`goTick`,0),T(this,`laps`,void 0),T(this,`aiLevel`,void 0),T(this,`onFx`,null),T(this,`karts`,new Map),T(this,`scratch`,n()),T(this,`env`,{canDrive:!1,speedFactor:1}),T(this,`boxTimers`,void 0),T(this,`thingList`,[]),T(this,`botCtx`,{tick:0,place:1,smoke:!1}),T(this,`nextId`,1),T(this,`firstFinishTick`,-1),T(this,`resultsAtTick`,-1),T(this,`lastTickAt`,performance.now()),T(this,`rand`,Date.now()%2147483646+1),this.localSlot=e,this.laps=t.laps??s.laps,this.aiLevel=t.aiLevel??1,this.boxTimers=new Uint16Array(s.boxes.length)}setRoster(e,t){let n=new Map;for(let r=0;r<4;r++)e.includes(r)?n.set(r,!1):t&&n.set(r,!0);for(let[e,t]of n){let n=this.karts.get(e);n&&n.bot===t||(n&&t?(n.bot=!0,n.local=!1,n.online=!0,n.brain=yt(e,this.aiLevel),n.queue=[]):this.karts.set(e,this.createKart(e,t)))}for(let e of[...this.karts.keys()])n.has(e)||this.karts.delete(e);this.rank()}newRace(){this.raceId=this.raceId+1&255,this.phase=0,this.goTick=this.tick+345,this.firstFinishTick=-1,this.resultsAtTick=-1,this.thingList=[],this.boxTimers.fill(0);for(let e of this.karts.values())l(e.state,h(e.slot)),l(e.prev,e.state),e.progress=ue(s,0,e.state.seg),e.lap=1,e.finished=!1,e.finishTicks=0,e.queue=[],e.starved=0,e.bumpCooldown=0,e.interp.reset(),e.brain&&(e.brain=yt(e.slot,this.aiLevel));this.rank()}resetInput(e){let t=this.karts.get(e);t&&(t.queue=[],t.lastSeq=0,t.ack=0)}setOnline(e,t){let n=this.karts.get(e);n&&!n.local&&!n.bot&&(n.online=t)}receiveCmds(e,t,n){let r=this.karts.get(e);if(!r||r.local||r.bot)return;let i=t-n.length+1;for(let e=0;e<n.length;e++){let t=i+e;t>r.lastSeq&&(r.queue.push({seq:t,cmd:n[e]}),r.lastSeq=t,r.cmdsIn++)}}step(e){this.tick++,this.lastTickAt=performance.now();let t=this.lastTickAt/1e3;if(this.phase===0&&this.tick>=this.goTick){this.phase=1;for(let e of this.karts.values())this.fx(e,`go`)}let n=this.phase===1,r=-1/0;for(let e of this.karts.values())!e.bot&&!e.finished&&(r=Math.max(r,e.progress));let i=[];for(let a of this.karts.values()){a.bumpCooldown>0&&a.bumpCooldown--;let c=n&&!a.finished;if(this.env.canDrive=c,this.env.speedFactor=1,a.local){l(a.prev,a.state),this.advance(a,e);continue}if(a.bot||!a.online&&a.starved>Gt){a.brain||(a.brain=yt(a.slot,this.aiLevel)),i.length=0;for(let e of this.karts.values())e!==a&&!e.finished&&i.push(e.state);let e=a.bot&&r>-1/0?Mt((a.progress-r)*s.step,this.aiLevel):1;this.botCtx.tick=this.tick,this.botCtx.place=a.place,this.botCtx.smoke=this.inSmoke(a.state),this.env.speedFactor=a.brain.skill*e*(this.botCtx.smoke?.85:1),l(a.prev,a.state);let n=kt(a.state,a.brain,i,c,this.botCtx);this.env.canDrive=c,this.advance(a,n),a.bot||(a.starved++,a.queue.length>0&&(a.queue=[]),a.interp.push(a.ptick,a.state,t));continue}if(a.queue.length>qt){let e=a.queue.length-Jt;a.queue.splice(0,e),a.cmdsDropped+=e}let u=Math.min(a.queue.length,Kt);if(u>0){for(let e=0;e<u;e++){let e=a.queue.shift();this.env.canDrive=c&&!a.finished,this.advance(a,e.cmd),a.ack=e.seq}a.starved=0}else a.starved++,a.starved>Wt&&this.advance(a,o);a.interp.push(a.ptick,a.state,t)}this.stepItems(),this.collideKarts(),this.rank(),this.checkRaceEnd()}snapshot(){let e=[];for(let t of this.karts.values())e.push({slot:t.slot,bot:t.bot,ptick:t.ptick,ack:t.ack,state:t.state,lap:t.lap,place:t.place,finished:t.finished,finishTicks:t.finishTicks});return fe({tick:this.tick,raceId:this.raceId,phase:this.phase,goTick:this.goTick,laps:this.laps,boxes:this.boxMask(),track:s.index,karts:e,things:this.thingList})}entities(e,t,n,r){r.length=0;for(let i of this.karts.values()){let a;if(i.local||i.bot)a=Ft(this.scratch,i.prev,i.state,e);else{if(!i.interp.sample(t,n,this.scratch))continue;a=this.scratch}r.push({...a,slot:i.slot,bot:i.bot,lap:i.lap,place:i.place,finished:i.finished})}}race(){let e=Math.min(1,(performance.now()-this.lastTickAt)/(1e3/60));return{raceId:this.raceId,phase:this.phase,laps:this.laps,untilGo:(this.goTick-this.tick-e)/60,boxes:this.boxMask(),hostTick:this.tick+e}}standings(){let e=[];for(let t of this.karts.values())e.push({slot:t.slot,bot:t.bot,place:t.place,lap:t.lap,finished:t.finished,finishTicks:t.finishTicks});return e.sort((e,t)=>e.place-t.place)}things(){return this.thingList}drainCmdCounts(){let e=new Map;for(let t of this.karts.values())t.local||t.bot||(e.set(t.slot,{received:t.cmdsIn,dropped:t.cmdsDropped,queued:t.queue.length}),t.cmdsIn=0,t.cmdsDropped=0);return e}authoritative(e){return this.karts.get(e)?.state??null}localCanDrive(){let e=this.karts.get(this.localSlot);return this.phase===1&&!!e&&!e.finished}giveItem(e,t){let n=this.karts.get(e);n&&(n.state.item=t,n.state.nextItem=0,n.state.roulette=0)}debugHit(e){let t=this.karts.get(e);t&&this.applyHit(t)}debugPlace(t,n,r=0){let i=this.karts.get(t);if(!i)return;let a=s,o=se(a,Math.round(n/a.step)),c=i.state.seg;i.state.seg=o,i.state.x=a.px[o]+e(a,o)*r,i.state.z=a.pz[o]+k(a,o)*r,i.state.y=a.py[o]+r*a.bank[o],i.state.heading=Math.atan2(a.tx[o],a.tz[o]),i.state.vx=i.state.vy=i.state.vz=0,i.progress+=ue(a,c,o),l(i.prev,i.state)}createKart(e,t){let r=h(e);return{slot:e,local:e===this.localSlot&&!t,bot:t,online:!0,brain:t?yt(e,this.aiLevel):null,state:r,prev:l(n(),r),ptick:0,ack:0,lastSeq:0,queue:[],starved:0,interp:new It(Ut),cmdsIn:0,cmdsDropped:0,progress:ue(s,0,r.seg),lap:1,place:1,finished:!1,finishTicks:0,bumpCooldown:0}}fx(e,t){e.bot||this.onFx?.(e.slot,t)}advance(e,t){let n=e.state.seg,r=c(e.state,t,this.env);e.ptick++,e.progress+=ue(s,n,e.state.seg),r&2&&this.spawnTire(e),r&4&&this.spawnDrop(e,2),r&2048&&this.spawnDrop(e,4),r&256&&this.spawnTop(e),r&1024&&this.shortCircuit(e),r&41&&this.fx(e,`boost`),r&128&&this.fx(e,`item`),r&16&&this.fx(e,`wall`),r&8192&&this.fx(e,`land`),r&16384&&this.fx(e,`fall`),!e.finished&&this.phase===1&&e.progress>=this.laps*s.n&&(e.finished=!0,e.finishTicks=this.tick-this.goTick,this.firstFinishTick<0&&(this.firstFinishTick=this.tick),this.fx(e,`finish`));let i=Math.max(1,Math.min(this.laps,Math.floor(e.progress/s.n)+1));i>e.lap&&!e.finished&&this.fx(e,i===this.laps?`finallap`:`lap`),i>e.lap&&(e.lap=i)}random(){return this.rand=this.rand*16807%2147483647,this.rand/2147483647}pickItem(e,t){let n;n=t<=1?[40,14,8,0,10,0,6,22]:e===1?[14,8,26,0,24,0,20,8]:e===t?[26,14,0,26,6,16,0,12]:[18,20,10,16,10,6,10,10];let r=[1,2,3,4,5,6,7,8],i=0;for(let e of n)i+=e;let a=this.random()*i;for(let e=0;e<n.length;e++)if(a-=n[e],a<0)return r[e];return 1}addThing(e,t,n,r,i,a){let o=0;for(let t of this.thingList)t.kind===e&&o++;if(o>=fn){let t=this.thingList.findIndex(t=>t.kind===e);this.thingList.splice(t,1)}let s={id:this.newId(),kind:e,ttl:a/60,x:n,y:r,z:i,vx:0,vz:0,seg:t.state.seg,owner:t.slot,safe:0,life:a,bounces:0,floating:0,pos:0,lat:0,target:-1};return this.thingList.push(s),s}spawnTire(e){let t=Math.sin(e.state.heading),n=Math.cos(e.state.heading),r=this.addThing(1,e,e.state.x+t*2.4,e.state.y+tn,e.state.z+n*2.4,nn);r.vx=t*en,r.vz=n*en,r.safe=20}spawnDrop(e,t){let n=s,r=t===2?2.8:4,i=e.state.x-Math.sin(e.state.heading)*r,a=e.state.z-Math.cos(e.state.heading)*r;m(n,i,a,e.state.seg);let o=x(n,S.seg,S.along,S.lat);if(o===-1e6&&t===2)return;let c=this.addThing(t,e,i,o===-1e6?e.state.y:o,a,t===2?on:dn);c.seg=S.seg,c.safe=45}spawnTop(e){let t=s;m(t,e.state.x,e.state.z,e.state.seg);let n=this.addThing(3,e,e.state.x,e.state.y+.6,e.state.z,ln);n.pos=se(t,S.seg)*t.step+3,n.lat=S.lat,n.safe=30;for(let t of this.karts.values())t.place===e.place-1&&!t.finished&&(n.target=t.slot)}shortCircuit(e){for(let t of this.karts.values()){if(t===e||t.finished||e.place>1&&t.place>e.place)continue;let n=y(t.state);n===2?this.fx(t,`block`):n!==0&&this.fx(t,`stall`)}}applyHit(e){let t=he(e.state);t===2?this.fx(e,`block`):t!==0&&this.fx(e,`hit`)}inSmoke(e){for(let t of this.thingList)if(t.kind===4&&Math.abs(t.y-e.y)<4&&Math.hypot(t.x-e.x,t.z-e.z)<un)return!0;return!1}newId(){return this.nextId=this.nextId%250+1,this.nextId}boxMask(){let e=0;for(let t=0;t<this.boxTimers.length;t++)this.boxTimers[t]===0&&(e|=1<<t);return e>>>0}stepItems(){let t=s,n=1/60,r=this.phase===1;for(let e=0;e<this.boxTimers.length;e++)this.boxTimers[e]>0&&this.boxTimers[e]--;if(r){let n=this.karts.size;for(let e of this.karts.values()){let r=e.state;if(!(e.finished||r.item!==0||r.roulette>0||r.respawn>0))for(let i=0;i<t.boxes.length;i++){if(this.boxTimers[i]>0)continue;let a=t.boxes[i];if(!(Math.abs(ue(t,a.seg,r.seg))>6||Math.abs(r.y-a.y)>2.5)&&Math.hypot(r.x-a.x,r.z-a.z)<Zt){this.boxTimers[i]=Qt,r.nextItem=this.pickItem(e.place,n),r.roulette=$t,this.fx(e,`pickup`);break}}}for(let n of t.hazards){let r=b(n,this.tick),i=t.px[n.seg]+e(t,n.seg)*r,a=t.pz[n.seg]+k(t,n.seg)*r,o=t.py[n.seg]+r*t.bank[n.seg];for(let e of this.karts.values())e.finished||Math.abs(e.state.y-o)>1.6||Math.hypot(e.state.x-i,e.state.z-a)<2.5&&this.applyHit(e)}}for(let r=this.thingList.length-1;r>=0;r--){let i=this.thingList[r];i.safe>0&&i.safe--;let a=--i.life<=0;i.ttl=i.life/60;let o=0,s=1.5;if(i.kind===1){i.x+=i.vx*n,i.z+=i.vz*n,m(t,i.x,i.z,i.seg),i.seg=S.seg;let r=t.wh[i.seg]-tn;if(Math.abs(S.lat)>r){let n=S.lat>0?1:-1;if(!(t.edge[i.seg]&(n>0?2:1))){let a=e(t,i.seg)*n,o=k(t,i.seg)*n,s=Math.abs(S.lat)-r;i.x-=a*s,i.z-=o*s,S.lat=n*r;let c=i.vx*a+i.vz*o;c>0&&(i.vx-=2*c*a,i.vz-=2*c*o,i.bounces++)}}let s=x(t,i.seg,S.along,S.lat);s===-1e6?(i.y-=.12,++i.floating>14&&(a=!0)):(i.floating=0,i.y=s+tn),i.bounces>rn&&(a=!0),o=1+tn}else if(i.kind===2)o=an,s=.6;else if(i.kind===3){i.pos=(i.pos+sn*n)%t.length,i.seg=Math.floor(i.pos/t.step)%t.n;let r=0,a=4,c=i.target>=0?this.karts.get(i.target):void 0;if(c&&!c.finished){let e=ue(t,i.seg,c.state.seg)*t.step;e<-8?(i.target=-1,i.life=Math.min(i.life,40)):e<50&&(m(t,c.state.x,c.state.z,c.state.seg),r=S.lat,a=11)}let l=t.wh[i.seg]-1,u=Math.max(-a*n,Math.min(a*n,r-i.lat));i.lat=Math.max(-l,Math.min(l,i.lat+u));let d=i.pos-i.seg*t.step;i.x=t.px[i.seg]+t.tx[i.seg]*d+e(t,i.seg)*i.lat,i.z=t.pz[i.seg]+t.tz[i.seg]*d+k(t,i.seg)*i.lat,i.y=ae(t,i.seg,d)+i.lat*t.bank[i.seg]+.6,i.vx=t.tx[i.seg]*sn,i.vz=t.tz[i.seg]*sn,o=cn,s=2}if(!a&&o>0)for(let e of this.karts.values()){if(e.finished||e.slot===i.owner&&i.safe>0||i.kind===3&&e.slot===i.owner)continue;let t=e.state.y-(i.kind===2?i.y:i.y-.6);if(!(t>s||t<-s)&&Math.hypot(e.state.x-i.x,e.state.z-i.z)<o){if(e.state.respawn>0)continue;this.applyHit(e),a=!0;break}}a&&this.thingList.splice(r,1)}}collideKarts(){let e=[...this.karts.values()];for(let t=0;t<e.length;t++)for(let n=t+1;n<e.length;n++){let r=e[t],i=e[n];if(r.finished||i.finished||r.state.respawn>0||i.state.respawn>0||Math.abs(r.state.y-i.state.y)>1.6)continue;let a=i.state.x-r.state.x,o=i.state.z-r.state.z,s=Math.hypot(a,o);if(s>=2||s<1e-6)continue;let c=a/s,l=o/s,u=(2-s)/2;r.state.x-=c*u,r.state.z-=l*u,i.state.x+=c*u,i.state.z+=l*u;let d=(i.state.vx-r.state.vx)*c+(i.state.vz-r.state.vz)*l;if(d<0){let e=-1.45*d/2;if(r.state.vx-=e*c,r.state.vz-=e*l,i.state.vx+=e*c,i.state.vz+=e*l,d<-2.5)for(let e of[r,i])e.bumpCooldown===0&&(e.bumpCooldown=25,this.fx(e,`bump`))}}}rank(){[...this.karts.values()].sort((e,t)=>e.finished===t.finished?e.finished?e.finishTicks-t.finishTicks:t.progress-e.progress||e.slot-t.slot:e.finished?-1:1).forEach((e,t)=>e.place=t+1)}checkRaceEnd(){if(this.phase===1){if(this.resultsAtTick<0){let e=0,t=0;for(let n of this.karts.values())n.bot||(e++,n.finished&&t++);[...this.karts.values()].every(e=>e.finished)?this.resultsAtTick=this.tick+60:e>0&&t===e?this.resultsAtTick=this.tick+Yt:this.firstFinishTick>=0&&this.tick-this.firstFinishTick>Xt&&(this.resultsAtTick=this.tick)}if(this.resultsAtTick>=0&&this.tick>=this.resultsAtTick){for(let e of this.karts.values()){if(e.finished||!e.bot)continue;let t=Math.max(0,this.laps*s.n-e.progress)*s.step;e.finished=!0,e.finishTicks=this.tick-this.goTick+Math.round(t/23.92*60)}this.rank(),this.phase=2}}}},mn=300;function hn(e,t){return e-t&255}var gn=class{constructor(){T(this,`lastPacketAt`,0),T(this,`packets`,0),T(this,`steer`,0),T(this,`buttons`,0),T(this,`lastSeq`,-1),T(this,`itemCount`,-1),T(this,`itemQueued`,0),T(this,`itemOut`,!1)}reset(){this.lastPacketAt=0,this.steer=0,this.buttons=0,this.lastSeq=-1,this.itemCount=-1,this.itemQueued=0,this.itemOut=!1}onPacket(e){let t=_(e);t&&(this.packets++,this.lastSeq>=0&&!p(t.seq,this.lastSeq)||(this.lastSeq=t.seq,this.lastPacketAt=performance.now(),this.steer=t.steer,this.buttons=t.buttons,this.noteItemCount(t.itemCount)))}onItemPress(e){this.noteItemCount(e&255)}get fresh(){return this.lastPacketAt>0&&performance.now()-this.lastPacketAt<mn}sample(){let e=this.fresh,t=e&&!!(this.buttons&8),n;return this.itemQueued>0?this.itemOut?n=!1:(n=!0,this.itemQueued--):n=this.itemOut&&t,this.itemOut=n,e?{steer:this.steer,buttons:this.buttons&-9|(n?8:0)}:{steer:0,buttons:n?8:0}}noteItemCount(e){if(this.itemCount<0){this.itemCount=e;return}let t=hn(e,this.itemCount);t===0||t>=128||(this.itemCount=e,this.itemQueued=Math.min(this.itemQueued+t,3))}},_n={ArrowLeft:`left`,KeyA:`left`,ArrowRight:`right`,KeyD:`right`,ArrowUp:`gas`,KeyW:`gas`,ArrowDown:`brake`,KeyS:`brake`,ShiftLeft:`drift`,ShiftRight:`drift`,Space:`item`},vn=class{constructor(){T(this,`down`,new Set),T(this,`steer`,0),window.addEventListener(`keydown`,e=>{let t=_n[e.code];t&&!this.typing(e)&&(this.down.add(t),e.preventDefault())}),window.addEventListener(`keyup`,e=>{let t=_n[e.code];t&&this.down.delete(t)}),window.addEventListener(`blur`,()=>this.down.clear())}get steering(){return this.down.has(`left`)||this.down.has(`right`)}get any(){return this.down.size>0}sample(){let e=+!!this.down.has(`right`)-!!this.down.has(`left`),n=(e===0?7:5)*t;this.steer<e?this.steer=Math.min(e,this.steer+n):this.steer>e&&(this.steer=Math.max(e,this.steer-n));let r=0;return this.down.has(`gas`)&&(r|=1),this.down.has(`brake`)&&(r|=2),this.down.has(`drift`)&&(r|=4),this.down.has(`item`)&&(r|=8),{steer:Math.round(this.steer*127),buttons:r}}typing(e){let t=e.target;return!!t&&(t.tagName===`INPUT`||t.tagName===`TEXTAREA`)}};function yn(e,t,n){return e?{steer:n?t.steer:e.steer,buttons:e.buttons|t.buttons}:t}var bn=class{constructor(e,t){T(this,`step`,void 0),T(this,`stepMs`,void 0),T(this,`acc`,0),T(this,`last`,0),T(this,`worker`,null),T(this,`fallbackTimer`,0),T(this,`running`,!1),this.step=e,this.stepMs=t}start(){if(!this.running){this.running=!0,this.acc=0,this.last=performance.now();try{let e=URL.createObjectURL(new Blob([`setInterval(function(){postMessage(0)},8)`],{type:`text/javascript`}));this.worker=new Worker(e),this.worker.onmessage=()=>this.advance(),URL.revokeObjectURL(e)}catch{this.worker=null,this.fallbackTimer=window.setInterval(()=>this.advance(),8)}}}stop(){this.running=!1,this.worker?.terminate(),this.worker=null,window.clearInterval(this.fallbackTimer)}advance(){if(!this.running)return 0;let e=performance.now();for(this.acc+=Math.min(e-this.last,250),this.last=e;this.acc>=this.stepMs;)this.step(),this.acc-=this.stepMs;return this.acc/this.stepMs}},xn=1200,Sn=3e4,Cn=25e3,wn=[`not-found`,`unreachable`,`rejected`,`closed`,`lost`,`replaced`],Tn=class{constructor(e,t,n,r,i){T(this,`endpoint`,void 0),T(this,`code`,void 0),T(this,`token`,void 0),T(this,`name`,void 0),T(this,`status`,`connecting`),T(this,`rejectReason`,null),T(this,`state`,null),T(this,`slot`,-1),T(this,`link`,null),T(this,`deadline`,0),T(this,`buildMismatch`,!1),T(this,`onChange`,null),T(this,`onFast`,null),T(this,`onLinkUp`,null),T(this,`onFx`,null),T(this,`everJoined`,void 0),T(this,`retryTimer`,0),T(this,`disposed`,!1),T(this,`ready`,!1),T(this,`lastStatus`,{controller:!1,ctrlRtt:-1}),T(this,`wake`,()=>{document.visibilityState===`visible`&&!this.link&&!this.isFinal&&this.attemptSoon(0)}),this.endpoint=e,this.code=t,this.token=n,this.name=r,this.everJoined=i,this.status=i?`reconnecting`:`connecting`,this.deadline=Date.now()+(i?Sn:Cn),document.addEventListener(`visibilitychange`,this.wake),this.attempt()}get isFinal(){return wn.includes(this.status)}setReady(e){this.ready=e,this.sendMsg({t:`ready`,v:e})}setName(e){this.name=e,this.sendMsg({t:`name`,v:e})}reportStatus(e,t){let n=Math.round(t);(this.lastStatus.controller!==e||this.lastStatus.ctrlRtt!==n)&&(this.lastStatus={controller:e,ctrlRtt:n},this.sendMsg({t:`status`,controller:e,ctrlRtt:n}))}sendFast(e){this.status===`joined`&&this.link?.sendFast(e)}leave(){this.sendMsg({t:`leave`});let e=this.link;this.dispose(),e&&window.setTimeout(()=>e.close(),300)}dispose(){this.disposed=!0,window.clearTimeout(this.retryTimer),document.removeEventListener(`visibilitychange`,this.wake),this.link&&(this.link.onClose=null,this.link.onMessage=null,this.link.onFast=null)}sendMsg(e){this.status===`joined`&&this.link?.send(e)}setStatus(e){this.status=e,this.onChange?.()}finish(e){window.clearTimeout(this.retryTimer);let t=this.link;this.link=null,t&&(t.onClose=null,window.setTimeout(()=>t.close(),300)),this.setStatus(e)}attemptSoon(e){window.clearTimeout(this.retryTimer),this.retryTimer=window.setTimeout(()=>this.attempt(),e)}attempt(){if(this.disposed||this.isFinal||this.link)return;if(Date.now()>this.deadline){this.finish(this.everJoined?`lost`:`unreachable`);return}let e=this.endpoint().connect(a(this.code),{role:`screen`});e?(this.link=e,e.onOpen=()=>{let t={t:`hello`,v:3,token:this.token,name:this.name,build:N};e.send(t)},e.onMessage=t=>this.handleMessage(e,t),e.onFast=e=>this.onFast?.(e),e.onClose=t=>{this.link===e&&(this.link=null,this.disposed||this.isFinal||(!this.everJoined&&t===`unavailable`?this.finish(`not-found`):(this.status===`joined`?(this.deadline=Date.now()+Sn,this.setStatus(`reconnecting`)):this.onChange?.(),this.attemptSoon(xn))))}):this.attemptSoon(600)}handleMessage(e,t){if(this.link===e)switch(t.t){case`welcome`:this.slot=t.slot,this.state=t.state,this.buildMismatch=typeof t.build==`string`&&t.build!==`261110-1052`,this.everJoined=!0,this.status=`joined`,this.lastStatus={controller:!1,ctrlRtt:-1},this.ready&&t.state.phase===`lobby`&&this.sendMsg({t:`ready`,v:!0}),this.onLinkUp?.(),this.onChange?.();break;case`lobby`:if(this.state=t.state,t.state.phase===`lobby`){let e=t.state.players.find(e=>e.slot===this.slot);e&&(this.ready=e.ready)}this.onChange?.();break;case`fx`:this.onFx?.(t.k);break;case`reject`:this.rejectReason=t.reason,this.finish(`rejected`);break;case`closed`:this.finish(`closed`);break;case`replaced`:this.finish(`replaced`)}}},En=45e3,Dn=8e3;function On(e,t){return String(e??``).replace(/[\u0000-\u001f<>]/g,``).trim().slice(0,14)||t}var kn=class{constructor(e,t,n,r){if(T(this,`code`,void 0),T(this,`phase`,`lobby`),T(this,`bots`,!0),T(this,`aiLevel`,1),T(this,`track`,0),T(this,`localSlot`,void 0),T(this,`onChange`,null),T(this,`onSeatsChanged`,null),T(this,`onPlayerLink`,null),T(this,`onPlayerDown`,null),T(this,`onFast`,null),T(this,`seats`,[,,,,].fill(null)),T(this,`timer`,void 0),T(this,`closed`,!1),this.code=e,r&&r.code===e){typeof r.bots==`boolean`&&(this.bots=r.bots),typeof r.aiLevel==`number`&&(this.aiLevel=Math.max(0,Math.min(2,r.aiLevel|0))),typeof r.track==`number`&&(this.track=Math.max(0,r.track|0));for(let e of r.seats)e.slot<0||e.slot>=4||(this.seats[e.slot]={slot:e.slot,token:e.token,name:e.name,isHost:e.isHost,link:null,ready:!1,controller:!1,ctrlRtt:-1,offlineSince:e.isHost?null:Date.now()})}let i=this.seats.find(e=>e?.isHost)??null;i||(i=this.newSeat(0,t,n,!0),this.seats[0]=i),i.name=On(n,`Host`),this.localSlot=i.slot,this.timer=window.setInterval(()=>this.housekeeping(),1e3)}accept(e){if(this.closed){e.close();return}let t=window.setTimeout(()=>e.close(),Dn);e.onMessage=n=>{let r=n;r.t===`hello`&&(window.clearTimeout(t),this.handleHello(e,r))},e.onClose=()=>window.clearTimeout(t)}state(){let e=[];for(let t of this.seats)t&&e.push({slot:t.slot,name:t.name,isHost:t.isHost,online:t.isHost||t.link!==null,controller:t.controller,ctrlRtt:t.ctrlRtt,ready:t.ready,ping:t.isHost?0:t.link?Math.round(t.link.rtt):-1});return{code:this.code,phase:this.phase,players:e,bots:this.bots,aiLevel:this.aiLevel,track:this.track}}setBots(e){this.bots!==e&&(this.bots=e,this.changed())}setAiLevel(e){let t=Math.max(0,Math.min(2,e|0));this.aiLevel!==t&&(this.aiLevel=t,this.changed())}setTrack(e){this.track!==e&&(this.track=e,this.changed())}sendFx(e,t){let n=this.seats[e]?.link;n&&this.sendTo(n,{t:`fx`,k:t})}slots(){return this.seats.filter(e=>e!==null).map(e=>e.slot)}linkOf(e){return this.seats[e]?.link??null}setLocalName(e){let t=this.seats[this.localSlot];t.name=On(e,`Host`),this.changed()}setLocalReady(e){this.seats[this.localSlot].ready=e,this.changed()}setLocalController(e,t){let n=this.seats[this.localSlot],r=Math.round(t);(n.controller!==e||n.ctrlRtt!==r)&&(n.controller=e,n.ctrlRtt=r,this.changed())}canStart(){return this.seats.every(e=>!e||e.isHost||!e.link||e.ready)}setPhase(e){if(this.phase!==e){if(this.phase=e,e===`lobby`)for(let e of this.seats)e&&(e.ready=!1);this.changed()}}broadcastFast(e){for(let t of this.seats)t?.link?.sendFast(e)}close(){if(!this.closed){this.closed=!0,window.clearInterval(this.timer);for(let e of this.seats){let t=e?.link;t&&(t.onClose=null,this.sendTo(t,{t:`closed`}),window.setTimeout(()=>t.close(),400))}}}dropLinks(){for(let e of this.seats)e?.link?.close()}toSave(){return{code:this.code,seats:this.seats.filter(e=>e!==null).map(e=>({slot:e.slot,token:e.token,name:e.name,isHost:e.isHost})),bots:this.bots,aiLevel:this.aiLevel,track:this.track}}newSeat(e,t,n,r){return{slot:e,token:t,name:n,isHost:r,link:null,ready:!1,controller:!1,ctrlRtt:-1,offlineSince:null}}sendTo(e,t){e.send(t)}reject(e,t){e.onClose=null,this.sendTo(e,{t:`reject`,reason:t}),window.setTimeout(()=>e.close(),400)}handleHello(e,t){if(t.v!==3){this.reject(e,`version`);return}let n=String(t.token??``);if(n.length<8){this.reject(e,`version`);return}let r=this.seats.find(e=>e!==null&&e.token===n&&!e.isHost)??null,i=!1;if(r){r.name=On(t.name,r.name);let n=r.link;n&&n!==e&&(n.onClose=null,n.onMessage=null,n.onFast=null,this.sendTo(n,{t:`replaced`}),window.setTimeout(()=>n.close(),400))}else{if(this.phase!==`lobby`){this.reject(e,`running`);return}let a=this.seats.findIndex(e=>e===null);if(a<0){this.reject(e,`full`);return}r=this.newSeat(a,n,On(t.name,`Spieler ${a+1}`),!1),this.seats[a]=r,i=!0}let a=r;a.link=e,a.offlineSince=null,e.onMessage=t=>this.handleSeatMessage(a,e,t),e.onFast=e=>this.onFast?.(a.slot,e),e.onClose=()=>{a.link===e&&(a.link=null,a.offlineSince=Date.now(),a.controller=!1,a.ctrlRtt=-1,this.onPlayerDown?.(a.slot),this.changed())},this.sendTo(e,{t:`welcome`,slot:a.slot,state:this.state(),build:N}),i&&this.onSeatsChanged?.(),this.onPlayerLink?.(a.slot),this.changed()}handleSeatMessage(e,t,n){if(e.link===t)switch(n.t){case`ready`:e.ready=!!n.v,this.changed();break;case`name`:e.name=On(n.v,e.name),this.changed();break;case`status`:{let t=!!n.controller,r=Number.isFinite(n.ctrlRtt)?Math.round(n.ctrlRtt):-1;(e.controller!==t||e.ctrlRtt!==r)&&(e.controller=t,e.ctrlRtt=r,this.changed());break}case`leave`:t.onClose=null,this.removeSeat(e),window.setTimeout(()=>t.close(),200)}}removeSeat(e){this.seats[e.slot]===e&&(this.seats[e.slot]=null,e.link=null,this.onSeatsChanged?.(),this.changed())}housekeeping(){if(!this.closed){if(this.phase===`lobby`){let e=Date.now();for(let t of this.seats)t&&!t.isHost&&!t.link&&t.offlineSince!==null&&e-t.offlineSince>En&&this.removeSeat(t)}this.changed()}}changed(){if(this.closed)return;let e=this.state();for(let t of this.seats)t?.link&&this.sendTo(t.link,{t:`lobby`,state:e});this.onChange?.()}},An=[[1,`Gas`],[2,`Bremse`],[4,`Drift`],[8,`Item`]],jn=class{constructor(e){T(this,`root`,void 0),T(this,`marker`,void 0),T(this,`steerValue`,void 0),T(this,`lamps`,[]),T(this,`sections`,void 0),T(this,`lastSteer`,NaN),T(this,`lastButtons`,-1),this.root=e,this.marker=I(`div`,{class:`steer-marker`}),this.steerValue=I(`span`,{class:`steer-value`,text:`0.00`});let t=I(`div`,{class:`steer-bar`},I(`div`,{class:`steer-center`}),this.marker),n=I(`div`,{class:`lamps`});for(let[,e]of An){let t=I(`span`,{class:`lamp`,text:e});this.lamps.push(t),n.append(t)}this.sections=I(`div`,{class:`debug-sections`}),e.append(I(`div`,{class:`debug-input`},I(`div`,{class:`debug-title`,text:`Lenkung`}),this.steerValue,t,n),this.sections)}get visible(){return!this.root.hidden}set visible(e){this.root.hidden=!e}setInput(e,t){this.root.hidden||(e!==this.lastSteer&&(this.lastSteer=e,this.marker.style.transform=`translateX(${(e*50).toFixed(2)}%)`,this.steerValue.textContent=(e>=0?`+`:`−`)+Math.abs(e).toFixed(2)),t!==this.lastButtons&&(this.lastButtons=t,An.forEach(([e],n)=>this.lamps[n].classList.toggle(`on`,(t&e)!==0))))}setSections(e){if(this.root.hidden)return;let t=document.createDocumentFragment();for(let n of e){let e=I(`dl`,{class:`debug-list`});for(let t of n.rows)e.append(I(`dt`,{text:t.label}),I(`dd`,{class:t.tone?`tone-${t.tone}`:``,text:t.value}));t.append(I(`section`,{},I(`div`,{class:`debug-title`,text:n.title}),e))}this.sections.replaceChildren(t)}},Mn,Nn,Pn,Fn,In,Ln,Rn,zn,Bn,Vn=`attached`,Hn=1e3,Un=1001,Wn=1002,Gn=1003,Kn=1004,qn=1005,Jn=1006,Yn=1007,Xn=1008,Zn=1009,Qn=1010,$n=1011,er=1012,tr=1013,nr=1014,rr=1015,ir=1016,ar=1017,or=1018,sr=1020,cr=35902,lr=35899,ur=1021,dr=1022,fr=1023,pr=1026,mr=1027,hr=1028,gr=1029,_r=1030,vr=1031,yr=1033,br=33776,xr=33777,Sr=33778,Cr=33779,wr=35840,Tr=35841,Er=35842,Dr=35843,Or=36196,kr=37492,Ar=37496,jr=37488,Mr=37489,Nr=37490,Pr=37491,Fr=37808,Ir=37809,Lr=37810,Rr=37811,zr=37812,Br=37813,Vr=37814,Hr=37815,Ur=37816,Wr=37817,Gr=37818,Kr=37819,qr=37820,Jr=37821,Yr=36492,Xr=36494,Zr=36495,Qr=36283,$r=36284,ei=36285,ti=36286,ni=2300,ri=2301,ii=2302,ai=2303,oi=2400,si=2401,ci=2402,li=3200,ui=`srgb`,di=`srgb-linear`,fi=`linear`,pi=`srgb`,mi=7680,hi=35044,gi=35048,_i=2e3;function vi(e){for(let t=e.length-1;t>=0;--t)if(e[t]>=65535)return!0;return!1}function yi(e){return ArrayBuffer.isView(e)&&!(e instanceof DataView)}function bi(e){return document.createElementNS(`http://www.w3.org/1999/xhtml`,e)}function xi(){let e=bi(`canvas`);return e.style.display=`block`,e}var Si={};function Ci(...e){let t=`THREE.`+e.shift();console.log(t,...e)}function wi(e){let t=e[0];if(typeof t==`string`&&t.startsWith(`TSL:`)){let t=e[1];t&&t.isStackTrace?e[0]+=` `+t.getLocation():e[1]=`Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.`}return e}function V(...e){e=wi(e);let t=`THREE.`+e.shift();{let n=e[0];n&&n.isStackTrace?console.warn(n.getError(t)):console.warn(t,...e)}}function H(...e){e=wi(e);let t=`THREE.`+e.shift();{let n=e[0];n&&n.isStackTrace?console.error(n.getError(t)):console.error(t,...e)}}function Ti(...e){let t=e.join(` `);t in Si||(Si[t]=!0,V(...e))}function Ei(e,t,n){return new Promise(function(r,i){function a(){switch(e.clientWaitSync(t,e.SYNC_FLUSH_COMMANDS_BIT,0)){case e.WAIT_FAILED:i();break;case e.TIMEOUT_EXPIRED:setTimeout(a,n);break;default:r()}}setTimeout(a,n)})}var Di={0:0,2:6,4:4,3:5,1:1,6:2,7:7,5:3},Oi=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){let n=this._listeners;return n!==void 0&&n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){let n=this._listeners;if(n===void 0)return;let r=n[e];if(r!==void 0){let e=r.indexOf(t);e!==-1&&r.splice(e,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let n=t[e.type];if(n!==void 0){e.target=this;let t=n.slice(0);for(let n=0,r=t.length;n<r;n++)t[n].call(this,e);e.target=null}}},ki=`00.01.02.03.04.05.06.07.08.09.0a.0b.0c.0d.0e.0f.10.11.12.13.14.15.16.17.18.19.1a.1b.1c.1d.1e.1f.20.21.22.23.24.25.26.27.28.29.2a.2b.2c.2d.2e.2f.30.31.32.33.34.35.36.37.38.39.3a.3b.3c.3d.3e.3f.40.41.42.43.44.45.46.47.48.49.4a.4b.4c.4d.4e.4f.50.51.52.53.54.55.56.57.58.59.5a.5b.5c.5d.5e.5f.60.61.62.63.64.65.66.67.68.69.6a.6b.6c.6d.6e.6f.70.71.72.73.74.75.76.77.78.79.7a.7b.7c.7d.7e.7f.80.81.82.83.84.85.86.87.88.89.8a.8b.8c.8d.8e.8f.90.91.92.93.94.95.96.97.98.99.9a.9b.9c.9d.9e.9f.a0.a1.a2.a3.a4.a5.a6.a7.a8.a9.aa.ab.ac.ad.ae.af.b0.b1.b2.b3.b4.b5.b6.b7.b8.b9.ba.bb.bc.bd.be.bf.c0.c1.c2.c3.c4.c5.c6.c7.c8.c9.ca.cb.cc.cd.ce.cf.d0.d1.d2.d3.d4.d5.d6.d7.d8.d9.da.db.dc.dd.de.df.e0.e1.e2.e3.e4.e5.e6.e7.e8.e9.ea.eb.ec.ed.ee.ef.f0.f1.f2.f3.f4.f5.f6.f7.f8.f9.fa.fb.fc.fd.fe.ff`.split(`.`),Ai=Math.PI/180,ji=180/Math.PI;function Mi(){let e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0,r=Math.random()*4294967295|0;return(ki[e&255]+ki[e>>8&255]+ki[e>>16&255]+ki[e>>24&255]+`-`+ki[t&255]+ki[t>>8&255]+`-`+ki[t>>16&15|64]+ki[t>>24&255]+`-`+ki[n&63|128]+ki[n>>8&255]+`-`+ki[n>>16&255]+ki[n>>24&255]+ki[r&255]+ki[r>>8&255]+ki[r>>16&255]+ki[r>>24&255]).toLowerCase()}function U(e,t,n){return Math.max(t,Math.min(n,e))}function Ni(e,t){return(e%t+t)%t}function Pi(e,t,n){return(1-n)*e+n*t}function Fi(e){return 2**Math.floor(Math.log(e)/Math.LN2)}function Ii(e){switch(e.constructor){case Uint32Array:return 4294967295;case Uint16Array:return 65535;case Uint8Array:case Uint8ClampedArray:return 255;case Int32Array:return 2147483647;case Int16Array:return 32767;case Int8Array:return 127;default:return}}function Li(e,t){if(t.constructor===Float32Array)return e;let n=Ii(t);if(n===void 0)throw Error(`THREE.MathUtils: Invalid component type.`);return Math.max(e/n,-1)}function Ri(e,t){if(t.constructor===Float32Array)return e;let n=Ii(t);if(n===void 0)throw Error(`THREE.MathUtils: Invalid component type.`);return Math.round(e*n)}Rn=Symbol.iterator;var W=class{constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw Error(`THREE.Vector2: index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw Error(`THREE.Vector2: index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6],this.y=r[1]*t+r[4]*n+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=U(this.x,e.x,t.x),this.y=U(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=U(this.x,e,t),this.y=U(this.y,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(U(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(U(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),r=Math.sin(t),i=this.x-e.x,a=this.y-e.y;return this.x=i*n-a*r+e.x,this.y=i*r+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Rn](){yield this.x,yield this.y}};Mn=W,Mn.prototype.isVector2=!0;var zi=class{constructor(e=0,t=0,n=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=r}static slerpFlat(e,t,n,r,i,a,o){let s=n[r+0],c=n[r+1],l=n[r+2],u=n[r+3],d=i[a+0],f=i[a+1],p=i[a+2],m=i[a+3];if(u!==m||s!==d||c!==f||l!==p){let e=s*d+c*f+l*p+u*m;e<0&&(d=-d,f=-f,p=-p,m=-m,e=-e);let t=1-o;if(e<.9995){let n=Math.acos(e),r=Math.sin(n);t=Math.sin(t*n)/r,o=Math.sin(o*n)/r,s=s*t+d*o,c=c*t+f*o,l=l*t+p*o,u=u*t+m*o}else{s=s*t+d*o,c=c*t+f*o,l=l*t+p*o,u=u*t+m*o;let e=1/Math.sqrt(s*s+c*c+l*l+u*u);s*=e,c*=e,l*=e,u*=e}}e[t]=s,e[t+1]=c,e[t+2]=l,e[t+3]=u}static multiplyQuaternionsFlat(e,t,n,r,i,a){let o=n[r],s=n[r+1],c=n[r+2],l=n[r+3],u=i[a],d=i[a+1],f=i[a+2],p=i[a+3];return e[t]=o*p+l*u+s*f-c*d,e[t+1]=s*p+l*d+c*u-o*f,e[t+2]=c*p+l*f+o*d-s*u,e[t+3]=l*p-o*u-s*d-c*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,r){return this._x=e,this._y=t,this._z=n,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let n=e._x,r=e._y,i=e._z,a=e._order,o=Math.cos,s=Math.sin,c=o(n/2),l=o(r/2),u=o(i/2),d=s(n/2),f=s(r/2),p=s(i/2);switch(a){case`XYZ`:this._x=d*l*u+c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u-d*f*p;break;case`YXZ`:this._x=d*l*u+c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u+d*f*p;break;case`ZXY`:this._x=d*l*u-c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u-d*f*p;break;case`ZYX`:this._x=d*l*u-c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u+d*f*p;break;case`YZX`:this._x=d*l*u+c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u-d*f*p;break;case`XZY`:this._x=d*l*u-c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u+d*f*p;break;default:V(`Quaternion: .setFromEuler() encountered an unknown order: `+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,r=Math.sin(n);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],r=t[4],i=t[8],a=t[1],o=t[5],s=t[9],c=t[2],l=t[6],u=t[10],d=n+o+u;if(d>0){let e=.5/Math.sqrt(d+1);this._w=.25/e,this._x=(l-s)*e,this._y=(i-c)*e,this._z=(a-r)*e}else if(n>o&&n>u){let e=2*Math.sqrt(1+n-o-u);this._w=(l-s)/e,this._x=.25*e,this._y=(r+a)/e,this._z=(i+c)/e}else if(o>u){let e=2*Math.sqrt(1+o-n-u);this._w=(i-c)/e,this._x=(r+a)/e,this._y=.25*e,this._z=(s+l)/e}else{let e=2*Math.sqrt(1+u-n-o);this._w=(a-r)/e,this._x=(i+c)/e,this._y=(s+l)/e,this._z=.25*e}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(U(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let r=Math.min(1,t/n);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x*=e,this._y*=e,this._z*=e,this._w*=e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,r=e._y,i=e._z,a=e._w,o=t._x,s=t._y,c=t._z,l=t._w;return this._x=n*l+a*o+r*c-i*s,this._y=r*l+a*s+i*o-n*c,this._z=i*l+a*c+n*s-r*o,this._w=a*l-n*o-r*s-i*c,this._onChangeCallback(),this}slerp(e,t){let n=e._x,r=e._y,i=e._z,a=e._w,o=this.dot(e);o<0&&(n=-n,r=-r,i=-i,a=-a,o=-o);let s=1-t;if(o<.9995){let e=Math.acos(o),c=Math.sin(e);s=Math.sin(s*e)/c,t=Math.sin(t*e)/c,this._x=this._x*s+n*t,this._y=this._y*s+r*t,this._z=this._z*s+i*t,this._w=this._w*s+a*t,this._onChangeCallback()}else this._x=this._x*s+n*t,this._y=this._y*s+r*t,this._z=this._z*s+i*t,this._w=this._w*s+a*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),r=Math.sqrt(1-n),i=Math.sqrt(n);return this.set(r*Math.sin(e),r*Math.cos(e),i*Math.sin(t),i*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}};zn=Symbol.iterator;var G=class{constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw Error(`THREE.Vector3: index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw Error(`THREE.Vector3: index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Vi.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Vi.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,r=this.z,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6]*r,this.y=i[1]*t+i[4]*n+i[7]*r,this.z=i[2]*t+i[5]*n+i[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,i=e.elements,a=1/(i[3]*t+i[7]*n+i[11]*r+i[15]);return this.x=(i[0]*t+i[4]*n+i[8]*r+i[12])*a,this.y=(i[1]*t+i[5]*n+i[9]*r+i[13])*a,this.z=(i[2]*t+i[6]*n+i[10]*r+i[14])*a,this}applyQuaternion(e){let t=this.x,n=this.y,r=this.z,i=e.x,a=e.y,o=e.z,s=e.w,c=2*(a*r-o*n),l=2*(o*t-i*r),u=2*(i*n-a*t);return this.x=t+s*c+a*u-o*l,this.y=n+s*l+o*c-i*u,this.z=r+s*u+i*l-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,r=this.z,i=e.elements;return this.x=i[0]*t+i[4]*n+i[8]*r,this.y=i[1]*t+i[5]*n+i[9]*r,this.z=i[2]*t+i[6]*n+i[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=U(this.x,e.x,t.x),this.y=U(this.y,e.y,t.y),this.z=U(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=U(this.x,e,t),this.y=U(this.y,e,t),this.z=U(this.z,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(U(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,r=e.y,i=e.z,a=t.x,o=t.y,s=t.z;return this.x=r*s-i*o,this.y=i*a-n*s,this.z=n*o-r*a,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Bi.copy(this).projectOnVector(e),this.sub(Bi)}reflect(e){return this.sub(Bi.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(U(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,r=this.z-e.z;return t*t+n*n+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let r=Math.sin(t)*e;return this.x=r*Math.sin(n),this.y=Math.cos(t)*e,this.z=r*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[zn](){yield this.x,yield this.y,yield this.z}};Nn=G,Nn.prototype.isVector3=!0;var Bi=new G,Vi=new zi,K=class{constructor(e,t,n,r,i,a,o,s,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,r,i,a,o,s,c)}set(e,t,n,r,i,a,o,s,c){let l=this.elements;return l[0]=e,l[1]=r,l[2]=o,l[3]=t,l[4]=i,l[5]=s,l[6]=n,l[7]=a,l[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,i=this.elements,a=n[0],o=n[3],s=n[6],c=n[1],l=n[4],u=n[7],d=n[2],f=n[5],p=n[8],m=r[0],h=r[3],g=r[6],_=r[1],v=r[4],y=r[7],b=r[2],x=r[5],S=r[8];return i[0]=a*m+o*_+s*b,i[3]=a*h+o*v+s*x,i[6]=a*g+o*y+s*S,i[1]=c*m+l*_+u*b,i[4]=c*h+l*v+u*x,i[7]=c*g+l*y+u*S,i[2]=d*m+f*_+p*b,i[5]=d*h+f*v+p*x,i[8]=d*g+f*y+p*S,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8];return t*a*l-t*o*c-n*i*l+n*o*s+r*i*c-r*a*s}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8],u=l*a-o*c,d=o*s-l*i,f=c*i-a*s,p=t*u+n*d+r*f;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);let m=1/p;return e[0]=u*m,e[1]=(r*c-l*n)*m,e[2]=(o*n-r*a)*m,e[3]=d*m,e[4]=(l*t-r*s)*m,e[5]=(r*i-o*t)*m,e[6]=f*m,e[7]=(n*s-c*t)*m,e[8]=(a*t-n*i)*m,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,r,i,a,o){let s=Math.cos(i),c=Math.sin(i);return this.set(n*s,n*c,-n*(s*a+c*o)+a+e,-r*c,r*s,-r*(-c*a+s*o)+o+t,0,0,1),this}scale(e,t){return Ti(`Matrix3: .scale() is deprecated. Use .makeScale() instead.`),this.premultiply(Hi.makeScale(e,t)),this}rotate(e){return Ti(`Matrix3: .rotate() is deprecated. Use .makeRotation() instead.`),this.premultiply(Hi.makeRotation(-e)),this}translate(e,t){return Ti(`Matrix3: .translate() is deprecated. Use .makeTranslation() instead.`),this.premultiply(Hi.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let e=0;e<9;e++)if(t[e]!==n[e])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}};Pn=K,Pn.prototype.isMatrix3=!0;var Hi=new K,Ui=new K().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Wi=new K().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Gi(){let e={enabled:!0,workingColorSpace:di,spaces:{},convert:function(e,t,n){return this.enabled===!1||t===n||!t||!n||(this.spaces[t].transfer===`srgb`&&(e.r=qi(e.r),e.g=qi(e.g),e.b=qi(e.b)),this.spaces[t].primaries!==this.spaces[n].primaries&&(e.applyMatrix3(this.spaces[t].toXYZ),e.applyMatrix3(this.spaces[n].fromXYZ)),this.spaces[n].transfer===`srgb`&&(e.r=Ji(e.r),e.g=Ji(e.g),e.b=Ji(e.b))),e},workingToColorSpace:function(e,t){return this.convert(e,this.workingColorSpace,t)},colorSpaceToWorking:function(e,t){return this.convert(e,t,this.workingColorSpace)},getPrimaries:function(e){return this.spaces[e].primaries},getTransfer:function(e){return e===``?fi:this.spaces[e].transfer},getToneMappingMode:function(e){return this.spaces[e].outputColorSpaceConfig.toneMappingMode||`standard`},getLuminanceCoefficients:function(e,t=this.workingColorSpace){return e.fromArray(this.spaces[t].luminanceCoefficients)},define:function(e){Object.assign(this.spaces,e)},_getMatrix:function(e,t,n){return e.copy(this.spaces[n].fromXYZ).multiply(this.spaces[t].toXYZ)},_getDrawingBufferColorSpace:function(e){return this.spaces[e].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(e=this.workingColorSpace){return this.spaces[e].workingColorSpaceConfig.unpackColorSpace}},t=[.64,.33,.3,.6,.15,.06],n=[.2126,.7152,.0722],r=[.3127,.329];return e.define({[di]:{primaries:t,whitePoint:r,transfer:fi,toXYZ:Ui,fromXYZ:Wi,luminanceCoefficients:n,workingColorSpaceConfig:{unpackColorSpace:ui},outputColorSpaceConfig:{drawingBufferColorSpace:ui}},[ui]:{primaries:t,whitePoint:r,transfer:pi,toXYZ:Ui,fromXYZ:Wi,luminanceCoefficients:n,outputColorSpaceConfig:{drawingBufferColorSpace:ui}}}),e}var Ki=Gi();function qi(e){return e<.04045?e*.0773993808:(e*.9478672986+.0521327014)**2.4}function Ji(e){return e<.0031308?e*12.92:1.055*e**.41666-.055}var Yi,Xi=class{static getDataURL(e,t=`image/png`){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>`u`)return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{Yi===void 0&&(Yi=bi(`canvas`)),Yi.width=e.width,Yi.height=e.height;let t=Yi.getContext(`2d`);e instanceof ImageData?t.putImageData(e,0,0):t.drawImage(e,0,0,e.width,e.height),n=Yi}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap){let t=bi(`canvas`);t.width=e.width,t.height=e.height;let n=t.getContext(`2d`);n.drawImage(e,0,0,e.width,e.height);let r=n.getImageData(0,0,e.width,e.height),i=r.data;for(let e=0;e<i.length;e++)i[e]=qi(i[e]/255)*255;return n.putImageData(r,0,0),t}if(e.data){let t=e.data.slice(0);for(let e=0;e<t.length;e++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[e]=Math.floor(qi(t[e]/255)*255):t[e]=qi(t[e]);return{data:t,width:e.width,height:e.height}}return V(`ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied.`),e}},Zi=0,Qi=class{constructor(e=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:Zi++}),this.uuid=Mi(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<`u`&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<`u`&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t===null?e.set(0,0,0):e.set(t.width||0,t.height||0,t.depth||0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e==`string`;if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:``},r=this.data;if(r!==null){let e;if(Array.isArray(r)){e=[];for(let t=0,n=r.length;t<n;t++)r[t].isDataTexture?e.push($i(r[t].image)):e.push($i(r[t]))}else e=$i(r);n.url=e}return t||(e.images[this.uuid]=n),n}};function $i(e){return typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap?Xi.getDataURL(e):e.data?{data:Array.from(e.data),width:e.width,height:e.height,type:e.data.constructor.name}:(V(`Texture: Unable to serialize Texture.`),{})}var ea=0,ta=new G,na=class e extends Oi{constructor(t=e.DEFAULT_IMAGE,n=e.DEFAULT_MAPPING,r=Un,i=Un,a=Jn,o=Xn,s=fr,c=Zn,l=e.DEFAULT_ANISOTROPY,u=``){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:ea++}),this.uuid=Mi(),this.name=``,this.source=new Qi(t),this.mipmaps=[],this.mapping=n,this.channel=0,this.wrapS=r,this.wrapT=i,this.magFilter=a,this.minFilter=o,this.anisotropy=l,this.format=s,this.internalFormat=null,this.type=c,this.offset=new W(0,0),this.repeat=new W(1,1),this.center=new W(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new K,this.generateMipmaps=!0,this.mipmapsAutoUpdate=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=u,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.isPMREMTexture=!1,this.normalized=!1}get width(){return this.source.getSize(ta).x}get height(){return this.source.getSize(ta).y}get depth(){return this.source.getSize(ta).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.mipmapsAutoUpdate=e.mipmapsAutoUpdate,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isPMREMTexture=e.isPMREMTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let n=e[t];if(n===void 0){V(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let r=this[t];r===void 0?V(`Texture.setValues(): property '${t}' does not exist.`):r&&n&&r.isVector2&&n.isVector2||r&&n&&r.isVector3&&n.isVector3||r&&n&&r.isMatrix3&&n.isMatrix3?r.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e==`string`;if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.7,type:`Texture`,generator:`Texture.toJSON`},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,mipmapsAutoUpdate:this.mipmapsAutoUpdate,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:`dispose`})}transformUv(e){if(this.mapping!==300)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Hn:e.x-=Math.floor(e.x);break;case Un:e.x=e.x<0?0:1;break;case Wn:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x-=Math.floor(e.x)}if(e.y<0||e.y>1)switch(this.wrapT){case Hn:e.y-=Math.floor(e.y);break;case Un:e.y=e.y<0?0:1;break;case Wn:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y-=Math.floor(e.y)}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};na.DEFAULT_IMAGE=null,na.DEFAULT_MAPPING=300,na.DEFAULT_ANISOTROPY=1,Bn=Symbol.iterator;var ra=class{constructor(e=0,t=0,n=0,r=1){this.x=e,this.y=t,this.z=n,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,r){return this.x=e,this.y=t,this.z=n,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw Error(`THREE.Vector4: index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw Error(`THREE.Vector4: index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w===void 0?1:e.w,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,i=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*r+a[12]*i,this.y=a[1]*t+a[5]*n+a[9]*r+a[13]*i,this.z=a[2]*t+a[6]*n+a[10]*r+a[14]*i,this.w=a[3]*t+a[7]*n+a[11]*r+a[15]*i,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,r,i,a=.01,o=.1,s=e.elements,c=s[0],l=s[4],u=s[8],d=s[1],f=s[5],p=s[9],m=s[2],h=s[6],g=s[10];if(Math.abs(l-d)<a&&Math.abs(u-m)<a&&Math.abs(p-h)<a){if(Math.abs(l+d)<o&&Math.abs(u+m)<o&&Math.abs(p+h)<o&&Math.abs(c+f+g-3)<o)return this.set(1,0,0,0),this;t=Math.PI;let e=(c+1)/2,s=(f+1)/2,_=(g+1)/2,v=(l+d)/4,y=(u+m)/4,b=(p+h)/4;return e>s&&e>_?e<a?(n=0,r=.707106781,i=.707106781):(n=Math.sqrt(e),r=v/n,i=y/n):s>_?s<a?(n=.707106781,r=0,i=.707106781):(r=Math.sqrt(s),n=v/r,i=b/r):_<a?(n=.707106781,r=.707106781,i=0):(i=Math.sqrt(_),n=y/i,r=b/i),this.set(n,r,i,t),this}let _=Math.sqrt((h-p)*(h-p)+(u-m)*(u-m)+(d-l)*(d-l));return Math.abs(_)<.001&&(_=1),this.x=(h-p)/_,this.y=(u-m)/_,this.z=(d-l)/_,this.w=Math.acos((c+f+g-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=U(this.x,e.x,t.x),this.y=U(this.y,e.y,t.y),this.z=U(this.z,e.z,t.z),this.w=U(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=U(this.x,e,t),this.y=U(this.y,e,t),this.z=U(this.z,e,t),this.w=U(this.w,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(U(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Bn](){yield this.x,yield this.y,yield this.z,yield this.w}};Fn=ra,Fn.prototype.isVector4=!0;var ia=class extends Oi{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Jn,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new ra(0,0,e,t),this.scissorTest=!1,this.viewport=new ra(0,0,e,t),this.textures=[];let r=n.count;for(let i=0;i<r;i++)this.textures[i]=new na({width:e,height:t,depth:n.depth}),this.textures[i].isRenderTargetTexture=!0,this.textures[i].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveColorBuffer=n.resolveColorBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.storeMultisampledColorBuffer=n.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=n.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=n.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:Jn,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.mipmapsAutoUpdate!==void 0&&(t.mipmapsAutoUpdate=e.mipmapsAutoUpdate),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let e=0;e<this.textures.length;e++)this.textures[e].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),e!==null&&e.renderTarget===null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let r=0,i=this.textures.length;r<i;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=n,this.textures[r].isData3DTexture!==!0&&(this.textures[r].isArrayTexture=this.textures[r].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let n=Object.assign({},e.textures[t].image);this.textures[t].source=new Qi(n)}if(this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveColorBuffer=e.resolveColorBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,this.storeMultisampledColorBuffer=e.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=e.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=e.storeMultisampledStencilBuffer,e.depthTexture!==null){if(e.depthTexture.renderTarget===e){let t=e.depthTexture.clone();t.renderTarget=null,this.depthTexture=t}else this.depthTexture=e.depthTexture}else this.depthTexture=null;return this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:`dispose`})}},aa=class extends ia{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}},oa=class extends na{constructor(e=null,t=1,n=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:r},this.magFilter=Gn,this.minFilter=Gn,this.wrapR=Un,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}},sa=class extends na{constructor(e=null,t=1,n=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:r},this.magFilter=Gn,this.minFilter=Gn,this.wrapR=Un,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}},q=class e{constructor(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h)}set(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h){let g=this.elements;return g[0]=e,g[4]=t,g[8]=n,g[12]=r,g[1]=i,g[5]=a,g[9]=o,g[13]=s,g[2]=c,g[6]=l,g[10]=u,g[14]=d,g[3]=f,g[7]=p,g[11]=m,g[15]=h,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new e().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,n=e.elements,r=1/ca.setFromMatrixColumn(e,0).length(),i=1/ca.setFromMatrixColumn(e,1).length(),a=1/ca.setFromMatrixColumn(e,2).length();return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t[3]=0,t[4]=n[4]*i,t[5]=n[5]*i,t[6]=n[6]*i,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,n=e.x,r=e.y,i=e.z,a=Math.cos(n),o=Math.sin(n),s=Math.cos(r),c=Math.sin(r),l=Math.cos(i),u=Math.sin(i);if(e.order===`XYZ`){let e=a*l,n=a*u,r=o*l,i=o*u;t[0]=s*l,t[4]=-s*u,t[8]=c,t[1]=n+r*c,t[5]=e-i*c,t[9]=-o*s,t[2]=i-e*c,t[6]=r+n*c,t[10]=a*s}else if(e.order===`YXZ`){let e=s*l,n=s*u,r=c*l,i=c*u;t[0]=e+i*o,t[4]=r*o-n,t[8]=a*c,t[1]=a*u,t[5]=a*l,t[9]=-o,t[2]=n*o-r,t[6]=i+e*o,t[10]=a*s}else if(e.order===`ZXY`){let e=s*l,n=s*u,r=c*l,i=c*u;t[0]=e-i*o,t[4]=-a*u,t[8]=r+n*o,t[1]=n+r*o,t[5]=a*l,t[9]=i-e*o,t[2]=-a*c,t[6]=o,t[10]=a*s}else if(e.order===`ZYX`){let e=a*l,n=a*u,r=o*l,i=o*u;t[0]=s*l,t[4]=r*c-n,t[8]=e*c+i,t[1]=s*u,t[5]=i*c+e,t[9]=n*c-r,t[2]=-c,t[6]=o*s,t[10]=a*s}else if(e.order===`YZX`){let e=a*s,n=a*c,r=o*s,i=o*c;t[0]=s*l,t[4]=i-e*u,t[8]=r*u+n,t[1]=u,t[5]=a*l,t[9]=-o*l,t[2]=-c*l,t[6]=n*u+r,t[10]=e-i*u}else if(e.order===`XZY`){let e=a*s,n=a*c,r=o*s,i=o*c;t[0]=s*l,t[4]=-u,t[8]=c*l,t[1]=e*u+i,t[5]=a*l,t[9]=n*u-r,t[2]=r*u-n,t[6]=o*l,t[10]=i*u+e}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(ua,e,da)}lookAt(e,t,n){let r=this.elements;return ma.subVectors(e,t),ma.lengthSq()===0&&(ma.z=1),ma.normalize(),fa.crossVectors(n,ma),fa.lengthSq()===0&&(Math.abs(n.z)===1?ma.x+=1e-4:ma.z+=1e-4,ma.normalize(),fa.crossVectors(n,ma)),fa.normalize(),pa.crossVectors(ma,fa),r[0]=fa.x,r[4]=pa.x,r[8]=ma.x,r[1]=fa.y,r[5]=pa.y,r[9]=ma.y,r[2]=fa.z,r[6]=pa.z,r[10]=ma.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,i=this.elements,a=n[0],o=n[4],s=n[8],c=n[12],l=n[1],u=n[5],d=n[9],f=n[13],p=n[2],m=n[6],h=n[10],g=n[14],_=n[3],v=n[7],y=n[11],b=n[15],x=r[0],S=r[4],C=r[8],w=r[12],T=r[1],E=r[5],D=r[9],O=r[13],k=r[2],A=r[6],j=r[10],ee=r[14],M=r[3],N=r[7],P=r[11],F=r[15];return i[0]=a*x+o*T+s*k+c*M,i[4]=a*S+o*E+s*A+c*N,i[8]=a*C+o*D+s*j+c*P,i[12]=a*w+o*O+s*ee+c*F,i[1]=l*x+u*T+d*k+f*M,i[5]=l*S+u*E+d*A+f*N,i[9]=l*C+u*D+d*j+f*P,i[13]=l*w+u*O+d*ee+f*F,i[2]=p*x+m*T+h*k+g*M,i[6]=p*S+m*E+h*A+g*N,i[10]=p*C+m*D+h*j+g*P,i[14]=p*w+m*O+h*ee+g*F,i[3]=_*x+v*T+y*k+b*M,i[7]=_*S+v*E+y*A+b*N,i[11]=_*C+v*D+y*j+b*P,i[15]=_*w+v*O+y*ee+b*F,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],r=e[8],i=e[12],a=e[1],o=e[5],s=e[9],c=e[13],l=e[2],u=e[6],d=e[10],f=e[14],p=e[3],m=e[7],h=e[11],g=e[15],_=s*f-c*d,v=o*f-c*u,y=o*d-s*u,b=a*f-c*l,x=a*d-s*l,S=a*u-o*l;return t*(m*_-h*v+g*y)-n*(p*_-h*b+g*x)+r*(p*v-m*b+g*S)-i*(p*y-m*x+h*S)}determinantAffine(){let e=this.elements,t=e[0],n=e[4],r=e[8],i=e[1],a=e[5],o=e[9],s=e[2],c=e[6],l=e[10];return t*(a*l-o*c)-n*(i*l-o*s)+r*(i*c-a*s)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8],u=e[9],d=e[10],f=e[11],p=e[12],m=e[13],h=e[14],g=e[15],_=t*o-n*a,v=t*s-r*a,y=t*c-i*a,b=n*s-r*o,x=n*c-i*o,S=r*c-i*s,C=l*m-u*p,w=l*h-d*p,T=l*g-f*p,E=u*h-d*m,D=u*g-f*m,O=d*g-f*h,k=_*O-v*D+y*E+b*T-x*w+S*C;if(k===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let A=1/k;return e[0]=(o*O-s*D+c*E)*A,e[1]=(r*D-n*O-i*E)*A,e[2]=(m*S-h*x+g*b)*A,e[3]=(d*x-u*S-f*b)*A,e[4]=(s*T-a*O-c*w)*A,e[5]=(t*O-r*T+i*w)*A,e[6]=(h*y-p*S-g*v)*A,e[7]=(l*S-d*y+f*v)*A,e[8]=(a*D-o*T+c*C)*A,e[9]=(n*T-t*D-i*C)*A,e[10]=(p*x-m*y+g*_)*A,e[11]=(u*y-l*x-f*_)*A,e[12]=(o*w-a*E-s*C)*A,e[13]=(t*E-n*w+r*C)*A,e[14]=(m*v-p*b-h*_)*A,e[15]=(l*b-u*v+d*_)*A,this}scale(e){let t=this.elements,n=e.x,r=e.y,i=e.z;return t[0]*=n,t[4]*=r,t[8]*=i,t[1]*=n,t[5]*=r,t[9]*=i,t[2]*=n,t[6]*=r,t[10]*=i,t[3]*=n,t[7]*=r,t[11]*=i,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,r))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),r=Math.sin(t),i=1-n,a=e.x,o=e.y,s=e.z,c=i*a,l=i*o;return this.set(c*a+n,c*o-r*s,c*s+r*o,0,c*o+r*s,l*o+n,l*s-r*a,0,c*s-r*o,l*s+r*a,i*s*s+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,r,i,a){return this.set(1,n,i,0,e,1,a,0,t,r,1,0,0,0,0,1),this}compose(e,t,n){let r=this.elements,i=t._x,a=t._y,o=t._z,s=t._w,c=i+i,l=a+a,u=o+o,d=i*c,f=i*l,p=i*u,m=a*l,h=a*u,g=o*u,_=s*c,v=s*l,y=s*u,b=n.x,x=n.y,S=n.z;return r[0]=(1-(m+g))*b,r[1]=(f+y)*b,r[2]=(p-v)*b,r[3]=0,r[4]=(f-y)*x,r[5]=(1-(d+g))*x,r[6]=(h+_)*x,r[7]=0,r[8]=(p+v)*S,r[9]=(h-_)*S,r[10]=(1-(d+m))*S,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,n){let r=this.elements;e.x=r[12],e.y=r[13],e.z=r[14];let i=this.determinantAffine();if(i===0)return n.set(1,1,1),t.identity(),this;let a=ca.set(r[0],r[1],r[2]).length(),o=ca.set(r[4],r[5],r[6]).length(),s=ca.set(r[8],r[9],r[10]).length();i<0&&(a=-a),la.copy(this);let c=1/a,l=1/o,u=1/s;return la.elements[0]*=c,la.elements[1]*=c,la.elements[2]*=c,la.elements[4]*=l,la.elements[5]*=l,la.elements[6]*=l,la.elements[8]*=u,la.elements[9]*=u,la.elements[10]*=u,t.setFromRotationMatrix(la),n.x=a,n.y=o,n.z=s,this}makePerspective(e,t,n,r,i,a,o=_i,s=!1){let c=this.elements,l=2*i/(t-e),u=2*i/(n-r),d=(t+e)/(t-e),f=(n+r)/(n-r),p,m;if(s)p=i/(a-i),m=a*i/(a-i);else if(o===2e3)p=-(a+i)/(a-i),m=-2*a*i/(a-i);else if(o===2001)p=-a/(a-i),m=-a*i/(a-i);else throw Error(`THREE.Matrix4.makePerspective(): Invalid coordinate system: `+o);return c[0]=l,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=u,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=p,c[14]=m,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,r,i,a,o=_i,s=!1){let c=this.elements,l=2/(t-e),u=2/(n-r),d=-(t+e)/(t-e),f=-(n+r)/(n-r),p,m;if(s)p=1/(a-i),m=a/(a-i);else if(o===2e3)p=-2/(a-i),m=-(a+i)/(a-i);else if(o===2001)p=-1/(a-i),m=-i/(a-i);else throw Error(`THREE.Matrix4.makeOrthographic(): Invalid coordinate system: `+o);return c[0]=l,c[4]=0,c[8]=0,c[12]=d,c[1]=0,c[5]=u,c[9]=0,c[13]=f,c[2]=0,c[6]=0,c[10]=p,c[14]=m,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let e=0;e<16;e++)if(t[e]!==n[e])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}};In=q,In.prototype.isMatrix4=!0;var ca=new G,la=new q,ua=new G(0,0,0),da=new G(1,1,1),fa=new G,pa=new G,ma=new G,ha=new q,ga=new zi,_a=class e{constructor(t=0,n=0,r=0,i=e.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=n,this._z=r,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,r=this._order){return this._x=e,this._y=t,this._z=n,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let r=e.elements,i=r[0],a=r[4],o=r[8],s=r[1],c=r[5],l=r[9],u=r[2],d=r[6],f=r[10];switch(t){case`XYZ`:this._y=Math.asin(U(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-l,f),this._z=Math.atan2(-a,i)):(this._x=Math.atan2(d,c),this._z=0);break;case`YXZ`:this._x=Math.asin(-U(l,-1,1)),Math.abs(l)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(s,c)):(this._y=Math.atan2(-u,i),this._z=0);break;case`ZXY`:this._x=Math.asin(U(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,f),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(s,i));break;case`ZYX`:this._y=Math.asin(-U(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(s,i)):(this._x=0,this._z=Math.atan2(-a,c));break;case`YZX`:this._z=Math.asin(U(s,-1,1)),Math.abs(s)<.9999999?(this._x=Math.atan2(-l,c),this._y=Math.atan2(-u,i)):(this._x=0,this._y=Math.atan2(o,f));break;case`XZY`:this._z=Math.asin(-U(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,i)):(this._x=Math.atan2(-l,f),this._y=0);break;default:V(`Euler: .setFromRotationMatrix() encountered an unknown order: `+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return ha.makeRotationFromQuaternion(e),this.setFromRotationMatrix(ha,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return ga.setFromEuler(this),this.setFromQuaternion(ga,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};_a.DEFAULT_ORDER=`XYZ`;var va=class{constructor(){this.mask=1}set(e){this.mask=1<<e>>>0}enable(e){this.mask|=1<<e}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e}disable(e){this.mask&=~(1<<e)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return!!(this.mask&1<<e)}},ya=0,ba=new G,xa=new zi,Sa=new q,Ca=new G,wa=new G,Ta=new G,Ea=new zi,Da=new G(1,0,0),Oa=new G(0,1,0),ka=new G(0,0,1),Aa={type:`added`},ja={type:`removed`},Ma={type:`childadded`,child:null},Na={type:`childremoved`,child:null},Pa=class e extends Oi{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:ya++}),this.uuid=Mi(),this.name=``,this.type=`Object3D`,this.parent=null,this.children=[],this.up=e.DEFAULT_UP.clone();let t=new G,n=new _a,r=new zi,i=new G(1,1,1);function a(){r.setFromEuler(n,!1)}function o(){n.setFromQuaternion(r,void 0,!1)}n._onChange(a),r._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:n},quaternion:{configurable:!0,enumerable:!0,value:r},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new q},normalMatrix:{value:new K}}),this.matrix=new q,this.matrixWorld=new q,this.matrixAutoUpdate=e.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=e.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new va,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale),this.pivot!==null&&this.position.copy(this.pivot).applyMatrix4(this.matrix).sub(this.pivot)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return xa.setFromAxisAngle(e,t),this.quaternion.multiply(xa),this}rotateOnWorldAxis(e,t){return xa.setFromAxisAngle(e,t),this.quaternion.premultiply(xa),this}rotateX(e){return this.rotateOnAxis(Da,e)}rotateY(e){return this.rotateOnAxis(Oa,e)}rotateZ(e){return this.rotateOnAxis(ka,e)}translateOnAxis(e,t){return ba.copy(e).applyQuaternion(this.quaternion),this.position.add(ba.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Da,e)}translateY(e){return this.translateOnAxis(Oa,e)}translateZ(e){return this.translateOnAxis(ka,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Sa.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?Ca.copy(e):Ca.set(e,t,n);let r=this.parent;this.updateWorldMatrix(!0,!1),wa.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Sa.lookAt(wa,Ca,this.up):Sa.lookAt(Ca,wa,this.up),this.quaternion.setFromRotationMatrix(Sa),r&&(Sa.extractRotation(r.matrixWorld),xa.setFromRotationMatrix(Sa),this.quaternion.premultiply(xa.invert()))}add(e){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return e===this?(H(`Object3D.add: object can't be added as a child of itself.`,e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Aa),Ma.child=e,this.dispatchEvent(Ma),Ma.child=null):H(`Object3D.add: object not an instance of THREE.Object3D.`,e),this)}remove(e){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.remove(arguments[e]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(ja),Na.child=e,this.dispatchEvent(Na),Na.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Sa.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Sa.multiply(e.parent.matrixWorld)),e.applyMatrix4(Sa),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Aa),Ma.child=e,this.dispatchEvent(Ma),Ma.child=null,this}getObjectById(e){return this.getObjectByProperty(`id`,e)}getObjectByName(e){return this.getObjectByProperty(`name`,e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,r=this.children.length;n<r;n++){let r=this.children[n].getObjectByProperty(e,t);if(r!==void 0)return r}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);let r=this.children;for(let i=0,a=r.length;i<a;i++)r[i].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(wa,e,Ta),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(wa,Ea,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}intersectsFrustum(){return!0}traverse(e){e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,n=e.y,r=e.z,i=this.matrix.elements;i[12]+=t-i[0]*t-i[4]*n-i[8]*r,i[13]+=n-i[1]*t-i[5]*n-i[9]*r,i[14]+=r-i[2]*t-i[6]*n-i[10]*r}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){let r=this.parent;if(e===!0&&r!==null&&r.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),t===!0){let e=this.children;for(let t=0,r=e.length;t<r;t++)e[t].updateWorldMatrix(!1,!0,n)}}toJSON(e){let t=e===void 0||typeof e==`string`,n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:`Object`,generator:`Object3D.toJSON`});let r={};r.uuid=this.uuid,r.type=this.type,r.name=this.name,r.castShadow=this.castShadow,r.receiveShadow=this.receiveShadow,r.visible=this.visible,r.frustumCulled=this.frustumCulled,r.renderOrder=this.renderOrder,r.static=this.static,r.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.pivot!==null&&(r.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(r.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(r.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(r.type=`InstancedMesh`,r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type=`BatchedMesh`,r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(e=>({...e,boundingBox:e.boundingBox?e.boundingBox.toJSON():void 0,boundingSphere:e.boundingSphere?e.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(e=>({...e})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(e),r.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON()));function i(t,n){return t[n.uuid]===void 0&&(t[n.uuid]=n.toJSON(e)),n.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=i(e.geometries,this.geometry);let t=this.geometry.parameters;if(t!==void 0&&t.shapes!==void 0){let n=t.shapes;if(Array.isArray(n))for(let t=0,r=n.length;t<r;t++){let r=n[t];i(e.shapes,r)}else i(e.shapes,n)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(i(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0){if(Array.isArray(this.material)){let t=[];for(let n=0,r=this.material.length;n<r;n++)t.push(i(e.materials,this.material[n]));r.material=t}else r.material=i(e.materials,this.material)}if(this.children.length>0){r.children=[];for(let t=0;t<this.children.length;t++)r.children.push(this.children[t].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let t=0;t<this.animations.length;t++){let n=this.animations[t];r.animations.push(i(e.animations,n))}}if(t){let t=a(e.geometries),r=a(e.materials),i=a(e.textures),o=a(e.images),s=a(e.shapes),c=a(e.skeletons),l=a(e.animations),u=a(e.nodes);t.length>0&&(n.geometries=t),r.length>0&&(n.materials=r),i.length>0&&(n.textures=i),o.length>0&&(n.images=o),s.length>0&&(n.shapes=s),c.length>0&&(n.skeletons=c),l.length>0&&(n.animations=l),u.length>0&&(n.nodes=u)}return n.object=r,n;function a(e){let t=[];for(let n in e){let r=e[n];delete r.metadata,t.push(r)}return t}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot===null?null:e.pivot.clone(),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let t=0;t<e.children.length;t++){let n=e.children[t];this.add(n.clone())}return this}dispose(){this.dispatchEvent({type:`dispose`})}};Pa.DEFAULT_UP=new G(0,1,0),Pa.DEFAULT_MATRIX_AUTO_UPDATE=!0,Pa.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var Fa=class extends Pa{constructor(){super(),this.isGroup=!0,this.type=`Group`}},Ia={type:`move`},La=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Fa,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Fa,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new G,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new G),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Fa,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new G,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new G,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:`connected`,data:e}),this}disconnect(e){return this.dispatchEvent({type:`disconnected`,data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let r=null,i=null,a=null,o=this._targetRay,s=this._grip,c=this._hand;if(e&&t.session.visibilityState!==`visible-blurred`){if(c&&e.hand){a=!0;for(let r of e.hand.values()){let e=t.getJointPose(r,n),i=this._getHandJoint(c,r);e!==null&&(i.matrix.fromArray(e.transform.matrix),i.matrix.decompose(i.position,i.quaternion,i.scale),i.matrixWorldNeedsUpdate=!0,i.jointRadius=e.radius),i.visible=e!==null}let r=c.joints[`index-finger-tip`],i=c.joints[`thumb-tip`],o=r.position.distanceTo(i.position);c.inputState.pinching&&o>.025?(c.inputState.pinching=!1,this.dispatchEvent({type:`pinchend`,handedness:e.handedness,target:this})):!c.inputState.pinching&&o<=.015&&(c.inputState.pinching=!0,this.dispatchEvent({type:`pinchstart`,handedness:e.handedness,target:this}))}else s!==null&&e.gripSpace&&(i=t.getPose(e.gripSpace,n),i!==null&&(s.matrix.fromArray(i.transform.matrix),s.matrix.decompose(s.position,s.quaternion,s.scale),s.matrixWorldNeedsUpdate=!0,i.linearVelocity?(s.hasLinearVelocity=!0,s.linearVelocity.copy(i.linearVelocity)):s.hasLinearVelocity=!1,i.angularVelocity?(s.hasAngularVelocity=!0,s.angularVelocity.copy(i.angularVelocity)):s.hasAngularVelocity=!1,s.eventsEnabled&&s.dispatchEvent({type:`gripUpdated`,data:e,target:this})));o!==null&&(r=t.getPose(e.targetRaySpace,n),r===null&&i!==null&&(r=i),r!==null&&(o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.quaternion,o.scale),o.matrixWorldNeedsUpdate=!0,r.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(r.linearVelocity)):o.hasLinearVelocity=!1,r.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(r.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Ia)))}return o!==null&&(o.visible=r!==null),s!==null&&(s.visible=i!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new Fa;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}},Ra={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},za={h:0,s:0,l:0},Ba={h:0,s:0,l:0};function Va(e,t,n){return n<0&&(n+=1),n>1&&--n,n<1/6?e+(t-e)*6*n:n<1/2?t:n<2/3?e+(t-e)*6*(2/3-n):e}var J=class{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let t=e;t&&t.isColor?this.copy(t):typeof t==`number`?this.setHex(t):typeof t==`string`&&this.setStyle(t)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=ui){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Ki.colorSpaceToWorking(this,t),this}setRGB(e,t,n,r=Ki.workingColorSpace){return this.r=e,this.g=t,this.b=n,Ki.colorSpaceToWorking(this,r),this}setHSL(e,t,n,r=Ki.workingColorSpace){if(e=Ni(e,1),t=U(t,0,1),n=U(n,0,1),t===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+t):n+t-n*t,i=2*n-r;this.r=Va(i,r,e+1/3),this.g=Va(i,r,e),this.b=Va(i,r,e-1/3)}return Ki.colorSpaceToWorking(this,r),this}setStyle(e,t=ui){function n(t){t!==void 0&&parseFloat(t)<1&&V(`Color: Alpha component of `+e+` will be ignored.`)}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let i,a=r[1],o=r[2];switch(a){case`rgb`:case`rgba`:if(i=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d+(?:\.\d+)?|\.\d+)\s*)?$/.exec(o))return n(i[4]),this.setRGB(Math.min(255,parseInt(i[1],10))/255,Math.min(255,parseInt(i[2],10))/255,Math.min(255,parseInt(i[3],10))/255,t);if(i=/^\s*(\d+(?:\.\d+)?|\.\d+)\%\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*(?:,\s*(\d+(?:\.\d+)?|\.\d+)\s*)?$/.exec(o))return n(i[4]),this.setRGB(Math.min(100,parseFloat(i[1]))/100,Math.min(100,parseFloat(i[2]))/100,Math.min(100,parseFloat(i[3]))/100,t);break;case`hsl`:case`hsla`:if(i=/^\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*,\s*(\d+(?:\.\d+)?|\.\d+)\%\s*(?:,\s*(\d+(?:\.\d+)?|\.\d+)\s*)?$/.exec(o))return n(i[4]),this.setHSL(parseFloat(i[1])/360,parseFloat(i[2])/100,parseFloat(i[3])/100,t);break;default:V(`Color: Unknown color model `+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){let n=r[1],i=n.length;if(i===3)return this.setRGB(parseInt(n.charAt(0),16)/15,parseInt(n.charAt(1),16)/15,parseInt(n.charAt(2),16)/15,t);if(i===6)return this.setHex(parseInt(n,16),t);V(`Color: Invalid hex color `+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=ui){let n=Ra[e.toLowerCase()];return n===void 0?V(`Color: Unknown color `+e):this.setHex(n,t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=qi(e.r),this.g=qi(e.g),this.b=qi(e.b),this}copyLinearToSRGB(e){return this.r=Ji(e.r),this.g=Ji(e.g),this.b=Ji(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=ui){return Ki.workingToColorSpace(Ha.copy(this),e),Math.round(U(Ha.r*255,0,255))*65536+Math.round(U(Ha.g*255,0,255))*256+Math.round(U(Ha.b*255,0,255))}getHexString(e=ui){return(`000000`+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Ki.workingColorSpace){Ki.workingToColorSpace(Ha.copy(this),t);let n=Ha.r,r=Ha.g,i=Ha.b,a=Math.max(n,r,i),o=Math.min(n,r,i),s,c,l=(o+a)/2;if(o===a)s=0,c=0;else{let e=a-o;switch(c=l<=.5?e/(a+o):e/(2-a-o),a){case n:s=(r-i)/e+(r<i?6:0);break;case r:s=(i-n)/e+2;break;case i:s=(n-r)/e+4}s/=6}return e.h=s,e.s=c,e.l=l,e}getRGB(e,t=Ki.workingColorSpace){return Ki.workingToColorSpace(Ha.copy(this),t),e.r=Ha.r,e.g=Ha.g,e.b=Ha.b,e}getStyle(e=ui){Ki.workingToColorSpace(Ha.copy(this),e);let t=Ha.r,n=Ha.g,r=Ha.b;return e===`srgb`?`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(r*255)})`:`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${r.toFixed(3)})`}offsetHSL(e,t,n){return this.getHSL(za),this.setHSL(za.h+e,za.s+t,za.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(za),e.getHSL(Ba);let n=Pi(za.h,Ba.h,t),r=Pi(za.s,Ba.s,t),i=Pi(za.l,Ba.l,t);return this.setHSL(n,r,i),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,r=this.b,i=e.elements;return this.r=i[0]*t+i[3]*n+i[6]*r,this.g=i[1]*t+i[4]*n+i[7]*r,this.b=i[2]*t+i[5]*n+i[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Ha=new J;J.NAMES=Ra;var Ua=class e{constructor(e,t=1,n=1e3){this.isFog=!0,this.name=``,this.color=new J(e),this.near=t,this.far=n}clone(){return new e(this.color,this.near,this.far)}toJSON(){return{type:`Fog`,name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}},Wa=class extends Pa{constructor(){super(),this.isScene=!0,this.type=`Scene`,this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new _a,this.environmentIntensity=1,this.environmentRotation=new _a,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}copy(e,t){return super.copy(e,t),this.background=e.background===null?null:e.background.clone(),this.environment=e.environment===null?null:e.environment.clone(),this.fog=e.fog===null?null:e.fog.clone(),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),this.overrideMaterial=e.overrideMaterial===null?null:e.overrideMaterial.clone(),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),t.object.backgroundBlurriness=this.backgroundBlurriness,t.object.backgroundIntensity=this.backgroundIntensity,t.object.backgroundRotation=this.backgroundRotation.toArray(),t.object.environmentIntensity=this.environmentIntensity,t.object.environmentRotation=this.environmentRotation.toArray(),t}},Ga=new G,Ka=new G,qa=new G,Ja=new G,Ya=new G,Xa=new G,Za=new G,Qa=new G,$a=new G,eo=new G,to=new ra,no=new ra,ro=new ra,io=class e{constructor(e=new G,t=new G,n=new G){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,r){r.subVectors(n,t),Ga.subVectors(e,t),r.cross(Ga);let i=r.lengthSq();return i>0?r.multiplyScalar(1/Math.sqrt(i)):r.set(0,0,0)}static getBarycoord(e,t,n,r,i){Ga.subVectors(r,t),Ka.subVectors(n,t),qa.subVectors(e,t);let a=Ga.dot(Ga),o=Ga.dot(Ka),s=Ga.dot(qa),c=Ka.dot(Ka),l=Ka.dot(qa),u=a*c-o*o;if(u===0)return i.set(0,0,0),null;let d=1/u,f=(c*s-o*l)*d,p=(a*l-o*s)*d;return i.set(1-f-p,p,f)}static containsPoint(e,t,n,r){return this.getBarycoord(e,t,n,r,Ja)!==null&&Ja.x>=0&&Ja.y>=0&&Ja.x+Ja.y<=1}static getInterpolation(e,t,n,r,i,a,o,s){return this.getBarycoord(e,t,n,r,Ja)===null?(s.x=0,s.y=0,`z`in s&&(s.z=0),`w`in s&&(s.w=0),null):(s.setScalar(0),s.addScaledVector(i,Ja.x),s.addScaledVector(a,Ja.y),s.addScaledVector(o,Ja.z),s)}static getInterpolatedAttribute(e,t,n,r,i,a){return to.setScalar(0),no.setScalar(0),ro.setScalar(0),to.fromBufferAttribute(e,t),no.fromBufferAttribute(e,n),ro.fromBufferAttribute(e,r),a.setScalar(0),a.addScaledVector(to,i.x),a.addScaledVector(no,i.y),a.addScaledVector(ro,i.z),a}static isFrontFacing(e,t,n,r){return Ga.subVectors(n,t),Ka.subVectors(e,t),Ga.cross(Ka).dot(r)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,r){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,n,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Ga.subVectors(this.c,this.b),Ka.subVectors(this.a,this.b),Ga.cross(Ka).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return e.getNormal(this.a,this.b,this.c,t)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,n){return e.getBarycoord(t,this.a,this.b,this.c,n)}getInterpolation(t,n,r,i,a){return e.getInterpolation(t,this.a,this.b,this.c,n,r,i,a)}containsPoint(t){return e.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return e.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,r=this.b,i=this.c,a,o;Ya.subVectors(r,n),Xa.subVectors(i,n),Qa.subVectors(e,n);let s=Ya.dot(Qa),c=Xa.dot(Qa);if(s<=0&&c<=0)return t.copy(n);$a.subVectors(e,r);let l=Ya.dot($a),u=Xa.dot($a);if(l>=0&&u<=l)return t.copy(r);let d=s*u-l*c;if(d<=0&&s>=0&&l<=0&&s-l>0)return a=s/(s-l),t.copy(n).addScaledVector(Ya,a);eo.subVectors(e,i);let f=Ya.dot(eo),p=Xa.dot(eo);if(p>=0&&f<=p)return t.copy(i);let m=f*c-s*p;if(m<=0&&c>=0&&p<=0)return o=c/(c-p),t.copy(n).addScaledVector(Xa,o);let h=l*p-f*u;if(h<=0&&u-l>=0&&f-p>=0)return Za.subVectors(i,r),o=(u-l)/(u-l+(f-p)),t.copy(r).addScaledVector(Za,o);let g=1/(h+m+d);return a=m*g,o=d*g,t.copy(n).addScaledVector(Ya,a).addScaledVector(Xa,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},ao=class{constructor(e=new G(1/0,1/0,1/0),t=new G(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(so.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(so.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=so.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let r=n.getAttribute(`position`);if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0&&e.isBatchedMesh!==!0)for(let t=0,n=r.count;t<n;t++)e.isMesh===!0?e.getVertexPosition(t,so):so.fromBufferAttribute(r,t),so.applyMatrix4(e.matrixWorld),this.expandByPoint(so);else e.boundingBox===void 0?(n.boundingBox===null&&n.computeBoundingBox(),co.copy(n.boundingBox)):(e.boundingBox===null&&e.computeBoundingBox(),co.copy(e.boundingBox)),co.applyMatrix4(e.matrixWorld),this.union(co)}let r=e.children;for(let e=0,n=r.length;e<n;e++)this.expandByObject(r[e],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,so),so.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(go),_o.subVectors(this.max,go),lo.subVectors(e.a,go),uo.subVectors(e.b,go),fo.subVectors(e.c,go),po.subVectors(uo,lo),mo.subVectors(fo,uo),ho.subVectors(lo,fo);let t=[0,-po.z,po.y,0,-mo.z,mo.y,0,-ho.z,ho.y,po.z,0,-po.x,mo.z,0,-mo.x,ho.z,0,-ho.x,-po.y,po.x,0,-mo.y,mo.x,0,-ho.y,ho.x,0];return!bo(t,lo,uo,fo,_o)||(t=[1,0,0,0,1,0,0,0,1],!bo(t,lo,uo,fo,_o))?!1:(vo.crossVectors(po,mo),t=[vo.x,vo.y,vo.z],bo(t,lo,uo,fo,_o))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,so).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(so).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()||(oo[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),oo[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),oo[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),oo[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),oo[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),oo[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),oo[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),oo[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(oo)),this}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},oo=[new G,new G,new G,new G,new G,new G,new G,new G],so=new G,co=new ao,lo=new G,uo=new G,fo=new G,po=new G,mo=new G,ho=new G,go=new G,_o=new G,vo=new G,yo=new G;function bo(e,t,n,r,i){for(let a=0,o=e.length-3;a<=o;a+=3){yo.fromArray(e,a);let o=i.x*Math.abs(yo.x)+i.y*Math.abs(yo.y)+i.z*Math.abs(yo.z),s=t.dot(yo),c=n.dot(yo),l=r.dot(yo);if(Math.max(-Math.max(s,c,l),Math.min(s,c,l))>o)return!1}return!0}var xo=new G,So=new W,Co=0,wo=class extends Oi{constructor(e,t,n=!1){if(super(),Array.isArray(e))throw TypeError(`THREE.BufferAttribute: array should be a Typed Array.`);this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Co++}),this.name=``,this.array=e,this.itemSize=t,this.count=e===void 0?0:e.length/t,this.normalized=n,this.usage=hi,this.updateRanges=[],this.gpuType=rr,this.version=0,this._normalizationScale=e===void 0?void 0:Ii(e)}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this._normalizationScale=e._normalizationScale,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let r=0,i=this.itemSize;r<i;r++)this.array[e+r]=t.array[n+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)So.fromBufferAttribute(this,t),So.applyMatrix3(e),this.setXY(t,So.x,So.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)xo.fromBufferAttribute(this,t),xo.applyMatrix3(e),this.setXYZ(t,xo.x,xo.y,xo.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)xo.fromBufferAttribute(this,t),xo.applyMatrix4(e),this.setXYZ(t,xo.x,xo.y,xo.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)xo.fromBufferAttribute(this,t),xo.applyNormalMatrix(e),this.setXYZ(t,xo.x,xo.y,xo.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)xo.fromBufferAttribute(this,t),xo.transformDirection(e),this.setXYZ(t,xo.x,xo.y,xo.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=this._denormalize(n)),n}setComponent(e,t,n){return this.normalized&&(n=this._normalize(n)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=this._denormalize(t)),t}setX(e,t){return this.normalized&&(t=this._normalize(t)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=this._denormalize(t)),t}setY(e,t){return this.normalized&&(t=this._normalize(t)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=this._denormalize(t)),t}setZ(e,t){return this.normalized&&(t=this._normalize(t)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=this._denormalize(t)),t}setW(e,t){return this.normalized&&(t=this._normalize(t)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=this._normalize(t),n=this._normalize(n)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,r){return e*=this.itemSize,this.normalized&&(t=this._normalize(t),n=this._normalize(n),r=this._normalize(r)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this}setXYZW(e,t,n,r,i){return e*=this.itemSize,this.normalized&&(t=this._normalize(t),n=this._normalize(n),r=this._normalize(r),i=this._normalize(i)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this.array[e+3]=i,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return e.name=this.name,e.usage=this.usage,e.gpuType=this.gpuType,e}dispose(){this.dispatchEvent({type:`dispose`})}_denormalize(e){let t=this._normalizationScale;return t===void 0?Li(e,this.array):Math.max(e/t,-1)}_normalize(e){let t=this._normalizationScale;return t===void 0?Ri(e,this.array):Math.round(e*t)}},To=class extends wo{constructor(e,t,n){super(new Uint16Array(e),t,n)}},Eo=class extends wo{constructor(e,t,n){super(new Uint32Array(e),t,n)}},Y=class extends wo{constructor(e,t,n){super(new Float32Array(e),t,n)}},Do=new ao,Oo=new G,ko=new G,Ao=class{constructor(e=new G,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t===void 0?Do.setFromPoints(e).getCenter(n):n.copy(t);let r=0;for(let t=0,i=e.length;t<i;t++)r=Math.max(r,n.distanceToSquared(e[t]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius*=e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Oo.subVectors(e,this.center);let t=Oo.lengthSq();if(t>this.radius*this.radius){let e=Math.sqrt(t),n=(e-this.radius)*.5;this.center.addScaledVector(Oo,n/e),this.radius+=n}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(ko.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Oo.copy(e.center).add(ko)),this.expandByPoint(Oo.copy(e.center).sub(ko))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},jo=0,Mo=new q,No=new Pa,Po=new G,Fo=new ao,Io=new ao,Lo=new G,Ro=class e extends Oi{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:jo++}),this.uuid=Mi(),this.name=``,this.type=`BufferGeometry`,this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return this.index=Array.isArray(e)?new(vi(e)?Eo:To)(e,1):e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let t=new K().getNormalMatrix(e);n.applyNormalMatrix(t),n.needsUpdate=!0}let r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return Mo.makeRotationFromQuaternion(e),this.applyMatrix4(Mo),this}rotateX(e){return Mo.makeRotationX(e),this.applyMatrix4(Mo),this}rotateY(e){return Mo.makeRotationY(e),this.applyMatrix4(Mo),this}rotateZ(e){return Mo.makeRotationZ(e),this.applyMatrix4(Mo),this}translate(e,t,n){return Mo.makeTranslation(e,t,n),this.applyMatrix4(Mo),this}scale(e,t,n){return Mo.makeScale(e,t,n),this.applyMatrix4(Mo),this}lookAt(e){return No.lookAt(e),No.updateMatrix(),this.applyMatrix4(No.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Po).negate(),this.translate(Po.x,Po.y,Po.z),this}setFromPoints(e){let t=this.getAttribute(`position`);if(t===void 0){let t=[];for(let n=0,r=e.length;n<r;n++){let r=e[n];t.push(r.x,r.y,r.z||0)}this.setAttribute(`position`,new Y(t,3))}else{let n=Math.min(e.length,t.count);for(let r=0;r<n;r++){let n=e[r];t.setXYZ(r,n.x,n.y,n.z||0)}e.length>t.count&&V(`BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry.`),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new ao);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute)H(`BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.`,this),this.boundingBox.set(new G(-1/0,-1/0,-1/0),new G(1/0,1/0,1/0));else{if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let e=0,n=t.length;e<n;e++){let n=t[e];Fo.setFromBufferAttribute(n),this.morphTargetsRelative?(Lo.addVectors(this.boundingBox.min,Fo.min),this.boundingBox.expandByPoint(Lo),Lo.addVectors(this.boundingBox.max,Fo.max),this.boundingBox.expandByPoint(Lo)):(this.boundingBox.expandByPoint(Fo.min),this.boundingBox.expandByPoint(Fo.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&H(`BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.`,this)}}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Ao);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute)H(`BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.`,this),this.boundingSphere.set(new G,1/0);else if(e){let n=this.boundingSphere.center;if(Fo.setFromBufferAttribute(e),t)for(let e=0,n=t.length;e<n;e++){let n=t[e];Io.setFromBufferAttribute(n),this.morphTargetsRelative?(Lo.addVectors(Fo.min,Io.min),Fo.expandByPoint(Lo),Lo.addVectors(Fo.max,Io.max),Fo.expandByPoint(Lo)):(Fo.expandByPoint(Io.min),Fo.expandByPoint(Io.max))}Fo.getCenter(n);let r=0;for(let t=0,i=e.count;t<i;t++)Lo.fromBufferAttribute(e,t),r=Math.max(r,n.distanceToSquared(Lo));if(t)for(let i=0,a=t.length;i<a;i++){let a=t[i],o=this.morphTargetsRelative;for(let t=0,i=a.count;t<i;t++)Lo.fromBufferAttribute(a,t),o&&(Po.fromBufferAttribute(e,t),Lo.add(Po)),r=Math.max(r,n.distanceToSquared(Lo))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&H(`BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.`,this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){H(`BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)`);return}let n=t.position,r=t.normal,i=t.uv,a=this.getAttribute(`tangent`);(a===void 0||a.count!==n.count)&&(a=new wo(new Float32Array(4*n.count),4),this.setAttribute(`tangent`,a));let o=[],s=[],c=new Uint8Array(n.count);for(let e=0;e<n.count;e++)o[e]=new G,s[e]=new G;let l=new G,u=new G,d=new G,f=new W,p=new W,m=new W,h=new G,g=new G;function _(e,t,r){c[e]=c[t]=c[r]=1,l.fromBufferAttribute(n,e),u.fromBufferAttribute(n,t),d.fromBufferAttribute(n,r),f.fromBufferAttribute(i,e),p.fromBufferAttribute(i,t),m.fromBufferAttribute(i,r),u.sub(l),d.sub(l),p.sub(f),m.sub(f);let a=1/(p.x*m.y-m.x*p.y);isFinite(a)&&(h.copy(u).multiplyScalar(m.y).addScaledVector(d,-p.y).multiplyScalar(a),g.copy(d).multiplyScalar(p.x).addScaledVector(u,-m.x).multiplyScalar(a),o[e].add(h),o[t].add(h),o[r].add(h),s[e].add(g),s[t].add(g),s[r].add(g))}let v=this.groups;v.length===0&&(v=[{start:0,count:e.count}]);for(let t=0,n=v.length;t<n;++t){let n=v[t],r=n.start,i=n.count;for(let t=r,n=r+i;t<n;t+=3)_(e.getX(t+0),e.getX(t+1),e.getX(t+2))}let y=new G,b=new G,x=new G,S=new G;function C(e){x.fromBufferAttribute(r,e),S.copy(x);let t=o[e];y.copy(t),y.sub(x.multiplyScalar(x.dot(t))).normalize(),b.crossVectors(S,t);let n=b.dot(s[e])<0?-1:1;a.setXYZW(e,y.x,y.y,y.z,n)}for(let e=0,t=n.count;e<t;++e)c[e]&&C(e);this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute(`position`);if(t!==void 0){let n=this.getAttribute(`normal`);if(n===void 0||n.count!==t.count)n=new wo(new Float32Array(t.count*3),3),this.setAttribute(`normal`,n);else for(let e=0,t=n.count;e<t;e++)n.setXYZ(e,0,0,0);let r=new G,i=new G,a=new G,o=new G,s=new G,c=new G,l=new G,u=new G;if(e)for(let d=0,f=e.count;d<f;d+=3){let f=e.getX(d+0),p=e.getX(d+1),m=e.getX(d+2);r.fromBufferAttribute(t,f),i.fromBufferAttribute(t,p),a.fromBufferAttribute(t,m),l.subVectors(a,i),u.subVectors(r,i),l.cross(u),o.fromBufferAttribute(n,f),s.fromBufferAttribute(n,p),c.fromBufferAttribute(n,m),o.add(l),s.add(l),c.add(l),n.setXYZ(f,o.x,o.y,o.z),n.setXYZ(p,s.x,s.y,s.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let e=0,o=t.count;e<o;e+=3)r.fromBufferAttribute(t,e+0),i.fromBufferAttribute(t,e+1),a.fromBufferAttribute(t,e+2),l.subVectors(a,i),u.subVectors(r,i),l.cross(u),n.setXYZ(e+0,l.x,l.y,l.z),n.setXYZ(e+1,l.x,l.y,l.z),n.setXYZ(e+2,l.x,l.y,l.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Lo.fromBufferAttribute(e,t),Lo.normalize(),e.setXYZ(t,Lo.x,Lo.y,Lo.z)}toNonIndexed(){function t(e,t){let n=e.array,r=e.itemSize,i=e.normalized,a=new n.constructor(t.length*r),o=0,s=0;for(let i=0,c=t.length;i<c;i++){o=e.isInterleavedBufferAttribute?t[i]*e.data.stride+e.offset:t[i]*r;for(let e=0;e<r;e++)a[s++]=n[o++]}return new wo(a,r,i)}if(this.index===null)return V(`BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed.`),this;let n=new e,r=this.index.array,i=this.attributes;for(let e in i){let a=i[e],o=t(a,r);n.setAttribute(e,o)}let a=this.morphAttributes;for(let e in a){let i=[],o=a[e];for(let e=0,n=o.length;e<n;e++){let n=o[e],a=t(n,r);i.push(a)}n.morphAttributes[e]=i}n.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let e=0,t=o.length;e<t;e++){let t=o[e];n.addGroup(t.start,t.count,t.materialIndex)}return n}toJSON(){let e={metadata:{version:4.7,type:`BufferGeometry`,generator:`BufferGeometry.toJSON`}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?`BufferGeometry`:this.type,e.name=this.name,Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let t=this.parameters;for(let n in t)t[n]!==void 0&&(e[n]=t[n]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let t in n){let r=n[t];e.data.attributes[t]=r.toJSON(e.data)}let r={},i=!1;for(let t in this.morphAttributes){let n=this.morphAttributes[t],a=[];for(let t=0,r=n.length;t<r;t++){let r=n[t];a.push(r.toJSON(e.data))}a.length>0&&(r[t]=a,i=!0)}i&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);let a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));let o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone());let r=e.attributes;for(let e in r){let n=r[e];this.setAttribute(e,n.clone(t))}let i=e.morphAttributes;for(let e in i){let n=[],r=i[e];for(let e=0,i=r.length;e<i;e++)n.push(r[e].clone(t));this.morphAttributes[e]=n}this.morphTargetsRelative=e.morphTargetsRelative;let a=e.groups;for(let e=0,t=a.length;e<t;e++){let t=a[e];this.addGroup(t.start,t.count,t.materialIndex)}let o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());let s=e.boundingSphere;return s!==null&&(this.boundingSphere=s.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:`dispose`})}},zo=class{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e===void 0?0:e.length/t,this.usage=hi,this.updateRanges=[],this.version=0,this.uuid=Mi()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let r=0,i=this.stride;r<i;r++)this.array[e+r]=t.array[n+r];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={});let t=Bo(this.array);e.arrayBuffers[t]===void 0&&(e.arrayBuffers[t]=this.array.slice(0).buffer);let n=new this.array.constructor(e.arrayBuffers[t]),r=new this.constructor(n,this.stride);return r.setUsage(this.usage),r}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){e.arrayBuffers===void 0&&(e.arrayBuffers={});let t=Bo(this.array);e.arrayBuffers[t]===void 0&&(e.arrayBuffers[t]=Array.from(new Uint32Array(this.array.slice(0).buffer)));let n={uuid:this.uuid,buffer:t,type:this.array.constructor.name,stride:this.stride};return n.usage=this.usage,n}};function Bo(e){return e.buffer._uuid===void 0&&(e.buffer._uuid=Mi()),e.byteOffset===0&&e.byteLength===e.buffer.byteLength?e.buffer._uuid:e.buffer._uuid+`:`+e.byteOffset+`:`+e.byteLength}var Vo=new G,Ho=class e{constructor(e,t,n,r=!1){this.isInterleavedBufferAttribute=!0,this.name=``,this.data=e,this.itemSize=t,this.offset=n,this.normalized=r,this._normalizationScale=e===void 0?void 0:Ii(e.array)}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,n=this.data.count;t<n;t++)Vo.fromBufferAttribute(this,t),Vo.applyMatrix4(e),this.setXYZ(t,Vo.x,Vo.y,Vo.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Vo.fromBufferAttribute(this,t),Vo.applyNormalMatrix(e),this.setXYZ(t,Vo.x,Vo.y,Vo.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Vo.fromBufferAttribute(this,t),Vo.transformDirection(e),this.setXYZ(t,Vo.x,Vo.y,Vo.z);return this}getComponent(e,t){let n=this.array[e*this.data.stride+this.offset+t];return this.normalized&&(n=this._denormalize(n)),n}setComponent(e,t,n){return this.normalized&&(n=this._normalize(n)),this.data.array[e*this.data.stride+this.offset+t]=n,this}setX(e,t){return this.normalized&&(t=this._normalize(t)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=this._normalize(t)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=this._normalize(t)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=this._normalize(t)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=this._denormalize(t)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=this._denormalize(t)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=this._denormalize(t)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=this._denormalize(t)),t}setXY(e,t,n){return e=e*this.data.stride+this.offset,this.normalized&&(t=this._normalize(t),n=this._normalize(n)),this.data.array[e+0]=t,this.data.array[e+1]=n,this}setXYZ(e,t,n,r){return e=e*this.data.stride+this.offset,this.normalized&&(t=this._normalize(t),n=this._normalize(n),r=this._normalize(r)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=r,this}setXYZW(e,t,n,r,i){return e=e*this.data.stride+this.offset,this.normalized&&(t=this._normalize(t),n=this._normalize(n),r=this._normalize(r),i=this._normalize(i)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=r,this.data.array[e+3]=i,this}clone(t){if(t===void 0){Ci(`InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.`);let e=[];for(let t=0;t<this.count;t++){let n=t*this.data.stride+this.offset;for(let t=0;t<this.itemSize;t++)e.push(this.data.array[n+t])}return new wo(new this.array.constructor(e),this.itemSize,this.normalized)}return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.clone(t)),new e(t.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){Ci(`InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.`);let e=[];for(let t=0;t<this.count;t++){let n=t*this.data.stride+this.offset;for(let t=0;t<this.itemSize;t++)e.push(this.data.array[n+t])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:e,normalized:this.normalized}}return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}_denormalize(e){let t=this._normalizationScale;return t===void 0?Li(e,this.data.array):Math.max(e/t,-1)}_normalize(e){let t=this._normalizationScale;return t===void 0?Ri(e,this.data.array):Math.round(e*t)}},Uo=new G,Wo=new G,Go=new K,Ko=class{constructor(e=new G(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,r){return this.normal.set(e,t,n),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let r=Uo.subVectors(n,t).cross(Wo.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){let r=e.delta(Uo),i=this.normal.dot(r);if(i===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let a=-(e.start.dot(this.normal)+this.constant)/i;return n===!0&&(a<0||a>1)?null:t.copy(e.start).addScaledVector(r,a)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||Go.getNormalMatrix(e),r=this.coplanarPoint(Uo).applyMatrix4(e),i=this.normal.applyMatrix3(n).normalize();return this.constant=-r.dot(i),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(e){return this.normal.fromArray(e.normal),this.constant=e.constant,this}},qo=0,Jo=class extends Oi{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:qo++}),this.uuid=Mi(),this.name=``,this.type=`Material`,this.blending=1,this.side=0,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=204,this.blendDst=205,this.blendEquation=100,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new J(0,0,0),this.blendAlpha=0,this.depthFunc=3,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=519,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=mi,this.stencilZFail=mi,this.stencilZPass=mi,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let n=e[t];if(n===void 0){V(`Material: parameter '${t}' has value of undefined.`);continue}let r=this[t];r===void 0?V(`Material: '${t}' is not a property of THREE.${this.type}.`):r&&r.isColor?r.set(n):r&&r.isVector2&&n&&n.isVector2||r&&r.isEuler&&n&&n.isEuler||r&&r.isVector3&&n&&n.isVector3?r.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e==`string`;t&&(e={textures:{},images:{}});let n={metadata:{version:4.7,type:`Material`,generator:`Material.toJSON`}};n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.diffuseRoughness!==void 0&&(n.diffuseRoughness=this.diffuseRoughness),this.diffuseRoughnessMap&&this.diffuseRoughnessMap.isTexture&&(n.diffuseRoughnessMap=this.diffuseRoughnessMap.toJSON(e).uuid),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(n.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessMinimum!==void 0&&(n.iridescenceThicknessMinimum=this.iridescenceThicknessMinimum),this.iridescenceThicknessMaximum!==void 0&&(n.iridescenceThicknessMaximum=this.iridescenceThicknessMaximum),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(n.clippingPlanes=this.clippingPlanes.map(e=>e.toJSON())),this.rotation!==void 0&&(n.rotation=this.rotation),this.depthPacking!==void 0&&(n.depthPacking=this.depthPacking),this.linewidth!==void 0&&(n.linewidth=this.linewidth),this.linecap!==void 0&&(n.linecap=this.linecap),this.linejoin!==void 0&&(n.linejoin=this.linejoin),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.wireframe!==void 0&&(n.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(n.flatShading=this.flatShading),this.fog!==void 0&&(n.fog=this.fog),Object.keys(this.userData).length>0&&(n.userData=this.userData);function r(e){let t=[];for(let n in e){let r=e[n];delete r.metadata,t.push(r)}return t}if(t){let t=r(e.textures),i=r(e.images);t.length>0&&(n.textures=t),i.length>0&&(n.images=i)}return n}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new J().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.diffuseRoughness!==void 0&&(this.diffuseRoughness=e.diffuseRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.retroreflectivity!==void 0&&(this.retroreflectivity=e.retroreflectivity),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessMinimum!==void 0&&(this.iridescenceThicknessMinimum=e.iridescenceThicknessMinimum),e.iridescenceThicknessMaximum!==void 0&&(this.iridescenceThicknessMaximum=e.iridescenceThicknessMaximum),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessMinimum=e.iridescenceThicknessRange[0],this.iridescenceThicknessMaximum=e.iridescenceThicknessRange[1]),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.clippingPlanes!==void 0&&(this.clippingPlanes=e.clippingPlanes.map(e=>new Ko().fromJSON(e))),e.clipIntersection!==void 0&&(this.clipIntersection=e.clipIntersection),e.clipShadows!==void 0&&(this.clipShadows=e.clipShadows),e.depthPacking!==void 0&&(this.depthPacking=e.depthPacking),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.linecap!==void 0&&(this.linecap=e.linecap),e.linejoin!==void 0&&(this.linejoin=e.linejoin),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(this.vertexColors=typeof e.vertexColors==`number`?e.vertexColors>0:e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let t=e.normalScale;Array.isArray(t)===!1&&(t=[t,t]),this.normalScale=new W().fromArray(t)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new W().fromArray(e.clearcoatNormalScale)),e.diffuseRoughnessMap!==void 0&&(this.diffuseRoughnessMap=t[e.diffuseRoughnessMap]||null),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let e=t.length;n=Array(e);for(let r=0;r!==e;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:`dispose`})}set needsUpdate(e){e===!0&&this.version++}},Yo=class extends Jo{constructor(e){super(),this.isSpriteMaterial=!0,this.type=`SpriteMaterial`,this.color=new J(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.rotation=e.rotation,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},Xo,Zo=new G,Qo=new G,$o=new G,es=new W,ts=new W,ns=new q,rs=new G,is=new G,as=new G,os=new W,ss=new W,cs=new W,ls=class extends Pa{constructor(e=new Yo){if(super(),this.isSprite=!0,this.type=`Sprite`,Xo===void 0){Xo=new Ro;let e=new zo(new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),5);Xo.setIndex([0,1,2,0,2,3]),Xo.setAttribute(`position`,new Ho(e,3,0,!1)),Xo.setAttribute(`uv`,new Ho(e,2,3,!1))}this.geometry=Xo,this.material=e,this.center=new W(.5,.5),this.count=1}intersectsFrustum(e){return e.intersectsSprite(this)}raycast(e,t){e.camera===null&&H(`Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.`),Qo.setFromMatrixScale(this.matrixWorld),ns.copy(e.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(e.camera.matrixWorldInverse,this.matrixWorld),$o.setFromMatrixPosition(this.modelViewMatrix),e.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&Qo.multiplyScalar(-$o.z);let n=this.material.rotation,r,i;n!==0&&(i=Math.cos(n),r=Math.sin(n));let a=this.center;us(rs.set(-.5,-.5,0),$o,a,Qo,r,i),us(is.set(.5,-.5,0),$o,a,Qo,r,i),us(as.set(.5,.5,0),$o,a,Qo,r,i),os.set(0,0),ss.set(1,0),cs.set(1,1);let o=e.ray.intersectTriangle(rs,is,as,!1,Zo);if(o===null&&(us(is.set(-.5,.5,0),$o,a,Qo,r,i),ss.set(0,1),o=e.ray.intersectTriangle(rs,as,is,!1,Zo),o===null))return;let s=e.ray.origin.distanceTo(Zo);s<e.near||s>e.far||t.push({distance:s,point:Zo.clone(),uv:io.getInterpolation(Zo,rs,is,as,os,ss,cs,new W),face:null,object:this})}copy(e,t){return super.copy(e,t),e.center!==void 0&&this.center.copy(e.center),this.material=e.material,this}toJSON(e){let t=super.toJSON(e);return t.object.center=this.center.toArray(),t}};function us(e,t,n,r,i,a){es.subVectors(e,n).addScalar(.5).multiply(r),i===void 0?ts.copy(es):(ts.x=a*es.x-i*es.y,ts.y=i*es.x+a*es.y),e.copy(t),e.x+=ts.x,e.y+=ts.y,e.applyMatrix4(ns)}var ds=new G,fs=new G,ps=new G,ms=new G,hs=class{constructor(e=new G,t=new G(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,ds)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=ds.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(ds.copy(this.origin).addScaledVector(this.direction,t),ds.distanceToSquared(e))}distanceSqToSegment(e,t,n,r){fs.copy(e).add(t).multiplyScalar(.5),ps.copy(t).sub(e).normalize(),ms.copy(this.origin).sub(fs);let i=e.distanceTo(t)*.5,a=-this.direction.dot(ps),o=ms.dot(this.direction),s=-ms.dot(ps),c=ms.lengthSq(),l=Math.abs(1-a*a),u,d,f,p;if(l>0){if(u=a*s-o,d=a*o-s,p=i*l,u>=0){if(d>=-p){if(d<=p){let e=1/l;u*=e,d*=e,f=u*(u+a*d+2*o)+d*(a*u+d+2*s)+c}else d=i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c}else d=-i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c}else d<=-p?(u=Math.max(0,-(-a*i+o)),d=u>0?-i:Math.min(Math.max(-i,-s),i),f=-u*u+d*(d+2*s)+c):d<=p?(u=0,d=Math.min(Math.max(-i,-s),i),f=d*(d+2*s)+c):(u=Math.max(0,-(a*i+o)),d=u>0?i:Math.min(Math.max(-i,-s),i),f=-u*u+d*(d+2*s)+c)}else d=a>0?-i:i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),r&&r.copy(fs).addScaledVector(ps,d),f}intersectSphere(e,t){if(e.radius<0)return null;ds.subVectors(e.center,this.origin);let n=ds.dot(this.direction),r=ds.dot(ds)-n*n,i=e.radius*e.radius;if(r>i)return null;let a=Math.sqrt(i-r),o=n-a,s=n+a;return s<0?null:o<0?this.at(s,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,r,i,a,o,s,c=1/this.direction.x,l=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(n=(e.min.x-d.x)*c,r=(e.max.x-d.x)*c):(n=(e.max.x-d.x)*c,r=(e.min.x-d.x)*c),l>=0?(i=(e.min.y-d.y)*l,a=(e.max.y-d.y)*l):(i=(e.max.y-d.y)*l,a=(e.min.y-d.y)*l),n>a||i>r||((i>n||isNaN(n))&&(n=i),(a<r||isNaN(r))&&(r=a),u>=0?(o=(e.min.z-d.z)*u,s=(e.max.z-d.z)*u):(o=(e.max.z-d.z)*u,s=(e.min.z-d.z)*u),n>s||o>r)||((o>n||n!==n)&&(n=o),(s<r||r!==r)&&(r=s),r<0)?null:this.at(n>=0?n:r,t)}intersectsBox(e){return this.intersectBox(e,ds)!==null}intersectTriangle(e,t,n,r,i){let a=this.origin,o=this.direction,s=o.x,c=o.y,l=o.z,u=e.x-a.x,d=e.y-a.y,f=e.z-a.z,p=t.x-a.x,m=t.y-a.y,h=t.z-a.z,g=n.x-a.x,_=n.y-a.y,v=n.z-a.z,y=Math.abs(s),b=Math.abs(c),x=Math.abs(l),S,C,w,T,E,D,O,k,A,j,ee,M;if(y>=b&&y>=x?(w=s,D=u,A=p,M=g,s>=0?(S=c,C=l,T=d,E=f,O=m,k=h,j=_,ee=v):(S=l,C=c,T=f,E=d,O=h,k=m,j=v,ee=_)):b>=x?(w=c,D=d,A=m,M=_,c>=0?(S=l,C=s,T=f,E=u,O=h,k=p,j=v,ee=g):(S=s,C=l,T=u,E=f,O=p,k=h,j=g,ee=v)):(w=l,D=f,A=h,M=v,l>=0?(S=s,C=c,T=u,E=d,O=p,k=m,j=g,ee=_):(S=c,C=s,T=d,E=u,O=m,k=p,j=_,ee=g)),w===0)return null;let N=S/w,P=C/w,F=1/w,te=T-N*D,ne=E-P*D,re=O-N*A,ie=k-P*A,ae=j-N*M,oe=ee-P*M,se=ae*ie-oe*re,ce=te*oe-ne*ae,le=re*ne-ie*te;if(r){if(se<0||ce<0||le<0)return null}else if((se<0||ce<0||le<0)&&(se>0||ce>0||le>0))return null;let ue=se+ce+le;if(ue===0)return null;let I=F*(se*D+ce*A+le*M);return(ue>0?I<0:I>0)?null:this.at(I/ue,i)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},gs=class extends Jo{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type=`MeshBasicMaterial`,this.color=new J(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new _a,this.combine=0,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap=`round`,this.wireframeLinejoin=`round`,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},_s=new q,vs=new hs,ys=new Ao,bs=new G,xs=new G,Ss=new G,Cs=new G,ws=new G,Ts=new G,Es=new G,Ds=new G,Os=class extends Pa{constructor(e=new Ro,t=new gs){super(),this.isMesh=!0,this.type=`Mesh`,this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.morphTargetInfluences=e.morphTargetInfluences===void 0?void 0:e.morphTargetInfluences.slice(),this.morphTargetDictionary=e.morphTargetDictionary===void 0?void 0:Object.assign({},e.morphTargetDictionary),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let e=0,t=n.length;e<t;e++){let t=n[e].name||String(e);this.morphTargetInfluences.push(0),this.morphTargetDictionary[t]=e}}}}getVertexPosition(e,t){let n=this.geometry,r=n.attributes.position,i=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(r,e);let o=this.morphTargetInfluences;if(i&&o){Ts.set(0,0,0);for(let n=0,r=i.length;n<r;n++){let r=o[n],s=i[n];r!==0&&(ws.fromBufferAttribute(s,e),a?Ts.addScaledVector(ws,r):Ts.addScaledVector(ws.sub(t),r))}t.add(Ts)}return t}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,r=this.material,i=this.matrixWorld;r!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),ys.copy(n.boundingSphere),ys.applyMatrix4(i),vs.copy(e.ray).recast(e.near),ys.containsPoint(vs.origin)===!1&&(vs.intersectSphere(ys,bs)===null||vs.origin.distanceToSquared(bs)>(e.far-e.near)**2)||(_s.copy(i).invert(),vs.copy(e.ray).applyMatrix4(_s),(n.boundingBox===null||vs.intersectsBox(n.boundingBox)!==!1)&&this._computeIntersections(e,t,vs)))}_computeIntersections(e,t,n){let r,i=this.geometry,a=this.material,o=i.index,s=i.attributes.position,c=i.attributes.uv,l=i.attributes.uv1,u=i.attributes.normal,d=i.groups,f=i.drawRange;if(o!==null){if(Array.isArray(a))for(let i=0,s=d.length;i<s;i++){let s=d[i],p=a[s.materialIndex],m=Math.max(s.start,f.start),h=Math.min(o.count,Math.min(s.start+s.count,f.start+f.count));for(let i=m,a=h;i<a;i+=3){let a=o.getX(i),d=o.getX(i+1),f=o.getX(i+2);r=As(this,p,e,n,c,l,u,a,d,f),r&&(r.faceIndex=Math.floor(i/3),r.face.materialIndex=s.materialIndex,t.push(r))}}else{let i=Math.max(0,f.start),s=Math.min(o.count,f.start+f.count);for(let d=i,f=s;d<f;d+=3){let i=o.getX(d),s=o.getX(d+1),f=o.getX(d+2);r=As(this,a,e,n,c,l,u,i,s,f),r&&(r.faceIndex=Math.floor(d/3),t.push(r))}}}else if(s!==void 0){if(Array.isArray(a))for(let i=0,o=d.length;i<o;i++){let o=d[i],p=a[o.materialIndex],m=Math.max(o.start,f.start),h=Math.min(s.count,Math.min(o.start+o.count,f.start+f.count));for(let i=m,a=h;i<a;i+=3){let a=i,s=i+1,d=i+2;r=As(this,p,e,n,c,l,u,a,s,d),r&&(r.faceIndex=Math.floor(i/3),r.face.materialIndex=o.materialIndex,t.push(r))}}else{let i=Math.max(0,f.start),o=Math.min(s.count,f.start+f.count);for(let s=i,d=o;s<d;s+=3){let i=s,o=s+1,d=s+2;r=As(this,a,e,n,c,l,u,i,o,d),r&&(r.faceIndex=Math.floor(s/3),t.push(r))}}}}};function ks(e,t,n,r,i,a,o,s){let c;if(c=t.side===1?r.intersectTriangle(o,a,i,!0,s):r.intersectTriangle(i,a,o,t.side===0,s),c===null)return null;Ds.copy(s),Ds.applyMatrix4(e.matrixWorld);let l=n.ray.origin.distanceTo(Ds);return l<n.near||l>n.far?null:{distance:l,point:Ds.clone(),object:e}}function As(e,t,n,r,i,a,o,s,c,l){e.getVertexPosition(s,xs),e.getVertexPosition(c,Ss),e.getVertexPosition(l,Cs);let u=ks(e,t,n,r,xs,Ss,Cs,Es);if(u){let e=new G;io.getBarycoord(Es,xs,Ss,Cs,e),i&&(u.uv=io.getInterpolatedAttribute(i,s,c,l,e,new W)),a&&(u.uv1=io.getInterpolatedAttribute(a,s,c,l,e,new W)),o&&(u.normal=io.getInterpolatedAttribute(o,s,c,l,e,new G),u.normal.dot(r.direction)>0&&u.normal.multiplyScalar(-1));let t={a:s,b:c,c:l,normal:new G,materialIndex:0};io.getNormal(xs,Ss,Cs,t.normal),u.face=t,u.barycoord=e}return u}var js=new ra,Ms=new ra,Ns=new ra,Ps=new ra,Fs=new q,Is=new G,Ls=new Ao,Rs=new q,zs=new hs,Bs=class extends Os{constructor(e,t){super(e,t),this.isSkinnedMesh=!0,this.type=`SkinnedMesh`,this.bindMode=Vn,this.bindMatrix=new q,this.bindMatrixInverse=new q,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){let e=this.geometry;this.boundingBox===null&&(this.boundingBox=new ao),this.boundingBox.makeEmpty();let t=e.getAttribute(`position`);for(let e=0;e<t.count;e++)this.getVertexPosition(e,Is),this.boundingBox.expandByPoint(Is)}computeBoundingSphere(){let e=this.geometry;this.boundingSphere===null&&(this.boundingSphere=new Ao),this.boundingSphere.makeEmpty();let t=e.getAttribute(`position`);for(let e=0;e<t.count;e++)this.getVertexPosition(e,Is),this.boundingSphere.expandByPoint(Is)}copy(e,t){return super.copy(e,t),this.bindMode=e.bindMode,this.bindMatrix.copy(e.bindMatrix),this.bindMatrixInverse.copy(e.bindMatrixInverse),this.skeleton=e.skeleton,this.boundingBox=e.boundingBox===null?null:e.boundingBox.clone(),this.boundingSphere=e.boundingSphere===null?null:e.boundingSphere.clone(),this}raycast(e,t){let n=this.material,r=this.matrixWorld;n!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Ls.copy(this.boundingSphere),Ls.applyMatrix4(r),e.ray.intersectsSphere(Ls)!==!1&&(Rs.copy(r).invert(),zs.copy(e.ray).applyMatrix4(Rs),(this.boundingBox===null||zs.intersectsBox(this.boundingBox)!==!1)&&this._computeIntersections(e,t,zs)))}getVertexPosition(e,t){return super.getVertexPosition(e,t),this.applyBoneTransform(e,t),t}bind(e,t){this.skeleton=e,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){let e=new ra,t=this.geometry.attributes.skinWeight;for(let n=0,r=t.count;n<r;n++){e.fromBufferAttribute(t,n);let r=1/e.manhattanLength();r===1/0?e.set(1,0,0,0):e.multiplyScalar(r),t.setXYZW(n,e.x,e.y,e.z,e.w)}}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMode===`attached`?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===`detached`?this.bindMatrixInverse.copy(this.bindMatrix).invert():V(`SkinnedMesh: Unrecognized bindMode: `+this.bindMode)}applyBoneTransform(e,t){let n=this.skeleton,r=this.geometry;Ms.fromBufferAttribute(r.attributes.skinIndex,e),Ns.fromBufferAttribute(r.attributes.skinWeight,e),t.isVector4?(js.copy(t),t.set(0,0,0,0)):(js.set(t.x,t.y,t.z,1),t.set(0,0,0)),js.applyMatrix4(this.bindMatrix);for(let e=0;e<4;e++){let r=Ns.getComponent(e);if(r!==0){let i=Ms.getComponent(e);Fs.multiplyMatrices(n.bones[i].matrixWorld,n.boneInverses[i]),t.addScaledVector(Ps.copy(js).applyMatrix4(Fs),r)}}return t.isVector4&&(t.w=js.w),t.applyMatrix4(this.bindMatrixInverse)}},Vs=class extends Pa{constructor(){super(),this.isBone=!0,this.type=`Bone`}},Hs=class extends na{constructor(e=null,t=1,n=1,r,i,a,o,s,c=Gn,l=Gn,u,d){super(null,a,o,s,c,l,r,i,u,d),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},Us=new q,Ws=new q,Gs=class e{constructor(e=[],t=[]){this.uuid=Mi(),this.bones=e.slice(0),this.boneInverses=t,this.boneMatrices=null,this.previousBoneMatrices=null,this.boneTexture=null,this.previousBoneTexture=null,this.init()}init(){let e=this.bones,t=this.boneInverses;if(this.boneMatrices=new Float32Array(e.length*16),t.length===0)this.calculateInverses();else if(e.length!==t.length){V(`Skeleton: Number of inverse bone matrices does not match amount of bones.`),this.boneInverses=[];for(let e=0,t=this.bones.length;e<t;e++)this.boneInverses.push(new q)}}calculateInverses(){this.boneInverses.length=0;for(let e=0,t=this.bones.length;e<t;e++){let t=new q;this.bones[e]&&t.copy(this.bones[e].matrixWorld).invert(),this.boneInverses.push(t)}}pose(){for(let e=0,t=this.bones.length;e<t;e++){let t=this.bones[e];t&&t.matrixWorld.copy(this.boneInverses[e]).invert()}for(let e=0,t=this.bones.length;e<t;e++){let t=this.bones[e];t&&(t.parent&&t.parent.isBone?(t.matrix.copy(t.parent.matrixWorld).invert(),t.matrix.multiply(t.matrixWorld)):t.matrix.copy(t.matrixWorld),t.matrix.decompose(t.position,t.quaternion,t.scale))}}update(){let e=this.bones,t=this.boneInverses,n=this.boneMatrices,r=this.boneTexture;for(let r=0,i=e.length;r<i;r++){let i=e[r]?e[r].matrixWorld:Ws;Us.multiplyMatrices(i,t[r]),Us.toArray(n,r*16)}r!==null&&(r.needsUpdate=!0)}clone(){return new e(this.bones,this.boneInverses)}computeBoneTexture(){let e=Math.sqrt(this.bones.length*4);e=Math.ceil(e/4)*4,e=Math.max(e,4);let t=new Float32Array(e*e*4);t.set(this.boneMatrices);let n=new Hs(t,e,e,fr,rr);return n.needsUpdate=!0,this.boneMatrices=t,this.boneTexture=n,this}getBoneByName(e){for(let t=0,n=this.bones.length;t<n;t++){let n=this.bones[t];if(n.name===e)return n}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null),this.previousBoneTexture!==null&&(this.previousBoneTexture.dispose(),this.previousBoneTexture=null)}fromJSON(e,t){this.uuid=e.uuid;for(let n=0,r=e.bones.length;n<r;n++){let r=e.bones[n],i=t[r];i===void 0&&(V(`Skeleton: No bone found with UUID:`,r),i=new Vs),this.bones.push(i),this.boneInverses.push(new q().fromArray(e.boneInverses[n]))}return this.init(),this}toJSON(){let e={metadata:{version:4.7,type:`Skeleton`,generator:`Skeleton.toJSON`},bones:[],boneInverses:[]};e.uuid=this.uuid;let t=this.bones,n=this.boneInverses;for(let r=0,i=t.length;r<i;r++){let i=t[r];e.bones.push(i.uuid);let a=n[r];e.boneInverses.push(a.toArray())}return e}},Ks=class extends wo{constructor(e,t,n,r=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=r}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},qs=new q,Js=new q,Ys=[],Xs=new ao,Zs=new q,Qs=new Os,$s=new Ao,ec=class extends Os{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new Ks(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let e=0;e<n;e++)this.setMatrixAt(e,Zs)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new ao),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,qs),Xs.copy(e.boundingBox).applyMatrix4(qs),this.boundingBox.union(Xs)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new Ao),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,qs),$s.copy(e.boundingSphere).applyMatrix4(qs),this.boundingSphere.union($s)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),this.morphTexture=e.morphTexture===null?null:e.morphTexture.clone(),this.instanceColor=e.instanceColor===null?null:e.instanceColor.clone(),this.count=e.count,this.boundingBox=e.boundingBox===null?null:e.boundingBox.clone(),this.boundingSphere=e.boundingSphere===null?null:e.boundingSphere.clone(),this}getColorAt(e,t){return this.instanceColor===null?t.setRGB(1,1,1):t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){return t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){let n=t.morphTargetInfluences,r=this.morphTexture.source.data.data,i=e*(n.length+1)+1;for(let e=0;e<n.length;e++)n[e]=r[i+e]}raycast(e,t){let n=this.matrixWorld,r=this.count;if(Qs.geometry=this.geometry,Qs.material=this.material,Qs.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),$s.copy(this.boundingSphere),$s.applyMatrix4(n),e.ray.intersectsSphere($s)!==!1))for(let i=0;i<r;i++){this.getMatrixAt(i,qs),Js.multiplyMatrices(n,qs),Qs.matrixWorld=Js,Qs.raycast(e,Ys);for(let e=0,n=Ys.length;e<n;e++){let n=Ys[e];n.instanceId=i,n.object=this,t.push(n)}Ys.length=0}}setColorAt(e,t){return this.instanceColor===null&&(this.instanceColor=new Ks(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3),this}setMatrixAt(e,t){return t.toArray(this.instanceMatrix.array,e*16),this}setMorphAt(e,t){let n=t.morphTargetInfluences,r=n.length+1;this.morphTexture===null&&(this.morphTexture=new Hs(new Float32Array(r*this.count),r,this.count,hr,rr));let i=this.morphTexture.source.data.data,a=0;for(let e=0;e<n.length;e++)a+=n[e];let o=this.geometry.morphTargetsRelative?1:1-a,s=r*e;return i[s]=o,i.set(n,s+1),this}updateMorphTargets(){}dispose(){super.dispose(),this.instanceMatrix.dispose(),this.instanceColor!==null&&this.instanceColor.dispose(),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},tc=new Ao,nc=new W(.5,.5),rc=new G,ic=class{constructor(e=new Ko,t=new Ko,n=new Ko,r=new Ko,i=new Ko,a=new Ko){this.planes=[e,t,n,r,i,a]}set(e,t,n,r,i,a){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(r),o[4].copy(i),o[5].copy(a),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=_i,n=!1){let r=this.planes,i=e.elements,a=i[0],o=i[1],s=i[2],c=i[3],l=i[4],u=i[5],d=i[6],f=i[7],p=i[8],m=i[9],h=i[10],g=i[11],_=i[12],v=i[13],y=i[14],b=i[15];if(r[0].setComponents(c-a,f-l,g-p,b-_).normalize(),r[1].setComponents(c+a,f+l,g+p,b+_).normalize(),r[2].setComponents(c+o,f+u,g+m,b+v).normalize(),r[3].setComponents(c-o,f-u,g-m,b-v).normalize(),n)r[4].setComponents(s,d,h,y).normalize(),r[5].setComponents(c-s,f-d,g-h,b-y).normalize();else if(r[4].setComponents(c-s,f-d,g-h,b-y).normalize(),t===2e3)r[5].setComponents(c+s,f+d,g+h,b+y).normalize();else if(t===2001)r[5].setComponents(s,d,h,y).normalize();else throw Error(`THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: `+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),tc.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),tc.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(tc)}intersectsSprite(e){return tc.center.set(0,0,0),tc.radius=.7071067811865476+nc.distanceTo(e.center),tc.applyMatrix4(e.matrixWorld),this.intersectsSphere(tc)}intersectsSphere(e){let t=this.planes,n=e.center,r=-e.radius;for(let e=0;e<6;e++)if(t[e].distanceToPoint(n)<r)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let r=t[n];if(rc.x=r.normal.x>0?e.max.x:e.min.x,rc.y=r.normal.y>0?e.max.y:e.min.y,rc.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(rc)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}},ac=new q,oc=class e{constructor(){this.coordinateSystem=_i,this._frustums=[],this._count=0}setFromArrayCamera(e){let t=e.cameras,n=this._frustums;for(let e=0;e<t.length;e++){let r=t[e];ac.multiplyMatrices(r.projectionMatrix,r.matrixWorldInverse),n[e]===void 0&&(n[e]=new ic),n[e].setFromProjectionMatrix(ac,r.coordinateSystem,r.reversedDepth)}return this._count=t.length,this}getFrustum(e){return this._frustums[e]}intersectsObject(e){let t=this._frustums;for(let n=0;n<this._count;n++)if(t[n].intersectsObject(e))return!0;return!1}intersectsSprite(e){let t=this._frustums;for(let n=0;n<this._count;n++)if(t[n].intersectsSprite(e))return!0;return!1}intersectsSphere(e){let t=this._frustums;for(let n=0;n<this._count;n++)if(t[n].intersectsSphere(e))return!0;return!1}intersectsBox(e){let t=this._frustums;for(let n=0;n<this._count;n++)if(t[n].intersectsBox(e))return!0;return!1}containsPoint(e){let t=this._frustums;for(let n=0;n<this._count;n++)if(t[n].containsPoint(e))return!0;return!1}copy(e){this.coordinateSystem=e.coordinateSystem;let t=this._frustums,n=e._frustums;for(let r=0;r<e._count;r++)t[r]===void 0&&(t[r]=new ic),t[r].copy(n[r]);return this._count=e._count,this}clone(){return new e().copy(this)}},sc=class extends Jo{constructor(e){super(),this.isPointsMaterial=!0,this.type=`PointsMaterial`,this.color=new J(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},cc=new q,lc=new hs,uc=new Ao,dc=new G,fc=class extends Pa{constructor(e=new Ro,t=new sc){super(),this.isPoints=!0,this.type=`Points`,this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.morphTargetInfluences=e.morphTargetInfluences===void 0?void 0:e.morphTargetInfluences.slice(),this.morphTargetDictionary=e.morphTargetDictionary===void 0?void 0:Object.assign({},e.morphTargetDictionary),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,r=this.matrixWorld,i=e.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),uc.copy(n.boundingSphere),uc.applyMatrix4(r),uc.radius+=i,e.ray.intersectsSphere(uc)===!1)return;cc.copy(r).invert(),lc.copy(e.ray).applyMatrix4(cc);let o=i/((this.scale.x+this.scale.y+this.scale.z)/3),s=o*o,c=n.index,l=n.attributes.position;if(c!==null){let n=Math.max(0,a.start),i=Math.min(c.count,a.start+a.count);for(let a=n,o=i;a<o;a++){let n=c.getX(a);dc.fromBufferAttribute(l,n),pc(dc,n,s,r,e,t,this)}}else{let n=Math.max(0,a.start),i=Math.min(l.count,a.start+a.count);for(let a=n,o=i;a<o;a++)dc.fromBufferAttribute(l,a),pc(dc,a,s,r,e,t,this)}}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let e=0,t=n.length;e<t;e++){let t=n[e].name||String(e);this.morphTargetInfluences.push(0),this.morphTargetDictionary[t]=e}}}}};function pc(e,t,n,r,i,a,o){let s=lc.distanceSqToPoint(e);if(s<n){let n=new G;lc.closestPointToPoint(e,n),n.applyMatrix4(r);let c=i.ray.origin.distanceTo(n);if(c<i.near||c>i.far)return;a.push({distance:c,distanceToRay:Math.sqrt(s),point:n,index:t,face:null,faceIndex:null,barycoord:null,object:o})}}var mc=class extends na{constructor(e=[],t=301,n,r,i,a,o,s,c,l){super(e,t,n,r,i,a,o,s,c,l),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},hc=class extends na{constructor(e,t,n,r,i,a,o,s,c){super(e,t,n,r,i,a,o,s,c),this.isCanvasTexture=!0,this.needsUpdate=!0}},gc=class extends na{constructor(e,t,n=nr,r,i,a,o=Gn,s=Gn,c,l=pr,u=1){if(l!==1026&&l!==1027)throw Error(`THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat`);super({width:e,height:t,depth:u},r,i,a,o,s,l,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new Qi(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return t.compareFunction=this.compareFunction,t}},_c=class extends gc{constructor(e,t=nr,n=301,r,i,a=Gn,o=Gn,s,c=pr){let l={width:e,height:e,depth:1},u=[l,l,l,l,l,l];super(e,e,t,n,r,i,a,o,s,c),this.image=u,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},vc=class extends na{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},yc=class e extends Ro{constructor(e=1,t=1,n=1,r=1,i=1,a=1){super(),this.type=`BoxGeometry`,this.parameters={width:e,height:t,depth:n,widthSegments:r,heightSegments:i,depthSegments:a};let o=this;r=Math.floor(r),i=Math.floor(i),a=Math.floor(a);let s=[],c=[],l=[],u=[],d=0,f=0;p(`z`,`y`,`x`,-1,-1,n,t,e,a,i,0),p(`z`,`y`,`x`,1,-1,n,t,-e,a,i,1),p(`x`,`z`,`y`,1,1,e,n,t,r,a,2),p(`x`,`z`,`y`,1,-1,e,n,-t,r,a,3),p(`x`,`y`,`z`,1,-1,e,t,n,r,i,4),p(`x`,`y`,`z`,-1,-1,e,t,-n,r,i,5),this.setIndex(s),this.setAttribute(`position`,new Y(c,3)),this.setAttribute(`normal`,new Y(l,3)),this.setAttribute(`uv`,new Y(u,2));function p(e,t,n,r,i,a,p,m,h,g,_){let v=a/h,y=p/g,b=a/2,x=p/2,S=m/2,C=h+1,w=g+1,T=0,E=0,D=new G;for(let a=0;a<w;a++){let o=a*y-x;for(let s=0;s<C;s++)D[e]=(s*v-b)*r,D[t]=o*i,D[n]=S,c.push(D.x,D.y,D.z),D[e]=0,D[t]=0,D[n]=m>0?1:-1,l.push(D.x,D.y,D.z),u.push(s/h),u.push(1-a/g),T+=1}for(let e=0;e<g;e++)for(let t=0;t<h;t++){let n=d+t+C*e,r=d+t+C*(e+1),i=d+(t+1)+C*(e+1),a=d+(t+1)+C*e;s.push(n,r,a),s.push(r,i,a),E+=6}o.addGroup(f,E,_),f+=E,d+=T}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}},bc=class e extends Ro{constructor(e=1,t=1,n=4,r=8,i=1){super(),this.type=`CapsuleGeometry`,this.parameters={radius:e,height:t,capSegments:n,radialSegments:r,heightSegments:i},t=Math.max(0,t),n=Math.max(1,Math.floor(n)),r=Math.max(3,Math.floor(r)),i=Math.max(1,Math.floor(i));let a=[],o=[],s=[],c=[],l=t/2,u=Math.PI/2*e,d=t,f=2*u+d,p=n*2+i,m=r+1,h=new G,g=new G;for(let _=0;_<=p;_++){let v=0,y=0,b=0,x=0;if(_<=n){let t=_/n,r=t*Math.PI/2;y=-l-e*Math.cos(r),b=e*Math.sin(r),x=-e*Math.cos(r),v=t*u}else if(_<=n+i){let r=(_-n)/i;y=-l+r*t,b=e,x=0,v=u+r*d}else{let t=(_-n-i)/n,r=t*Math.PI/2;y=l+e*Math.sin(r),b=e*Math.cos(r),x=e*Math.sin(r),v=u+d+t*u}let S=Math.max(0,Math.min(1,v/f)),C=0;_===0?C=.5/r:_===p&&(C=-.5/r);for(let e=0;e<=r;e++){let t=e/r,n=t*Math.PI*2,i=Math.sin(n),a=Math.cos(n);g.x=-b*a,g.y=y,g.z=b*i,o.push(g.x,g.y,g.z),h.set(-b*a,x,b*i),h.normalize(),s.push(h.x,h.y,h.z),c.push(t+C,S)}if(_>0){let e=(_-1)*m;for(let t=0;t<r;t++){let n=e+t,r=e+t+1,i=_*m+t,o=_*m+t+1;a.push(n,r,i),a.push(r,o,i)}}}this.setIndex(a),this.setAttribute(`position`,new Y(o,3)),this.setAttribute(`normal`,new Y(s,3)),this.setAttribute(`uv`,new Y(c,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.radius,t.height,t.capSegments,t.radialSegments,t.heightSegments)}},xc=class e extends Ro{constructor(e=1,t=32,n=0,r=Math.PI*2){super(),this.type=`CircleGeometry`,this.parameters={radius:e,segments:t,thetaStart:n,thetaLength:r},t=Math.max(3,t);let i=[],a=[],o=[],s=[],c=new G,l=new W;a.push(0,0,0),o.push(0,0,1),s.push(.5,.5);for(let i=0,u=3;i<=t;i++,u+=3){let d=n+i/t*r;c.x=e*Math.cos(d),c.y=e*Math.sin(d),a.push(c.x,c.y,c.z),o.push(0,0,1),l.x=(a[u]/e+1)/2,l.y=(a[u+1]/e+1)/2,s.push(l.x,l.y)}for(let e=1;e<=t;e++)i.push(e,e+1,0);this.setIndex(i),this.setAttribute(`position`,new Y(a,3)),this.setAttribute(`normal`,new Y(o,3)),this.setAttribute(`uv`,new Y(s,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.radius,t.segments,t.thetaStart,t.thetaLength)}},Sc=class e extends Ro{constructor(e=1,t=1,n=1,r=32,i=1,a=!1,o=0,s=Math.PI*2){super(),this.type=`CylinderGeometry`,this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:r,heightSegments:i,openEnded:a,thetaStart:o,thetaLength:s};let c=this;r=Math.floor(r),i=Math.floor(i);let l=[],u=[],d=[],f=[],p=0,m=[],h=n/2,g=0;_(),a===!1&&(e>0&&v(!0),t>0&&v(!1)),this.setIndex(l),this.setAttribute(`position`,new Y(u,3)),this.setAttribute(`normal`,new Y(d,3)),this.setAttribute(`uv`,new Y(f,2));function _(){let a=new G,_=new G,v=0,y=(t-e)/n;for(let c=0;c<=i;c++){let l=[],g=c/i,v=g*(t-e)+e;for(let e=0;e<=r;e++){let t=e/r,i=t*s+o,c=Math.sin(i),m=Math.cos(i);_.x=v*c,_.y=-g*n+h,_.z=v*m,u.push(_.x,_.y,_.z),a.set(c,y,m).normalize(),d.push(a.x,a.y,a.z),f.push(t,1-g),l.push(p++)}m.push(l)}for(let n=0;n<r;n++)for(let r=0;r<i;r++){let a=m[r][n],o=m[r+1][n],s=m[r+1][n+1],c=m[r][n+1];(e>0||r!==0)&&(l.push(a,o,c),v+=3),(t>0||r!==i-1)&&(l.push(o,s,c),v+=3)}c.addGroup(g,v,0),g+=v}function v(n){let i=p,a=new W,m=new G,_=0,v=n===!0?e:t,y=n===!0?1:-1;for(let e=1;e<=r;e++)u.push(0,h*y,0),d.push(0,y,0),f.push(.5,.5),p++;let b=p;for(let e=0;e<=r;e++){let t=e/r*s+o,n=Math.cos(t),i=Math.sin(t);m.x=v*i,m.y=h*y,m.z=v*n,u.push(m.x,m.y,m.z),d.push(0,y,0),a.x=n*.5+.5,a.y=i*.5*y+.5,f.push(a.x,a.y),p++}for(let e=0;e<r;e++){let t=i+e,r=b+e;n===!0?l.push(r,r+1,t):l.push(r+1,r,t),_+=3}c.addGroup(g,_,n===!0?1:2),g+=_}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},Cc=class e extends Sc{constructor(e=1,t=1,n=32,r=1,i=!1,a=0,o=Math.PI*2){super(0,e,t,n,r,i,a,o),this.type=`ConeGeometry`,this.parameters={radius:e,height:t,radialSegments:n,heightSegments:r,openEnded:i,thetaStart:a,thetaLength:o}}static fromJSON(t){return new e(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},wc=class e extends Ro{constructor(e=[],t=[],n=1,r=0){super(),this.type=`PolyhedronGeometry`,this.parameters={vertices:e,indices:t,radius:n,detail:r};let i=[],a=[];o(r),c(n),l(),this.setAttribute(`position`,new Y(i,3)),this.setAttribute(`normal`,new Y(i.slice(),3)),this.setAttribute(`uv`,new Y(a,2)),r===0?this.computeVertexNormals():this.normalizeNormals();function o(e){let n=new G,r=new G,i=new G;for(let a=0;a<t.length;a+=3)f(t[a+0],n),f(t[a+1],r),f(t[a+2],i),s(n,r,i,e)}function s(e,t,n,r){let i=r+1,a=[];for(let r=0;r<=i;r++){a[r]=[];let o=e.clone().lerp(n,r/i),s=t.clone().lerp(n,r/i),c=i-r;for(let e=0;e<=c;e++)e===0&&r===i?a[r][e]=o:a[r][e]=o.clone().lerp(s,e/c)}for(let e=0;e<i;e++)for(let t=0;t<2*(i-e)-1;t++){let n=Math.floor(t/2);t%2==0?(d(a[e][n+1]),d(a[e+1][n]),d(a[e][n])):(d(a[e][n+1]),d(a[e+1][n+1]),d(a[e+1][n]))}}function c(e){let t=new G;for(let n=0;n<i.length;n+=3)t.x=i[n+0],t.y=i[n+1],t.z=i[n+2],t.normalize().multiplyScalar(e),i[n+0]=t.x,i[n+1]=t.y,i[n+2]=t.z}function l(){let e=new G;for(let t=0;t<i.length;t+=3){e.x=i[t+0],e.y=i[t+1],e.z=i[t+2];let n=h(e)/2/Math.PI+.5,r=g(e)/Math.PI+.5;a.push(n,1-r)}p(),u()}function u(){for(let e=0;e<a.length;e+=6){let t=a[e+0],n=a[e+2],r=a[e+4];Math.max(t,n,r)>.9&&Math.min(t,n,r)<.1&&(t<.2&&(a[e+0]+=1),n<.2&&(a[e+2]+=1),r<.2&&(a[e+4]+=1))}}function d(e){i.push(e.x,e.y,e.z)}function f(t,n){let r=t*3;n.x=e[r+0],n.y=e[r+1],n.z=e[r+2]}function p(){let e=new G,t=new G,n=new G,r=new G,o=new W,s=new W,c=new W;for(let l=0,u=0;l<i.length;l+=9,u+=6){e.set(i[l+0],i[l+1],i[l+2]),t.set(i[l+3],i[l+4],i[l+5]),n.set(i[l+6],i[l+7],i[l+8]),o.set(a[u+0],a[u+1]),s.set(a[u+2],a[u+3]),c.set(a[u+4],a[u+5]),r.copy(e).add(t).add(n).divideScalar(3);let d=h(r);m(o,u+0,e,d),m(s,u+2,t,d),m(c,u+4,n,d)}}function m(e,t,n,r){r<0&&e.x===1&&(a[t]=e.x-1),n.x===0&&n.z===0&&(a[t]=r/2/Math.PI+.5)}function h(e){return Math.atan2(e.z,-e.x)}function g(e){return Math.atan2(-e.y,Math.sqrt(e.x*e.x+e.z*e.z))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.vertices,t.indices,t.radius,t.detail)}},Tc=class{constructor(){this.type=`Curve`,this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){V(`Curve: .getPoint() not implemented.`)}getPointAt(e,t){let n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){let e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let t=[],n,r=this.getPoint(0),i=0;t.push(0);for(let a=1;a<=e;a++)n=this.getPoint(a/e),i+=n.distanceTo(r),t.push(i),r=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t=null){let n=this.getLengths(),r=0,i=n.length,a;a=t||e*n[i-1];let o=0,s=i-1,c;for(;o<=s;)if(r=Math.floor(o+(s-o)/2),c=n[r]-a,c<0)o=r+1;else if(c>0)s=r-1;else{s=r;break}if(r=s,n[r]===a)return r/(i-1);let l=n[r],u=n[r+1]-l,d=(a-l)/u;return(r+d)/(i-1)}getTangent(e,t){let n=1e-4,r=e-n,i=e+n;r<0&&(r=0),i>1&&(i=1);let a=this.getPoint(r),o=this.getPoint(i),s=t||(a.isVector2?new W:new G);return s.copy(o).sub(a).normalize(),s}getTangentAt(e,t){let n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t=!1){let n=new G,r=[],i=[],a=[],o=new G,s=new q;for(let t=0;t<=e;t++){let n=t/e;r[t]=this.getTangentAt(n,new G)}i[0]=new G,a[0]=new G;let c=Number.MAX_VALUE,l=Math.abs(r[0].x),u=Math.abs(r[0].y),d=Math.abs(r[0].z);l<=c&&(c=l,n.set(1,0,0)),u<=c&&(c=u,n.set(0,1,0)),d<=c&&n.set(0,0,1),o.crossVectors(r[0],n).normalize(),i[0].crossVectors(r[0],o),a[0].crossVectors(r[0],i[0]);for(let t=1;t<=e;t++){if(i[t]=i[t-1].clone(),a[t]=a[t-1].clone(),o.crossVectors(r[t-1],r[t]),o.length()>2**-52){o.normalize();let e=Math.acos(U(r[t-1].dot(r[t]),-1,1));i[t].applyMatrix4(s.makeRotationAxis(o,e))}a[t].crossVectors(r[t],i[t])}if(t===!0){let t=Math.acos(U(i[0].dot(i[e]),-1,1));t/=e,r[0].dot(o.crossVectors(i[0],i[e]))>0&&(t=-t);for(let n=1;n<=e;n++)i[n].applyMatrix4(s.makeRotationAxis(r[n],t*n)),a[n].crossVectors(r[n],i[n])}return{tangents:r,normals:i,binormals:a}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this.cacheArcLengths=null,this}toJSON(){let e={metadata:{version:4.7,type:`Curve`,generator:`Curve.toJSON`}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this.cacheArcLengths=null,this}};function Ec(){let e=0,t=0,n=0,r=0;function i(i,a,o,s){e=i,t=o,n=-3*i+3*a-2*o-s,r=2*i-2*a+o+s}return{initCatmullRom:function(e,t,n,r,a){i(t,n,a*(n-e),a*(r-t))},initNonuniformCatmullRom:function(e,t,n,r,a,o,s){let c=(t-e)/a-(n-e)/(a+o)+(n-t)/o,l=(n-t)/o-(r-t)/(o+s)+(r-n)/s;c*=o,l*=o,i(t,n,c,l)},calc:function(i){let a=i*i,o=a*i;return e+t*i+n*a+r*o}}}var Dc=new G,Oc=new G,kc=new Ec,Ac=new Ec,jc=new Ec,Mc=class extends Tc{constructor(e=[],t=!1,n=`centripetal`,r=.5){super(),this.isCatmullRomCurve3=!0,this.type=`CatmullRomCurve3`,this.points=e,this.closed=t,this.curveType=n,this.tension=r}getPoint(e,t=new G){let n=t,r=this.points,i=r.length,a=(i-+!this.closed)*e,o=Math.floor(a),s=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/i)+1)*i:s===0&&o===i-1&&(o=i-2,s=1);let c,l;this.closed||o>0?c=r[(o-1)%i]:(Oc.subVectors(r[0],r[1]).add(r[0]),c=Oc);let u=r[o%i],d=r[(o+1)%i];if(this.closed||o+2<i?l=r[(o+2)%i]:(Dc.subVectors(r[i-1],r[i-2]).add(r[i-1]),l=Dc),this.curveType===`centripetal`||this.curveType===`chordal`){let e=this.curveType===`chordal`?.5:.25,t=c.distanceToSquared(u)**+e,n=u.distanceToSquared(d)**+e,r=d.distanceToSquared(l)**+e;n<1e-4&&(n=1),t<1e-4&&(t=n),r<1e-4&&(r=n),kc.initNonuniformCatmullRom(c.x,u.x,d.x,l.x,t,n,r),Ac.initNonuniformCatmullRom(c.y,u.y,d.y,l.y,t,n,r),jc.initNonuniformCatmullRom(c.z,u.z,d.z,l.z,t,n,r)}else this.curveType===`catmullrom`&&(kc.initCatmullRom(c.x,u.x,d.x,l.x,this.tension),Ac.initCatmullRom(c.y,u.y,d.y,l.y,this.tension),jc.initCatmullRom(c.z,u.z,d.z,l.z,this.tension));return n.set(kc.calc(s),Ac.calc(s),jc.calc(s)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let n=e.points[t];this.points.push(n.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let n=this.points[t];e.points.push(n.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let n=e.points[t];this.points.push(new G().fromArray(n))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}};function Nc(e,t,n=2){let r=t&&t.length,i=r?t[0]*n:e.length,a=Pc(e,0,i,n,!0),o=[];if(!a||a.next===a.prev)return o;let s,c,l;if(r&&(a=Vc(e,t,a,n)),e.length>80*n){s=e[0],c=e[1];let t=s,r=c;for(let a=n;a<i;a+=n){let n=e[a],i=e[a+1];n<s&&(s=n),i<c&&(c=i),n>t&&(t=n),i>r&&(r=i)}l=Math.max(t-s,r-c),l=l===0?0:32767/l}return Ic(a,o,n,s,c,l,0),o}function Pc(e,t,n,r,i){let a;if(i===dl(e,t,n,r)>0)for(let i=t;i<n;i+=r)a=cl(i/r|0,e[i],e[i+1],a);else for(let i=n-r;i>=t;i-=r)a=cl(i/r|0,e[i],e[i+1],a);return a&&el(a,a.next)&&(ll(a),a=a.next),a}function Fc(e,t){if(!e)return e;t||(t=e);let n=e,r;do if(r=!1,!n.steiner&&(el(n,n.next)||$c(n.prev,n,n.next)===0)){if(ll(n),n=t=n.prev,n===n.next)break;r=!0}else n=n.next;while(r||n!==t);return t}function Ic(e,t,n,r,i,a,o){if(!e)return;!o&&a&&Kc(e,r,i,a);let s=e;for(;e.prev!==e.next;){let c=e.prev,l=e.next;if(a?Rc(e,r,i,a):Lc(e))t.push(c.i,e.i,l.i),ll(e),e=l.next,s=l.next;else if(e=l,e===s){o?o===1?(e=zc(Fc(e),t),Ic(e,t,n,r,i,a,2)):o===2&&Bc(e,t,n,r,i,a):Ic(Fc(e),t,n,r,i,a,1);break}}}function Lc(e){let t=e.prev,n=e,r=e.next;if($c(t,n,r)>=0)return!1;let i=t.x,a=n.x,o=r.x,s=t.y,c=n.y,l=r.y,u=Math.min(i,a,o),d=Math.min(s,c,l),f=Math.max(i,a,o),p=Math.max(s,c,l),m=r.next;for(;m!==t;){if(m.x>=u&&m.x<=f&&m.y>=d&&m.y<=p&&Zc(i,s,a,c,o,l,m.x,m.y)&&$c(m.prev,m,m.next)>=0)return!1;m=m.next}return!0}function Rc(e,t,n,r){let i=e.prev,a=e,o=e.next;if($c(i,a,o)>=0)return!1;let s=i.x,c=a.x,l=o.x,u=i.y,d=a.y,f=o.y,p=Math.min(s,c,l),m=Math.min(u,d,f),h=Math.max(s,c,l),g=Math.max(u,d,f),_=Jc(p,m,t,n,r),v=Jc(h,g,t,n,r),y=e.prevZ,b=e.nextZ;for(;y&&y.z>=_&&b&&b.z<=v;){if(y.x>=p&&y.x<=h&&y.y>=m&&y.y<=g&&y!==i&&y!==o&&Zc(s,u,c,d,l,f,y.x,y.y)&&$c(y.prev,y,y.next)>=0||(y=y.prevZ,b.x>=p&&b.x<=h&&b.y>=m&&b.y<=g&&b!==i&&b!==o&&Zc(s,u,c,d,l,f,b.x,b.y)&&$c(b.prev,b,b.next)>=0))return!1;b=b.nextZ}for(;y&&y.z>=_;){if(y.x>=p&&y.x<=h&&y.y>=m&&y.y<=g&&y!==i&&y!==o&&Zc(s,u,c,d,l,f,y.x,y.y)&&$c(y.prev,y,y.next)>=0)return!1;y=y.prevZ}for(;b&&b.z<=v;){if(b.x>=p&&b.x<=h&&b.y>=m&&b.y<=g&&b!==i&&b!==o&&Zc(s,u,c,d,l,f,b.x,b.y)&&$c(b.prev,b,b.next)>=0)return!1;b=b.nextZ}return!0}function zc(e,t){let n=e;do{let r=n.prev,i=n.next.next;!el(r,i)&&tl(r,n,n.next,i)&&al(r,i)&&al(i,r)&&(t.push(r.i,n.i,i.i),ll(n),ll(n.next),n=e=i),n=n.next}while(n!==e);return Fc(n)}function Bc(e,t,n,r,i,a){let o=e;do{let e=o.next.next;for(;e!==o.prev;){if(o.i!==e.i&&Qc(o,e)){let s=sl(o,e);o=Fc(o,o.next),s=Fc(s,s.next),Ic(o,t,n,r,i,a,0),Ic(s,t,n,r,i,a,0);return}e=e.next}o=o.next}while(o!==e)}function Vc(e,t,n,r){let i=[];for(let n=0,a=t.length;n<a;n++){let o=Pc(e,t[n]*r,n<a-1?t[n+1]*r:e.length,r,!1);o===o.next&&(o.steiner=!0),i.push(Yc(o))}i.sort(Hc);for(let e=0;e<i.length;e++)n=Uc(i[e],n);return n}function Hc(e,t){let n=e.x-t.x;return n===0&&(n=e.y-t.y,n===0&&(n=(e.next.y-e.y)/(e.next.x-e.x)-(t.next.y-t.y)/(t.next.x-t.x))),n}function Uc(e,t){let n=Wc(e,t);if(!n)return t;let r=sl(n,e);return Fc(r,r.next),Fc(n,n.next)}function Wc(e,t){let n=t,r=e.x,i=e.y,a=-1/0,o;if(el(e,n))return n;do{if(el(e,n.next))return n.next;if(i<=n.y&&i>=n.next.y&&n.next.y!==n.y){let e=n.x+(i-n.y)*(n.next.x-n.x)/(n.next.y-n.y);if(e<=r&&e>a&&(a=e,o=n.x<n.next.x?n:n.next,e===r))return o}n=n.next}while(n!==t);if(!o)return null;let s=o,c=o.x,l=o.y,u=1/0;n=o;do{if(r>=n.x&&n.x>=c&&r!==n.x&&Xc(i<l?r:a,i,c,l,i<l?a:r,i,n.x,n.y)){let t=Math.abs(i-n.y)/(r-n.x);al(n,e)&&(t<u||t===u&&(n.x>o.x||n.x===o.x&&Gc(o,n)))&&(o=n,u=t)}n=n.next}while(n!==s);return o}function Gc(e,t){return $c(e.prev,e,t.prev)<0&&$c(t.next,e,e.next)<0}function Kc(e,t,n,r){let i=e;do i.z===0&&(i.z=Jc(i.x,i.y,t,n,r)),i.prevZ=i.prev,i.nextZ=i.next,i=i.next;while(i!==e);i.prevZ.nextZ=null,i.prevZ=null,qc(i)}function qc(e){let t,n=1;do{let r=e,i;e=null;let a=null;for(t=0;r;){t++;let o=r,s=0;for(let e=0;e<n&&(s++,o=o.nextZ,o);e++);let c=n;for(;s>0||c>0&&o;)s!==0&&(c===0||!o||r.z<=o.z)?(i=r,r=r.nextZ,s--):(i=o,o=o.nextZ,c--),a?a.nextZ=i:e=i,i.prevZ=a,a=i;r=o}a.nextZ=null,n*=2}while(t>1);return e}function Jc(e,t,n,r,i){return e=(e-n)*i|0,t=(t-r)*i|0,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,e|t<<1}function Yc(e){let t=e,n=e;do(t.x<n.x||t.x===n.x&&t.y<n.y)&&(n=t),t=t.next;while(t!==e);return n}function Xc(e,t,n,r,i,a,o,s){return(i-o)*(t-s)>=(e-o)*(a-s)&&(e-o)*(r-s)>=(n-o)*(t-s)&&(n-o)*(a-s)>=(i-o)*(r-s)}function Zc(e,t,n,r,i,a,o,s){return(e!==o||t!==s)&&Xc(e,t,n,r,i,a,o,s)}function Qc(e,t){return e.next.i!==t.i&&e.prev.i!==t.i&&!il(e,t)&&(al(e,t)&&al(t,e)&&ol(e,t)&&($c(e.prev,e,t.prev)||$c(e,t.prev,t))||el(e,t)&&$c(e.prev,e,e.next)>0&&$c(t.prev,t,t.next)>0)}function $c(e,t,n){return(t.y-e.y)*(n.x-t.x)-(t.x-e.x)*(n.y-t.y)}function el(e,t){return e.x===t.x&&e.y===t.y}function tl(e,t,n,r){let i=rl($c(e,t,n)),a=rl($c(e,t,r)),o=rl($c(n,r,e)),s=rl($c(n,r,t));return!!(i!==a&&o!==s||i===0&&nl(e,n,t)||a===0&&nl(e,r,t)||o===0&&nl(n,e,r)||s===0&&nl(n,t,r))}function nl(e,t,n){return t.x<=Math.max(e.x,n.x)&&t.x>=Math.min(e.x,n.x)&&t.y<=Math.max(e.y,n.y)&&t.y>=Math.min(e.y,n.y)}function rl(e){return e>0?1:e<0?-1:0}function il(e,t){let n=e;do{if(n.i!==e.i&&n.next.i!==e.i&&n.i!==t.i&&n.next.i!==t.i&&tl(n,n.next,e,t))return!0;n=n.next}while(n!==e);return!1}function al(e,t){return $c(e.prev,e,e.next)<0?$c(e,t,e.next)>=0&&$c(e,e.prev,t)>=0:$c(e,t,e.prev)<0||$c(e,e.next,t)<0}function ol(e,t){let n=e,r=!1,i=(e.x+t.x)/2,a=(e.y+t.y)/2;do n.y>a!=n.next.y>a&&n.next.y!==n.y&&i<(n.next.x-n.x)*(a-n.y)/(n.next.y-n.y)+n.x&&(r=!r),n=n.next;while(n!==e);return r}function sl(e,t){let n=ul(e.i,e.x,e.y),r=ul(t.i,t.x,t.y),i=e.next,a=t.prev;return e.next=t,t.prev=e,n.next=i,i.prev=n,r.next=n,n.prev=r,a.next=r,r.prev=a,r}function cl(e,t,n,r){let i=ul(e,t,n);return r?(i.next=r.next,i.prev=r,r.next.prev=i,r.next=i):(i.prev=i,i.next=i),i}function ll(e){e.next.prev=e.prev,e.prev.next=e.next,e.prevZ&&(e.prevZ.nextZ=e.nextZ),e.nextZ&&(e.nextZ.prevZ=e.prevZ)}function ul(e,t,n){return{i:e,x:t,y:n,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function dl(e,t,n,r){let i=0;for(let a=t,o=n-r;a<n;a+=r)i+=(e[o]-e[a])*(e[a+1]+e[o+1]),o=a;return i}var fl=class{static triangulate(e,t,n=2){return Nc(e,t,n)}},pl=class e{static area(e){let t=e.length,n=0;for(let r=t-1,i=0;i<t;r=i++)n+=e[r].x*e[i].y-e[i].x*e[r].y;return n*.5}static isClockWise(t){return e.area(t)<0}static triangulateShape(e,t){let n=[],r=[],i=[];ml(e),hl(n,e);let a=e.length;t.forEach(ml);for(let e=0;e<t.length;e++)r.push(a),a+=t[e].length,hl(n,t[e]);let o=fl.triangulate(n,r);for(let e=0;e<o.length;e+=3)i.push(o.slice(e,e+3));return i}};function ml(e){let t=e.length;t>2&&e[t-1].equals(e[0])&&e.pop()}function hl(e,t){for(let n=0;n<t.length;n++)e.push(t[n].x),e.push(t[n].y)}var gl=class e extends wc{constructor(e=1,t=0){let n=(1+Math.sqrt(5))/2,r=[-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1];super(r,[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1],e,t),this.type=`IcosahedronGeometry`,this.parameters={radius:e,detail:t}}static fromJSON(t){return new e(t.radius,t.detail)}},_l=class e extends Ro{constructor(e=[new W(0,-.5),new W(.5,0),new W(0,.5)],t=12,n=0,r=Math.PI*2){super(),this.type=`LatheGeometry`,this.parameters={points:e,segments:t,phiStart:n,phiLength:r},t=Math.floor(t),r=U(r,0,Math.PI*2);let i=[],a=[],o=[],s=[],c=[],l=1/t,u=new G,d=new W,f=new G,p=new G,m=new G,h=0,g=0;for(let t=0;t<=e.length-1;t++)switch(t){case 0:h=e[t+1].x-e[t].x,g=e[t+1].y-e[t].y,f.x=g*1,f.y=-h,f.z=g*0,m.copy(f),f.normalize(),s.push(f.x,f.y,f.z);break;case e.length-1:m.normalize(),s.push(m.x,m.y,m.z);break;default:h=e[t+1].x-e[t].x,g=e[t+1].y-e[t].y,f.x=g*1,f.y=-h,f.z=g*0,p.copy(f),f.x+=m.x,f.y+=m.y,f.z+=m.z,f.normalize(),s.push(f.x,f.y,f.z),m.copy(p)}for(let i=0;i<=t;i++){let f=n+i*l*r,p=Math.sin(f),m=Math.cos(f);for(let n=0;n<=e.length-1;n++){u.x=e[n].x*p,u.y=e[n].y,u.z=e[n].x*m,a.push(u.x,u.y,u.z),d.x=i/t,d.y=n/(e.length-1),o.push(d.x,d.y);let r=s[3*n+0]*p,l=s[3*n+1],f=s[3*n+0]*m;c.push(r,l,f)}}for(let n=0;n<t;n++)for(let t=0;t<e.length-1;t++){let r=t+n*e.length,a=r,o=r+e.length,s=r+e.length+1,c=r+1;i.push(a,o,c),i.push(s,c,o)}this.setIndex(i),this.setAttribute(`position`,new Y(a,3)),this.setAttribute(`uv`,new Y(o,2)),this.setAttribute(`normal`,new Y(c,3))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.points,t.segments,t.phiStart,t.phiLength)}},vl=class e extends wc{constructor(e=1,t=0){super([1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1],[0,2,4,0,4,3,0,3,5,0,5,2,1,2,5,1,5,3,1,3,4,1,4,2],e,t),this.type=`OctahedronGeometry`,this.parameters={radius:e,detail:t}}static fromJSON(t){return new e(t.radius,t.detail)}},yl=class e extends Ro{constructor(e=1,t=1,n=1,r=1){super(),this.type=`PlaneGeometry`,this.parameters={width:e,height:t,widthSegments:n,heightSegments:r};let i=e/2,a=t/2,o=Math.floor(n),s=Math.floor(r),c=o+1,l=s+1,u=e/o,d=t/s,f=[],p=[],m=[],h=[];for(let e=0;e<l;e++){let t=e*d-a;for(let n=0;n<c;n++){let r=n*u-i;p.push(r,-t,0),m.push(0,0,1),h.push(n/o),h.push(1-e/s)}}for(let e=0;e<s;e++)for(let t=0;t<o;t++){let n=t+c*e,r=t+c*(e+1),i=t+1+c*(e+1),a=t+1+c*e;f.push(n,r,a),f.push(r,i,a)}this.setIndex(f),this.setAttribute(`position`,new Y(p,3)),this.setAttribute(`normal`,new Y(m,3)),this.setAttribute(`uv`,new Y(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.widthSegments,t.heightSegments)}},bl=class e extends Ro{constructor(e=1,t=32,n=16,r=0,i=Math.PI*2,a=0,o=Math.PI){super(),this.type=`SphereGeometry`,this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:r,phiLength:i,thetaStart:a,thetaLength:o},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));let s=Math.min(a+o,Math.PI),c=0,l=[],u=new G,d=new G,f=[],p=[],m=[],h=[];for(let f=0;f<=n;f++){let g=[],_=f/n,v=a+_*o,y=e*Math.cos(v),b=Math.sqrt(e*e-y*y),x=0;f===0&&a===0?x=.5/t:f===n&&s===Math.PI&&(x=-.5/t);for(let e=0;e<=t;e++){let n=e/t,a=r+n*i;u.x=-b*Math.cos(a),u.y=y,u.z=b*Math.sin(a),p.push(u.x,u.y,u.z),d.copy(u).normalize(),m.push(d.x,d.y,d.z),h.push(n+x,1-_),g.push(c++)}l.push(g)}for(let e=0;e<n;e++)for(let r=0;r<t;r++){let t=l[e][r+1],i=l[e][r],o=l[e+1][r],c=l[e+1][r+1];(e!==0||a>0)&&f.push(t,i,c),(e!==n-1||s<Math.PI)&&f.push(i,o,c)}this.setIndex(f),this.setAttribute(`position`,new Y(p,3)),this.setAttribute(`normal`,new Y(m,3)),this.setAttribute(`uv`,new Y(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}},xl=class e extends Ro{constructor(e=1,t=.4,n=12,r=48,i=Math.PI*2,a=0,o=Math.PI*2){super(),this.type=`TorusGeometry`,this.parameters={radius:e,tube:t,radialSegments:n,tubularSegments:r,arc:i,thetaStart:a,thetaLength:o},n=Math.floor(n),r=Math.floor(r);let s=[],c=[],l=[],u=[],d=new G,f=new G,p=new G;for(let s=0;s<=n;s++){let m=a+s/n*o;for(let a=0;a<=r;a++){let o=a/r*i;f.x=(e+t*Math.cos(m))*Math.cos(o),f.y=(e+t*Math.cos(m))*Math.sin(o),f.z=t*Math.sin(m),c.push(f.x,f.y,f.z),d.x=e*Math.cos(o),d.y=e*Math.sin(o),p.subVectors(f,d).normalize(),l.push(p.x,p.y,p.z),u.push(a/r),u.push(s/n)}}for(let e=1;e<=n;e++)for(let t=1;t<=r;t++){let n=(r+1)*e+t-1,i=(r+1)*(e-1)+t-1,a=(r+1)*(e-1)+t,o=(r+1)*e+t;s.push(n,i,o),s.push(i,a,o)}this.setIndex(s),this.setAttribute(`position`,new Y(c,3)),this.setAttribute(`normal`,new Y(l,3)),this.setAttribute(`uv`,new Y(u,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.radius,t.tube,t.radialSegments,t.tubularSegments,t.arc,t.thetaStart,t.thetaLength)}};function Sl(e){let t={};for(let n in e){t[n]={};for(let r in e[n]){let i=e[n][r];if(wl(i))i.isRenderTargetTexture?(V(`UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms().`),t[n][r]=null):t[n][r]=i.clone();else if(Array.isArray(i)){if(wl(i[0])){let e=[];for(let t=0,n=i.length;t<n;t++)e[t]=i[t].clone();t[n][r]=e}else t[n][r]=i.slice()}else t[n][r]=i}}return t}function Cl(e){let t={};for(let n=0;n<e.length;n++){let r=Sl(e[n]);for(let e in r)t[e]=r[e]}return t}function wl(e){return e&&(e.isColor||e.isMatrix3||e.isMatrix4||e.isVector2||e.isVector3||e.isVector4||e.isTexture||e.isQuaternion)}function Tl(e){let t=[];for(let n=0;n<e.length;n++)t.push(e[n].clone());return t}function El(e){let t=e.getRenderTarget();return t===null?e.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:Ki.workingColorSpace}var Dl={clone:Sl,merge:Cl},Ol=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,kl=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,Al=class extends Jo{constructor(e){super(),this.isShaderMaterial=!0,this.type=`ShaderMaterial`,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Ol,this.fragmentShader=kl,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Sl(e.uniforms),this.uniformsGroups=Tl(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let n in this.uniforms){let r=this.uniforms[n].value;r&&r.isTexture?t.uniforms[n]={type:`t`,value:r.toJSON(e).uuid}:r&&r.isColor?t.uniforms[n]={type:`c`,value:r.getHex()}:r&&r.isVector2?t.uniforms[n]={type:`v2`,value:r.toArray()}:r&&r.isVector3?t.uniforms[n]={type:`v3`,value:r.toArray()}:r&&r.isVector4?t.uniforms[n]={type:`v4`,value:r.toArray()}:r&&r.isMatrix3?t.uniforms[n]={type:`m3`,value:r.toArray()}:r&&r.isMatrix4?t.uniforms[n]={type:`m4`,value:r.toArray()}:t.uniforms[n]={value:r}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let e in this.extensions)this.extensions[e]===!0&&(n[e]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let n in e.uniforms){let r=e.uniforms[n];switch(this.uniforms[n]={},r.type){case`t`:this.uniforms[n].value=t[r.value]||null;break;case`c`:this.uniforms[n].value=new J().setHex(r.value);break;case`v2`:this.uniforms[n].value=new W().fromArray(r.value);break;case`v3`:this.uniforms[n].value=new G().fromArray(r.value);break;case`v4`:this.uniforms[n].value=new ra().fromArray(r.value);break;case`m3`:this.uniforms[n].value=new K().fromArray(r.value);break;case`m4`:this.uniforms[n].value=new q().fromArray(r.value);break;default:this.uniforms[n].value=r.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let t in e.extensions)this.extensions[t]=e.extensions[t];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},jl=class extends Al{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type=`RawShaderMaterial`}},Ml=class extends Jo{constructor(e){super(),this.isMeshToonMaterial=!0,this.defines={TOON:``},this.type=`MeshToonMaterial`,this.color=new J(16777215),this.map=null,this.gradientMap=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new J(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new W(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.alphaMap=null,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap=`round`,this.wireframeLinejoin=`round`,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.gradientMap=e.gradientMap,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.alphaMap=e.alphaMap,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},Nl=class extends Jo{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type=`MeshDepthMaterial`,this.depthPacking=li,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},Pl=class extends Jo{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type=`MeshDistanceMaterial`,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function Fl(e,t){return!e||e.constructor===t?e:typeof t.BYTES_PER_ELEMENT==`number`?new t(e):Array.prototype.slice.call(e)}function Il(e){return e!==void 0&&e.inTangents!==void 0&&e.outTangents!==void 0}var Ll=class{constructor(e,t,n,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r===void 0?new t.constructor(n):r,this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,r=t[n],i=t[n-1];validate_interval:{seek:{let a;linear_scan:{forward_scan:if(!(e<r)){for(let a=n+2;;){if(r===void 0){if(e<i)break forward_scan;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===a)break;if(i=r,r=t[++n],e<r)break seek}a=t.length;break linear_scan}if(!(e>=i)){let o=t[1];e<o&&(n=2,i=o);for(let a=n-2;;){if(i===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===a)break;if(r=i,i=t[--n-1],e>=i)break seek}a=n,n=0;break linear_scan}break validate_interval}for(;n<a;){let r=n+a>>>1;e<t[r]?a=r:n=r+1}if(r=t[n],i=t[n-1],i===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,i,r)}return this.interpolate_(n,i,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,r=this.valueSize,i=e*r;for(let e=0;e!==r;++e)t[e]=n[i+e];return t}interpolate_(){throw Error(`THREE.Interpolant: Call to abstract method.`)}intervalChanged_(){}},Rl=class extends Ll{constructor(e,t,n,r){super(e,t,n,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:oi,endingEnd:oi}}intervalChanged_(e,t,n){let r=this.parameterPositions,i=e-2,a=e+1,o=r[i],s=r[a];if(o===void 0)switch(this.getSettings_().endingStart){case si:i=e,o=2*t-n;break;case ci:i=r.length-2,o=t+r[i]-r[i+1];break;default:i=e,o=n}if(s===void 0)switch(this.getSettings_().endingEnd){case si:a=e,s=2*n-t;break;case ci:a=1,s=n+r[1]-r[0];break;default:a=e-1,s=t}let c=(n-t)*.5,l=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(s-n),this._offsetPrev=i*l,this._offsetNext=a*l}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=this._offsetPrev,u=this._offsetNext,d=this._weightPrev,f=this._weightNext,p=(n-t)/(r-t),m=p*p,h=m*p,g=-d*h+2*d*m-d*p,_=(1+d)*h+(-1.5-2*d)*m+(-.5+d)*p+1,v=(-1-f)*h+(1.5+f)*m+.5*p,y=f*h-f*m;for(let e=0;e!==o;++e)i[e]=g*a[l+e]+_*a[c+e]+v*a[s+e]+y*a[u+e];return i}},zl=class extends Ll{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=(n-t)/(r-t),u=1-l;for(let e=0;e!==o;++e)i[e]=a[c+e]*u+a[s+e]*l;return i}},Bl=class extends Ll{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e){return this.copySampleValue_(e-1)}},Vl=class extends Ll{interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=this.inTangents,u=this.outTangents;if(!l||!u){let e=(n-t)/(r-t),l=1-e;for(let t=0;t!==o;++t)i[t]=a[c+t]*l+a[s+t]*e;return i}let d=o*2,f=e-1;for(let p=0;p!==o;++p){let o=a[c+p],m=a[s+p],h=f*d+p*2,g=u[h],_=u[h+1],v=e*d+p*2,y=l[v],b=l[v+1],x=Wl(n,t,g,y,r);i[p]=Hl(x,o,_,b,m)}return i}};function Hl(e,t,n,r,i){let a=1-e;return a*a*a*t+3*a*a*e*n+3*a*e*e*r+e*e*e*i}function Ul(e,t,n,r,i){let a=1-e;return 3*a*a*(n-t)+6*a*e*(r-n)+3*e*e*(i-r)}function Wl(e,t,n,r,i){let a=(e-t)/(i-t);for(let o=0;o<8;o++){let o=Hl(a,t,n,r,i)-e;if(Math.abs(o)<1e-10)break;let s=Ul(a,t,n,r,i);if(Math.abs(s)<1e-10)break;a=Math.max(0,Math.min(1,a-o/s))}return a}var Gl=class{constructor(e,t,n,r){if(e===void 0)throw Error(`THREE.KeyframeTrack: track name is undefined`);if(t===void 0||t.length===0)throw Error(`THREE.KeyframeTrack: no keyframes in track named `+e);this.name=e,this.times=Fl(t,this.TimeBufferType),this.values=Fl(n,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:Fl(e.times,Array),values:Fl(e.values,Array)};let t=e.getInterpolation();t!==e.DefaultInterpolation&&(n.interpolation=t),Il(e.settings)&&(n.settings={inTangents:Fl(e.settings.inTangents,Array),outTangents:Fl(e.settings.outTangents,Array)})}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new Bl(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new zl(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new Rl(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new Vl(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case ni:t=this.InterpolantFactoryMethodDiscrete;break;case ri:t=this.InterpolantFactoryMethodLinear;break;case ii:t=this.InterpolantFactoryMethodSmooth;break;case ai:t=this.InterpolantFactoryMethodBezier}if(t===void 0){let t=`unsupported interpolation for `+this.ValueTypeName+` keyframe track named `+this.name;if(this.createInterpolant===void 0){if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw Error(t)}return V(`KeyframeTrack:`,t),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return ni;case this.InterpolantFactoryMethodLinear:return ri;case this.InterpolantFactoryMethodSmooth:return ii;case this.InterpolantFactoryMethodBezier:return ai}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]+=e;Il(this.settings)&&(Kl(this.settings.inTangents,e),Kl(this.settings.outTangents,e))}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]*=e;Il(this.settings)&&(ql(this.settings.inTangents,e),ql(this.settings.outTangents,e))}return this}trim(e,t){let n=this.times,r=n.length,i=0,a=r-1;for(;i!==r&&n[i]<e;)++i;for(;a!==-1&&n[a]>t;)--a;if(++a,i!==0||a!==r){i>=a&&(a=Math.max(a,1),i=a-1);let e=this.getValueSize();this.times=n.slice(i,a),this.values=this.values.slice(i*e,a*e)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(H(`KeyframeTrack: Invalid value size in track.`,this),e=!1);let n=this.times,r=this.values,i=n.length;i===0&&(H(`KeyframeTrack: Track is empty.`,this),e=!1);let a=null;for(let t=0;t!==i;t++){let r=n[t];if(typeof r==`number`&&isNaN(r)){H(`KeyframeTrack: Time is not a valid number.`,this,t,r),e=!1;break}if(a!==null&&a>r){H(`KeyframeTrack: Out of order keys.`,this,t,r,a),e=!1;break}a=r}if(r!==void 0&&yi(r))for(let t=0,n=r.length;t!==n;++t){let n=r[t];if(isNaN(n)){H(`KeyframeTrack: Value is not a valid number.`,this,t,n),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),r=this.getInterpolation()===ii,i=e.length-1,a=1;for(let o=1;o<i;++o){let i=!1,s=e[o];if(s!==e[o+1]&&(o!==1||s!==e[0])){if(r)i=!0;else{let e=o*n,r=e-n,a=e+n;for(let o=0;o!==n;++o){let n=t[e+o];if(n!==t[r+o]||n!==t[a+o]){i=!0;break}}}}if(i){if(o!==a){e[a]=e[o];let r=o*n,i=a*n;for(let e=0;e!==n;++e)t[i+e]=t[r+e]}++a}}if(i>0){e[a]=e[i];for(let e=i*n,r=a*n,o=0;o!==n;++o)t[r+o]=t[e+o];++a}return a===e.length?(this.times=e,this.values=t):(this.times=e.slice(0,a),this.values=t.slice(0,a*n)),this}clone(){let e=this.times.slice(),t=this.values.slice(),n=this.constructor,r=new n(this.name,e,t);return r.createInterpolant=this.createInterpolant,Il(this.settings)&&(r.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),r}};function Kl(e,t){for(let n=0,r=e.length;n!==r;n+=2)e[n]+=t}function ql(e,t){for(let n=0,r=e.length;n!==r;n+=2)e[n]*=t}Gl.prototype.ValueTypeName=``,Gl.prototype.TimeBufferType=Float32Array,Gl.prototype.ValueBufferType=Float32Array,Gl.prototype.DefaultInterpolation=ri;var Jl=class extends Gl{constructor(e,t,n){super(e,t,n)}};Jl.prototype.ValueTypeName=`bool`,Jl.prototype.ValueBufferType=Array,Jl.prototype.DefaultInterpolation=ni,Jl.prototype.InterpolantFactoryMethodLinear=void 0,Jl.prototype.InterpolantFactoryMethodSmooth=void 0;var Yl=class extends Gl{constructor(e,t,n,r){super(e,t,n,r)}};Yl.prototype.ValueTypeName=`color`;var Xl=class extends Gl{constructor(e,t,n,r){super(e,t,n,r)}};Xl.prototype.ValueTypeName=`number`;var Zl=class extends Ll{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=(n-t)/(r-t),c=e*o;for(let e=c+o;c!==e;c+=4)zi.slerpFlat(i,0,a,c-o,a,c,s);return i}},Ql=class extends Gl{constructor(e,t,n,r){super(e,t,n,r)}InterpolantFactoryMethodLinear(e){return new Zl(this.times,this.values,this.getValueSize(),e)}};Ql.prototype.ValueTypeName=`quaternion`,Ql.prototype.InterpolantFactoryMethodSmooth=void 0;var $l=class extends Gl{constructor(e,t,n){super(e,t,n)}};$l.prototype.ValueTypeName=`string`,$l.prototype.ValueBufferType=Array,$l.prototype.DefaultInterpolation=ni,$l.prototype.InterpolantFactoryMethodLinear=void 0,$l.prototype.InterpolantFactoryMethodSmooth=void 0;var eu=class extends Gl{constructor(e,t,n,r){super(e,t,n,r)}};eu.prototype.ValueTypeName=`vector`;var tu=class extends Pa{static registerNode(e){this.prototype._lightNode=e}constructor(e,t=1){super(),this.isLight=!0,this.type=`Light`,this.color=new J(e),this.intensity=t}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}},nu=class extends tu{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type=`HemisphereLight`,this.position.copy(Pa.DEFAULT_UP),this.updateMatrix(),this.groundColor=new J(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){let t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}},ru=new q,iu=new G,au=new G,ou=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new W(512,512),this.mapType=Zn,this.map=null,this.mapPass=null,this.matrix=new q,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new ic,this._frameExtents=new W(1,1),this._viewportCount=1,this._viewports=[new ra(0,0,1,1)]}getViewportCount(){return this._viewportCount}getCamera(){return this.camera}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera;iu.setFromMatrixPosition(e.matrixWorld),t.position.copy(iu),au.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(au),t.updateMatrixWorld(),this._updateMatrix(t,this.matrix,this._frustum)}_updateMatrix(e,t,n,r){ru.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),n.setFromProjectionMatrix(ru,e.coordinateSystem,e.reversedDepth);let i=this._frameExtents,a=r?r.z/i.x:1,o=r?r.w/i.y:1,s=r?r.x/i.x:0,c=r?r.y/i.y:0;e.coordinateSystem===2001||e.reversedDepth?t.set(.5*a,0,0,.5*a+s,0,.5*o,0,.5*o+c,0,0,1,0,0,0,0,1):t.set(.5*a,0,0,.5*a+s,0,.5*o,0,.5*o+c,0,0,.5,.5,0,0,0,1),t.multiply(ru)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.mapType=e.mapType,this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return e.intensity=this.intensity,e.bias=this.bias,e.normalBias=this.normalBias,e.radius=this.radius,e.blurSamples=this.blurSamples,e.mapSize=this.mapSize.toArray(),e.mapType=this.mapType,e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},su=new G,cu=new zi,lu=new G,uu=class extends Pa{constructor(){super(),this.isCamera=!0,this.type=`Camera`,this.matrixWorldInverse=new q,this.projectionMatrix=new q,this.projectionMatrixInverse=new q,this.coordinateSystem=_i,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(su,cu,lu),lu.x===1&&lu.y===1&&lu.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(su,cu,lu.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(su,cu,lu),lu.x===1&&lu.y===1&&lu.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(su,cu,lu.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},du=new G,fu=new W,pu=new W,mu=class extends uu{constructor(e=50,t=1,n=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type=`PerspectiveCamera`,this.fov=e,this.zoom=1,this.near=n,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=ji*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(Ai*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return ji*2*Math.atan(Math.tan(Ai*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){du.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(du.x,du.y).multiplyScalar(-e/du.z),du.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(du.x,du.y).multiplyScalar(-e/du.z)}getViewSize(e,t){return this.getViewBounds(e,fu,pu),t.subVectors(pu,fu)}setViewOffset(e,t,n,r,i,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=i,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(Ai*.5*this.fov)/this.zoom,n=2*t,r=this.aspect*n,i=-.5*r,a=this.view;if(this.view!==null&&this.view.enabled){let e=a.fullWidth,o=a.fullHeight;i+=a.offsetX*r/e,t-=a.offsetY*n/o,r*=a.width/e,n*=a.height/o}let o=this.filmOffset;o!==0&&(i+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(i,i+r,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}},hu=class extends uu{constructor(e=-1,t=1,n=1,r=-1,i=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type=`OrthographicCamera`,this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=r,this.near=i,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,r,i,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=i,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,r=(this.top+this.bottom)/2,i=n-e,a=n+e,o=r+t,s=r-t;if(this.view!==null&&this.view.enabled){let e=(this.right-this.left)/this.view.fullWidth/this.zoom,t=(this.top-this.bottom)/this.view.fullHeight/this.zoom;i+=e*this.view.offsetX,a=i+e*this.view.width,o-=t*this.view.offsetY,s=o-t*this.view.height}this.projectionMatrix.makeOrthographic(i,a,o,s,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},gu=class extends ou{constructor(){super(new hu(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},_u=class extends tu{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type=`DirectionalLight`,this.position.copy(Pa.DEFAULT_UP),this.updateMatrix(),this.target=new Pa,this.shadow=new gu}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}},vu=-90,yu=1,bu=class extends Pa{constructor(e,t,n){super(),this.type=`CubeCamera`,this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let r=new mu(vu,yu,e,t);r.layers=this.layers,this.add(r);let i=new mu(vu,yu,e,t);i.layers=this.layers,this.add(i);let a=new mu(vu,yu,e,t);a.layers=this.layers,this.add(a);let o=new mu(vu,yu,e,t);o.layers=this.layers,this.add(o);let s=new mu(vu,yu,e,t);s.layers=this.layers,this.add(s);let c=new mu(vu,yu,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,r,i,a,o,s]=t;for(let e of t)this.remove(e);if(e===2e3)n.up.set(0,1,0),n.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),i.up.set(0,0,-1),i.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),s.up.set(0,1,0),s.lookAt(0,0,-1);else if(e===2001)n.up.set(0,-1,0),n.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),i.up.set(0,0,1),i.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),s.up.set(0,-1,0),s.lookAt(0,0,-1);else throw Error(`THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: `+e);for(let e of t)this.add(e),e.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[i,a,o,s,c,l]=this.children,u=e.getRenderTarget(),d=e.getActiveCubeFace(),f=e.getActiveMipmapLevel(),p=e.xr.enabled;e.xr.enabled=!1;let m=n.texture.mipmapsAutoUpdate;n.texture.mipmapsAutoUpdate=!1;let h=!1;h=e.isWebGLRenderer===!0?e.state.buffers.depth.getReversed():e.reversedDepthBuffer,e.setRenderTarget(n,0,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,i),e.setRenderTarget(n,1,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,2,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,3,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,s),e.setRenderTarget(n,4,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),n.texture.mipmapsAutoUpdate=m,e.setRenderTarget(n,5,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(u,d,f),e.xr.enabled=p,n.texture.needsPMREMUpdate=!0}},xu=class extends mu{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e,this.perCameraFrustumCulled=!1}},Su=`\\[\\]\\.:\\/`,Cu=RegExp(`[\\[\\]\\.:\\/]`,`g`),wu=`[^\\[\\]\\.:\\/]`,Tu=`[^`+Su.replace(`\\.`,``)+`]`,Eu=`((?:WC+[\\/:])*)`.replace(`WC`,wu),Du=`(WCOD+)?`.replace(`WCOD`,Tu),Ou=`(?:\\.(WC+)(?:\\[(.+)\\])?)?`.replace(`WC`,wu),ku=`\\.(WC+)(?:\\[(.+)\\])?`.replace(`WC`,wu),Au=RegExp(`^`+Eu+Du+Ou+ku+`$`),ju=[`material`,`materials`,`bones`,`map`],Mu=class{constructor(e,t,n){let r=n||Nu.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,r)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,r=this._bindings[n];r!==void 0&&r.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let r=this._targetGroup.nCachedObjects_,i=n.length;r!==i;++r)n[r].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}},Nu=class e{constructor(t,n,r){this.path=n,this.parsedPath=r||e.parseTrackName(n),this.node=e.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,n,r){return t&&t.isAnimationObjectGroup?new e.Composite(t,n,r):new e(t,n,r)}static sanitizeNodeName(e){return e.replace(/\s/g,`_`).replace(Cu,``)}static parseTrackName(e){let t=Au.exec(e);if(t===null)throw Error(`THREE.PropertyBinding: Cannot parse trackName: `+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},r=n.nodeName&&n.nodeName.lastIndexOf(`.`);if(r!==void 0&&r!==-1){let e=n.nodeName.substring(r+1);ju.indexOf(e)!==-1&&(n.nodeName=n.nodeName.substring(0,r),n.objectName=e)}if(n.propertyName===null||n.propertyName.length===0)throw Error(`THREE.PropertyBinding: can not parse propertyName from trackName: `+e);return n}static findNode(e,t){if(t===void 0||t===``||t===`.`||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(e){for(let r=0;r<e.length;r++){let i=e[r];if(i.name===t||i.uuid===t)return i;let a=n(i.children);if(a)return a}return null},r=n(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)e[t++]=n[r]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let t=this.node,n=this.parsedPath,r=n.objectName,i=n.propertyName,a=n.propertyIndex;if(t||(t=e.findNode(this.rootNode,n.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){V(`PropertyBinding: No target node found for track: `+this.path+`.`);return}if(r){let e=n.objectIndex;switch(r){case`materials`:if(!t.material){H(`PropertyBinding: Can not bind to material as node does not have a material.`,this);return}if(!t.material.materials){H(`PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.`,this);return}t=t.material.materials;break;case`bones`:if(!t.skeleton){H(`PropertyBinding: Can not bind to bones as node does not have a skeleton.`,this);return}t=t.skeleton.bones;for(let n=0;n<t.length;n++)if(t[n].name===e){e=n;break}break;case`map`:if(`map`in t){t=t.map;break}if(!t.material){H(`PropertyBinding: Can not bind to material as node does not have a material.`,this);return}if(!t.material.map){H(`PropertyBinding: Can not bind to material.map as node.material does not have a map.`,this);return}t=t.material.map;break;default:if(t[r]===void 0){H(`PropertyBinding: Can not bind to objectName of node undefined.`,this);return}t=t[r]}if(e!==void 0){if(t[e]===void 0){H(`PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.`,this,t);return}t=t[e]}}let o=t[i];if(o===void 0){let e=n.nodeName;H(`PropertyBinding: Trying to update property for track: `+e+`.`+i+` but it wasn't found.`,t);return}let s=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?s=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(s=this.Versioning.MatrixWorldNeedsUpdate);let c=this.BindingType.Direct;if(a!==void 0){if(i===`morphTargetInfluences`){if(!t.geometry){H(`PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.`,this);return}if(!t.geometry.morphAttributes){H(`PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.`,this);return}t.morphTargetDictionary[a]!==void 0&&(a=t.morphTargetDictionary[a])}c=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=a}else o.fromArray!==void 0&&o.toArray!==void 0?(c=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(c=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=i;this.getValue=this.GetterByBindingType[c],this.setValue=this.SetterByBindingTypeAndVersioning[c][s]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};Nu.Composite=Mu,Nu.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3},Nu.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2},Nu.prototype.GetterByBindingType=[Nu.prototype._getValue_direct,Nu.prototype._getValue_array,Nu.prototype._getValue_arrayElement,Nu.prototype._getValue_toArray],Nu.prototype.SetterByBindingTypeAndVersioning=[[Nu.prototype._setValue_direct,Nu.prototype._setValue_direct_setNeedsUpdate,Nu.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[Nu.prototype._setValue_array,Nu.prototype._setValue_array_setNeedsUpdate,Nu.prototype._setValue_array_setMatrixWorldNeedsUpdate],[Nu.prototype._setValue_arrayElement,Nu.prototype._setValue_arrayElement_setNeedsUpdate,Nu.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[Nu.prototype._setValue_fromArray,Nu.prototype._setValue_fromArray_setNeedsUpdate,Nu.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]],Ln=class{constructor(e,t,n,r){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,r)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,r){let i=this.elements;return i[0]=e,i[2]=t,i[1]=n,i[3]=r,this}},Ln.prototype.isMatrix2=!0;function Pu(e,t,n,r){let i=Fu(r);switch(n){case ur:return e*t;case hr:return e*t/i.components*i.byteLength;case gr:return e*t/i.components*i.byteLength;case _r:return e*t*2/i.components*i.byteLength;case vr:return e*t*2/i.components*i.byteLength;case dr:return e*t*3/i.components*i.byteLength;case fr:return e*t*4/i.components*i.byteLength;case yr:return e*t*4/i.components*i.byteLength;case br:case xr:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case Sr:case Cr:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case Tr:case Dr:return Math.max(e,16)*Math.max(t,8)/4;case wr:case Er:return Math.max(e,8)*Math.max(t,8)/2;case Or:case kr:case jr:case Mr:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case Ar:case Nr:case Pr:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case Fr:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case Ir:return Math.floor((e+4)/5)*Math.floor((t+3)/4)*16;case Lr:return Math.floor((e+4)/5)*Math.floor((t+4)/5)*16;case Rr:return Math.floor((e+5)/6)*Math.floor((t+4)/5)*16;case zr:return Math.floor((e+5)/6)*Math.floor((t+5)/6)*16;case Br:return Math.floor((e+7)/8)*Math.floor((t+4)/5)*16;case Vr:return Math.floor((e+7)/8)*Math.floor((t+5)/6)*16;case Hr:return Math.floor((e+7)/8)*Math.floor((t+7)/8)*16;case Ur:return Math.floor((e+9)/10)*Math.floor((t+4)/5)*16;case Wr:return Math.floor((e+9)/10)*Math.floor((t+5)/6)*16;case Gr:return Math.floor((e+9)/10)*Math.floor((t+7)/8)*16;case Kr:return Math.floor((e+9)/10)*Math.floor((t+9)/10)*16;case qr:return Math.floor((e+11)/12)*Math.floor((t+9)/10)*16;case Jr:return Math.floor((e+11)/12)*Math.floor((t+11)/12)*16;case Yr:case Xr:case Zr:return Math.ceil(e/4)*Math.ceil(t/4)*16;case Qr:case $r:return Math.ceil(e/4)*Math.ceil(t/4)*8;case ei:case ti:return Math.ceil(e/4)*Math.ceil(t/4)*16}throw Error(`Unable to determine texture byte length for ${n} format.`)}function Fu(e){switch(e){case Zn:case Qn:return{byteLength:1,components:1};case er:case $n:case ir:return{byteLength:2,components:1};case ar:case or:return{byteLength:2,components:4};case nr:case tr:case rr:return{byteLength:4,components:1};case cr:case lr:return{byteLength:4,components:3}}throw Error(`THREE.TextureUtils: Unknown texture type ${e}.`)}typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`register`,{detail:{revision:`187`}})),typeof window<`u`&&(window.__THREE__?V(`WARNING: Multiple instances of Three.js being imported.`):window.__THREE__=`187`);function Iu(){let e=null,t=!1,n=null,r=null;function i(t,a){r=e.requestAnimationFrame(i),n(t,a)}return{start:function(){t!==!0&&n!==null&&e!==null&&(r=e.requestAnimationFrame(i),t=!0)},stop:function(){e!==null&&e.cancelAnimationFrame(r),t=!1},setAnimationLoop:function(e){n=e},setContext:function(t){e=t}}}function Lu(e){let t=new WeakMap;function n(t,n){let r=t.array,i=t.usage,a=r.byteLength,o=e.createBuffer();e.bindBuffer(n,o),e.bufferData(n,r,i),t.onUploadCallback();let s;if(r instanceof Float32Array)s=e.FLOAT;else if(typeof Float16Array<`u`&&r instanceof Float16Array)s=e.HALF_FLOAT;else if(r instanceof Uint16Array)s=t.isFloat16BufferAttribute?e.HALF_FLOAT:e.UNSIGNED_SHORT;else if(r instanceof Int16Array)s=e.SHORT;else if(r instanceof Uint32Array)s=e.UNSIGNED_INT;else if(r instanceof Int32Array)s=e.INT;else if(r instanceof Int8Array)s=e.BYTE;else if(r instanceof Uint8Array)s=e.UNSIGNED_BYTE;else if(r instanceof Uint8ClampedArray)s=e.UNSIGNED_BYTE;else throw Error(`THREE.WebGLAttributes: Unsupported buffer data format: `+r);return{buffer:o,type:s,bytesPerElement:r.BYTES_PER_ELEMENT,version:t.version,size:a}}function r(t,n,r){let i=n.array,a=n.updateRanges;if(e.bindBuffer(r,t),a.length===0)e.bufferSubData(r,0,i);else{a.sort((e,t)=>e.start-t.start);let t=0;for(let e=1;e<a.length;e++){let n=a[t],r=a[e];r.start<=n.start+n.count+1?n.count=Math.max(n.count,r.start+r.count-n.start):(++t,a[t]=r)}a.length=t+1;for(let t=0,n=a.length;t<n;t++){let n=a[t];e.bufferSubData(r,n.start*i.BYTES_PER_ELEMENT,i,n.start,n.count)}n.clearUpdateRanges()}n.onUploadCallback()}function i(e){return e.isInterleavedBufferAttribute&&(e=e.data),t.get(e)}function a(n){n.isInterleavedBufferAttribute&&(n=n.data);let r=t.get(n);r&&(e.deleteBuffer(r.buffer),t.delete(n))}function o(e,i){if(e.isInterleavedBufferAttribute&&(e=e.data),e.isGLBufferAttribute){let n=t.get(e);(!n||n.version<e.version)&&t.set(e,{buffer:e.buffer,type:e.type,bytesPerElement:e.elementSize,version:e.version});return}let a=t.get(e);if(a===void 0)t.set(e,n(e,i));else if(a.version<e.version){if(a.size!==e.array.byteLength)throw Error(`THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.`);r(a.buffer,e,i),a.version=e.version}}return{get:i,remove:a,update:o}}var X={alphahash_fragment:`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,alphahash_pars_fragment:`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,alphamap_fragment:`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,alphamap_pars_fragment:`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,alphatest_fragment:`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,alphatest_pars_fragment:`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,aomap_fragment:`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,aomap_pars_fragment:`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,batching_pars_vertex:`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,batching_vertex:`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,begin_vertex:`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,beginnormal_vertex:`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,bsdfs:`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,iridescence_fragment:`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,bumpmap_pars_fragment:`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,clipping_planes_fragment:`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,clipping_planes_pars_fragment:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,clipping_planes_pars_vertex:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,clipping_planes_vertex:`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,color_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,color_pars_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,color_pars_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,color_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,common:`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,defaultnormal_vertex:`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,displacementmap_pars_vertex:`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,displacementmap_vertex:`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,emissivemap_fragment:`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,emissivemap_pars_fragment:`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,colorspace_fragment:`gl_FragColor = linearToOutputTexel( gl_FragColor );`,colorspace_pars_fragment:`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,envmap_fragment:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,envmap_common_pars_fragment:`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	uniform samplerCube envMap;
	#ifdef ENVMAP_TYPE_PMREM
		float roughnessToMip( const in float roughness ) {
			float r = clamp( roughness, 0.0, 1.0 );
			return ENVMAP_MAX_LOD * r * ( 2.0 - r );
		}
	#endif
#endif`,envmap_pars_fragment:`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,envmap_pars_vertex:`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,envmap_physical_pars_fragment:`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_PMREM
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureLod( envMap, envMapRotation * worldNormal, ENVMAP_MAX_LOD );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_PMREM
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureLod( envMap, envMapRotation * reflectVec, roughnessToMip( roughness ) );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_PMREM
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureLod( envMap, envMapRotation * retroVec, roughnessToMip( roughness ) );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_PMREM
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_PMREM
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,envmap_vertex:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,fog_vertex:`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,fog_pars_vertex:`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,fog_fragment:`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,fog_pars_fragment:`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,gradientmap_pars_fragment:`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,lightmap_pars_fragment:`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,lights_lambert_fragment:`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,lights_lambert_pars_fragment:`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,lights_pars_begin:`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,lights_toon_fragment:`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,lights_toon_pars_fragment:`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,lights_phong_fragment:`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,lights_phong_pars_fragment:`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,lights_physical_fragment:`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.045 );
material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef USE_DIFFUSE_ROUGHNESS
	float diffuseRoughnessFactor = diffuseRoughness;
	#ifdef USE_DIFFUSE_ROUGHNESSMAP
		diffuseRoughnessFactor *= texture2D( diffuseRoughnessMap, vDiffuseRoughnessMapUv ).r;
	#endif
	material.diffuseRoughness = saturate( diffuseRoughnessFactor );
#endif
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.045 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,lights_physical_pars_fragment:`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_DIFFUSE_ROUGHNESS
		float diffuseRoughness;
	#endif
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
#ifdef USE_DIFFUSE_ROUGHNESS
	const float EON_EPSILON = 1e-7;
	float FON_DirectionalAlbedo( const in float mu, const in float roughness, const in float A ) {
		float muComp = 1.0 - mu;
		float gOverPi = muComp * ( 0.0571085289 + muComp * ( 0.491881867 + muComp * ( - 0.332181442 + muComp * 0.0714429953 ) ) );
		return A * ( 1.0 + roughness * gOverPi );
	}
	vec3 BRDF_EON( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 diffuseColor, const in float roughness ) {
		vec3 rho = saturate( diffuseColor );
		if ( roughness <= EON_EPSILON ) return BRDF_Lambert( rho );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float s = dot( lightDir, viewDir ) - dotNL * dotNV;
		float sOverT = ( s > 0.0 ) ? s / max( max( dotNL, dotNV ), EON_EPSILON ) : s;
		float A = 1.0 / ( 1.0 + ( 0.5 - 2.0 / ( 3.0 * PI ) ) * roughness );
		vec3 singleScatter = rho * RECIPROCAL_PI * A * ( 1.0 + roughness * sOverT );
		float averageAlbedo = A * ( 1.0 + ( 2.0 / 3.0 - 28.0 / ( 15.0 * PI ) ) * roughness );
		float albedoV = FON_DirectionalAlbedo( dotNV, roughness, A );
		float albedoL = FON_DirectionalAlbedo( dotNL, roughness, A );
		vec3 rhoMultiScatter = rho * rho * averageAlbedo / max( vec3( EON_EPSILON ), vec3( 1.0 ) - rho * ( 1.0 - averageAlbedo ) );
		vec3 multiScatter = rhoMultiScatter * RECIPROCAL_PI
			* max( EON_EPSILON, 1.0 - albedoV )
			* max( EON_EPSILON, 1.0 - albedoL )
			/ max( EON_EPSILON, 1.0 - averageAlbedo );
		return singleScatter + multiScatter;
	}
	vec3 EON_DirectionalAlbedo( const in vec3 diffuseColor, const in float roughness, const in float dotNV ) {
		vec3 rho = saturate( diffuseColor );
		if ( roughness <= EON_EPSILON ) return rho;
		float A = 1.0 / ( 1.0 + ( 0.5 - 2.0 / ( 3.0 * PI ) ) * roughness );
		float directionalAlbedo = FON_DirectionalAlbedo( dotNV, roughness, A );
		float averageAlbedo = A * ( 1.0 + ( 2.0 / 3.0 - 28.0 / ( 15.0 * PI ) ) * roughness );
		vec3 rhoMultiScatter = rho * rho * averageAlbedo / max( vec3( EON_EPSILON ), vec3( 1.0 ) - rho * ( 1.0 - averageAlbedo ) );
		return rho * directionalAlbedo + rhoMultiScatter * ( 1.0 - directionalAlbedo );
	}
#endif
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = max( material.clearcoatRoughness, 0.045 );
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = max( material.roughness, 0.045 );
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float alphaT = max( material.alphaT, alpha );
		float V = V_GGX_SmithCorrelated_Anisotropic( alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	#ifdef USE_DIFFUSE_ROUGHNESS
		vec3 diffuseBRDF = BRDF_EON( directLight.direction, geometryViewDir, geometryNormal, material.diffuseColor, material.diffuseRoughness ) * ( 1.0 - material.metalness );
	#else
		vec3 diffuseBRDF = BRDF_Lambert( material.diffuseContribution );
	#endif
	reflectedLight.directDiffuse += irradiance * diffuseBRDF * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	#ifdef USE_DIFFUSE_ROUGHNESS
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		vec3 diffuseAlbedo = EON_DirectionalAlbedo( material.diffuseColor, material.diffuseRoughness, dotNV ) * ( 1.0 - material.metalness );
		vec3 diffuse = irradiance * RECIPROCAL_PI * diffuseAlbedo * ( 1.0 - singleScattering - multiScattering );
	#else
		vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#endif
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	#ifdef USE_DIFFUSE_ROUGHNESS
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		vec3 diffuse = EON_DirectionalAlbedo( material.diffuseColor, material.diffuseRoughness, dotNV ) * ( 1.0 - material.metalness ) * ( 1.0 - totalScatteringDielectric );
	#else
		vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	#endif
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,lights_fragment_begin:`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_LIGHT_PROBE_GRIDS > 0
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		int probeGrid = - 1;
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_LIGHT_PROBE_GRIDS; i ++ ) {
			if ( isInsideLightProbeGrid( probeWorldPos, probeWorldNormal, probesMin[ i ], probesMax[ i ], probesResolution[ i ] ) ) probeGrid = UNROLLED_LOOP_INDEX;
		}
		#pragma unroll_loop_end
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_LIGHT_PROBE_GRIDS; i ++ ) {
			if ( probeGrid == UNROLLED_LOOP_INDEX ) irradiance += getLightProbeGridIrradiance( probesSH[ i ], probesMin[ i ], probesMax[ i ], probesResolution[ i ], probeWorldPos, probeWorldNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,lights_fragment_maps:`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_PMREM )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,lights_fragment_end:`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,lightprobes_pars_fragment:`#if NUM_LIGHT_PROBE_GRIDS > 0
uniform highp sampler3D probesSH[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesMin[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesMax[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesResolution[ NUM_LIGHT_PROBE_GRIDS ];
bool isInsideLightProbeGrid( vec3 worldPos, vec3 worldNormal, vec3 probesMin, vec3 probesMax, vec3 probesResolution ) {
	vec3 spacing = ( probesMax - probesMin ) / probesResolution;
	vec3 samplePos = worldPos + worldNormal * spacing * 0.5;
	vec3 margin = spacing * 0.01;
	return all( greaterThanEqual( samplePos, probesMin - margin ) ) && all( lessThanEqual( samplePos, probesMax + margin ) );
}
vec3 getLightProbeGridIrradiance( highp sampler3D probesSH, vec3 probesMin, vec3 probesMax, vec3 probesResolution, vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 probeSpacing = gridRange / res;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.5 / res, 1.0 - 0.5 / res );
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,logdepthbuf_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,logdepthbuf_pars_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_pars_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,map_fragment:`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,map_pars_fragment:`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,map_particle_fragment:`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,map_particle_pars_fragment:`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,metalnessmap_fragment:`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,metalnessmap_pars_fragment:`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,morphinstance_vertex:`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,morphcolor_vertex:`#if defined( USE_MORPHCOLORS )
	#if defined( USE_COLOR_ALPHA )
		vColor *= morphTargetBaseInfluence;
	#elif defined( USE_COLOR )
		vColor.rgb *= morphTargetBaseInfluence;
	#endif
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor.rgb += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,morphnormal_vertex:`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,morphtarget_pars_vertex:`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,morphtarget_vertex:`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,normal_fragment_begin:`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,normal_fragment_maps:`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,normal_pars_fragment:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_pars_vertex:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_vertex:`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,normalmap_pars_fragment:`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,clearcoat_normal_fragment_begin:`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,clearcoat_normal_fragment_maps:`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,clearcoat_pars_fragment:`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,iridescence_pars_fragment:`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,opaque_fragment:`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,packing:`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,premultiplied_alpha_fragment:`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,project_vertex:`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,dithering_fragment:`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,dithering_pars_fragment:`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,roughnessmap_fragment:`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,roughnessmap_pars_fragment:`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,shadowmap_pars_fragment:`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				vec2 radius = shadowRadius * texelSize;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float lightDistance = length( lightToPosition );
			float depthRange = shadowCameraFar - shadowCameraNear;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float depthA = - shadowCameraNear / depthRange - shadowBias;
				float depthB = shadowCameraNear * shadowCameraFar / ( depthRange * lightDistance );
			#else
				float depthA = shadowCameraFar / depthRange + shadowBias;
				float depthB = - shadowCameraNear * shadowCameraFar / ( depthRange * lightDistance );
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			shadow = 0.0;
			for ( int i = 0; i < 5; i ++ ) {
				vec2 offset = vogelDiskSample( i, 5, phi );
				vec3 direction = bd3D + ( tangent * offset.x + bitangent * offset.y ) * texelSize;
				vec3 absDirection = abs( direction );
				float dp = depthA + depthB / max( max( absDirection.x, absDirection.y ), absDirection.z );
				shadow += texture( shadowMap, vec4( direction, dp ) );
			}
			shadow *= 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,shadowmap_pars_vertex:`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,shadowmap_vertex:`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,shadowmask_pars_fragment:`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,skinbase_vertex:`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,skinning_pars_vertex:`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,skinning_vertex:`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,skinnormal_vertex:`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,specularmap_fragment:`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,specularmap_pars_fragment:`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,tonemapping_fragment:`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,tonemapping_pars_fragment:`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,transmission_fragment:`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,transmission_pars_fragment:`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,uv_pars_fragment:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_DIFFUSE_ROUGHNESSMAP
	varying vec2 vDiffuseRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_pars_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_DIFFUSE_ROUGHNESSMAP
	uniform mat3 diffuseRoughnessMapTransform;
	varying vec2 vDiffuseRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DIFFUSE_ROUGHNESSMAP
	vDiffuseRoughnessMapUv = ( diffuseRoughnessMapTransform * vec3( DIFFUSE_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,worldpos_vertex:`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,background_vert:`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,background_frag:`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,backgroundCube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,backgroundCube_frag:`uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <envmap_common_pars_fragment>
void main() {
	#ifdef ENVMAP_TYPE_PMREM
		vec4 texColor = textureLod( envMap, backgroundRotation * vWorldDirection, roughnessToMip( backgroundBlurriness ) );
	#else
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,cube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,cube_frag:`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,depth_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,depth_frag:`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,distance_vert:`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,distance_frag:`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,equirect_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,equirect_frag:`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,linedashed_vert:`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,linedashed_frag:`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,meshbasic_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,meshbasic_frag:`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshlambert_vert:`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshlambert_frag:`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshmatcap_vert:`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,meshmatcap_frag:`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshnormal_vert:`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,meshnormal_frag:`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,meshphong_vert:`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshphong_frag:`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshphysical_vert:`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,meshphysical_frag:`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DIFFUSE_ROUGHNESS
	uniform float diffuseRoughness;
	#ifdef USE_DIFFUSE_ROUGHNESSMAP
		uniform sampler2D diffuseRoughnessMap;
	#endif
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshtoon_vert:`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshtoon_frag:`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,points_vert:`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,points_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,shadow_vert:`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,shadow_frag:`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,sprite_vert:`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,sprite_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`},Z={common:{diffuse:{value:new J(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new K},alphaMap:{value:null},alphaMapTransform:{value:new K},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new K}},envmap:{envMap:{value:null},envMapRotation:{value:new K},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new K}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new K}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new K},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new K},normalScale:{value:new W(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new K},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new K}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new K}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new K}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new J(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:[]},probesMin:{value:[]},probesMax:{value:[]},probesResolution:{value:[]}},points:{diffuse:{value:new J(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new K},alphaTest:{value:0},uvTransform:{value:new K}},sprite:{diffuse:{value:new J(16777215)},opacity:{value:1},center:{value:new W(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new K},alphaMap:{value:null},alphaMapTransform:{value:new K},alphaTest:{value:0}}},Ru={basic:{uniforms:Cl([Z.common,Z.specularmap,Z.envmap,Z.aomap,Z.lightmap,Z.fog]),vertexShader:X.meshbasic_vert,fragmentShader:X.meshbasic_frag},lambert:{uniforms:Cl([Z.common,Z.specularmap,Z.envmap,Z.aomap,Z.lightmap,Z.emissivemap,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.fog,Z.lights,{emissive:{value:new J(0)},envMapIntensity:{value:1}}]),vertexShader:X.meshlambert_vert,fragmentShader:X.meshlambert_frag},phong:{uniforms:Cl([Z.common,Z.specularmap,Z.envmap,Z.aomap,Z.lightmap,Z.emissivemap,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.fog,Z.lights,{emissive:{value:new J(0)},specular:{value:new J(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:X.meshphong_vert,fragmentShader:X.meshphong_frag},standard:{uniforms:Cl([Z.common,Z.envmap,Z.aomap,Z.lightmap,Z.emissivemap,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.roughnessmap,Z.metalnessmap,Z.fog,Z.lights,{emissive:{value:new J(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:X.meshphysical_vert,fragmentShader:X.meshphysical_frag},toon:{uniforms:Cl([Z.common,Z.aomap,Z.lightmap,Z.emissivemap,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.gradientmap,Z.fog,Z.lights,{emissive:{value:new J(0)}}]),vertexShader:X.meshtoon_vert,fragmentShader:X.meshtoon_frag},matcap:{uniforms:Cl([Z.common,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.fog,{matcap:{value:null}}]),vertexShader:X.meshmatcap_vert,fragmentShader:X.meshmatcap_frag},points:{uniforms:Cl([Z.points,Z.fog]),vertexShader:X.points_vert,fragmentShader:X.points_frag},dashed:{uniforms:Cl([Z.common,Z.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:X.linedashed_vert,fragmentShader:X.linedashed_frag},depth:{uniforms:Cl([Z.common,Z.displacementmap]),vertexShader:X.depth_vert,fragmentShader:X.depth_frag},normal:{uniforms:Cl([Z.common,Z.bumpmap,Z.normalmap,Z.displacementmap,{opacity:{value:1}}]),vertexShader:X.meshnormal_vert,fragmentShader:X.meshnormal_frag},sprite:{uniforms:Cl([Z.sprite,Z.fog]),vertexShader:X.sprite_vert,fragmentShader:X.sprite_frag},background:{uniforms:{uvTransform:{value:new K},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:X.background_vert,fragmentShader:X.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new K}},vertexShader:X.backgroundCube_vert,fragmentShader:X.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:X.cube_vert,fragmentShader:X.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:X.equirect_vert,fragmentShader:X.equirect_frag},distance:{uniforms:Cl([Z.common,Z.displacementmap,{referencePosition:{value:new G},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:X.distance_vert,fragmentShader:X.distance_frag},shadow:{uniforms:Cl([Z.lights,Z.fog,{color:{value:new J(0)},opacity:{value:1}}]),vertexShader:X.shadow_vert,fragmentShader:X.shadow_frag}};Ru.physical={uniforms:Cl([Ru.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new K},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new K},clearcoatNormalScale:{value:new W(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new K},diffuseRoughness:{value:0},diffuseRoughnessMap:{value:null},diffuseRoughnessMapTransform:{value:new K},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new K},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new K},sheen:{value:0},sheenColor:{value:new J(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new K},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new K},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new K},transmissionSamplerSize:{value:new W},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new K},attenuationDistance:{value:0},attenuationColor:{value:new J(0)},specularColor:{value:new J(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new K},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new K},anisotropyVector:{value:new W},anisotropyMap:{value:null},anisotropyMapTransform:{value:new K}}]),vertexShader:X.meshphysical_vert,fragmentShader:X.meshphysical_frag};var zu={r:0,b:0,g:0},Bu=new q,Vu=new K;Vu.set(-1,0,0,0,1,0,0,0,1);function Hu(e,t,n,r,i,a){let o=new J(0),s=i===!0?0:1,c,l,u=null,d=0,f=null;function p(e){let n=e.isScene===!0?e.background:null;if(n&&n.isTexture){let r=e.backgroundBlurriness>0;n=t.get(n,r)}return n}function m(t){let r=!1,i=p(t);i===null?g(o,s):i&&i.isColor&&(g(i,1),r=!0);let c=e.xr.getEnvironmentBlendMode();c===`additive`?n.buffers.color.setClear(0,0,0,1,a):c===`alpha-blend`&&n.buffers.color.setClear(0,0,0,0,a),(e.autoClear||r)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil))}function h(t,n){let i=p(n);i&&i.isCubeTexture?(l===void 0&&(l=new Os(new yc(1,1,1),new Al({name:`BackgroundCubeMaterial`,uniforms:Sl(Ru.backgroundCube.uniforms),vertexShader:Ru.backgroundCube.vertexShader,fragmentShader:Ru.backgroundCube.fragmentShader,side:1,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute(`normal`),l.geometry.deleteAttribute(`uv`),l.onBeforeRender=function(e,t,n){this.matrixWorld.copyPosition(n.matrixWorld)},Object.defineProperty(l.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),r.update(l)),l.material.uniforms.envMap.value=i,l.material.uniforms.backgroundBlurriness.value=n.backgroundBlurriness,l.material.uniforms.backgroundIntensity.value=n.backgroundIntensity,l.material.uniforms.backgroundRotation.value.setFromMatrix4(Bu.makeRotationFromEuler(n.backgroundRotation)).transpose(),i.isRenderTargetTexture===!1&&l.material.uniforms.backgroundRotation.value.premultiply(Vu),l.material.toneMapped=Ki.getTransfer(i.colorSpace)!==pi,(u!==i||d!==i.version||f!==e.toneMapping)&&(l.material.needsUpdate=!0,u=i,d=i.version,f=e.toneMapping),l.layers.enableAll(),t.unshift(l,l.geometry,l.material,0,0,null)):i&&i.isTexture&&(c===void 0&&(c=new Os(new yl(2,2),new Al({name:`BackgroundMaterial`,uniforms:Sl(Ru.background.uniforms),vertexShader:Ru.background.vertexShader,fragmentShader:Ru.background.fragmentShader,side:0,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute(`normal`),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),r.update(c)),c.material.uniforms.t2D.value=i,c.material.uniforms.backgroundIntensity.value=n.backgroundIntensity,c.material.toneMapped=Ki.getTransfer(i.colorSpace)!==pi,i.matrixAutoUpdate===!0&&i.updateMatrix(),c.material.uniforms.uvTransform.value.copy(i.matrix),(u!==i||d!==i.version||f!==e.toneMapping)&&(c.material.needsUpdate=!0,u=i,d=i.version,f=e.toneMapping),c.layers.enableAll(),t.unshift(c,c.geometry,c.material,0,0,null))}function g(t,r){t.getRGB(zu,El(e)),n.buffers.color.setClear(zu.r,zu.g,zu.b,r,a)}function _(){l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return o},setClearColor:function(e,t=1){o.set(e),s=t,g(o,s)},getClearAlpha:function(){return s},setClearAlpha:function(e){s=e,g(o,s)},render:m,addToRenderList:h,dispose:_}}function Uu(e,t){let n=e.getParameter(e.MAX_VERTEX_ATTRIBS),r={},i=f(null),a=i,o=!1;function s(n,r,i,s,c){let u=!1,f=d(n,s,i,r);a!==f&&(a=f,l(a.object)),u=p(n,s,i,c),u&&m(n,s,i,c),c!==null&&t.update(c,e.ELEMENT_ARRAY_BUFFER),(u||o)&&(o=!1,b(n,r,i,s),c!==null&&e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,t.get(c).buffer))}function c(){return e.createVertexArray()}function l(t){return e.bindVertexArray(t)}function u(t){return e.deleteVertexArray(t)}function d(e,t,n,i){let a=i.wireframe===!0,o=r[t.id];o===void 0&&(o={},r[t.id]=o);let s=e.isInstancedMesh===!0?e.id:0,l=o[s];l===void 0&&(l={},o[s]=l);let u=l[n.id];u===void 0&&(u={},l[n.id]=u);let d=u[a];return d===void 0&&(d=f(c()),u[a]=d),d}function f(e){let t=[],r=[],i=[];for(let e=0;e<n;e++)t[e]=0,r[e]=0,i[e]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:t,enabledAttributes:r,attributeDivisors:i,object:e,attributes:{},index:null}}function p(e,t,n,r){let i=a.attributes,o=t.attributes,s=0,c=n.getAttributes();for(let t in c)if(c[t].location>=0){let n=i[t],r=o[t];if(r===void 0&&(t===`instanceMatrix`&&e.instanceMatrix&&(r=e.instanceMatrix),t===`instanceColor`&&e.instanceColor&&(r=e.instanceColor)),n===void 0||n.attribute!==r||r&&n.data!==r.data)return!0;s++}return a.attributesNum!==s||a.index!==r}function m(e,t,n,r){let i={},o=t.attributes,s=0,c=n.getAttributes();for(let t in c)if(c[t].location>=0){let n=o[t];n===void 0&&(t===`instanceMatrix`&&e.instanceMatrix&&(n=e.instanceMatrix),t===`instanceColor`&&e.instanceColor&&(n=e.instanceColor));let r={};r.attribute=n,n&&n.data&&(r.data=n.data),i[t]=r,s++}a.attributes=i,a.attributesNum=s,a.index=r}function h(){let e=a.newAttributes;for(let t=0,n=e.length;t<n;t++)e[t]=0}function g(e){_(e,0)}function _(t,n){let r=a.newAttributes,i=a.enabledAttributes,o=a.attributeDivisors;r[t]=1,i[t]===0&&(e.enableVertexAttribArray(t),i[t]=1),o[t]!==n&&(e.vertexAttribDivisor(t,n),o[t]=n)}function v(){let t=a.newAttributes,n=a.enabledAttributes;for(let r=0,i=n.length;r<i;r++)n[r]!==t[r]&&(e.disableVertexAttribArray(r),n[r]=0)}function y(t,n,r,i,a,o,s){s===!0?e.vertexAttribIPointer(t,n,r,a,o):e.vertexAttribPointer(t,n,r,i,a,o)}function b(n,r,i,a){h();let o=a.attributes,s=i.getAttributes(),c=r.defaultAttributeValues;for(let r in s){let i=s[r];if(i.location>=0){let s=o[r];if(s===void 0&&(r===`instanceMatrix`&&n.instanceMatrix&&(s=n.instanceMatrix),r===`instanceColor`&&n.instanceColor&&(s=n.instanceColor)),s!==void 0){let r=s.normalized,o=s.itemSize,c=t.get(s);if(c===void 0)continue;let l=c.buffer,u=c.type,d=c.bytesPerElement,f=u===e.INT||u===e.UNSIGNED_INT||s.gpuType===1013;if(s.isInterleavedBufferAttribute){let t=s.data,c=t.isInterleavedBuffer===!0?t.stride:t.itemSize,p=s.offset;if(t.isInstancedInterleavedBuffer||t.isInstancedBufferAttribute){for(let e=0;e<i.locationSize;e++)_(i.location+e,t.meshPerAttribute);n.isInstancedMesh!==!0&&a._maxInstanceCount===void 0&&(a._maxInstanceCount=t.meshPerAttribute*t.count)}else for(let e=0;e<i.locationSize;e++)g(i.location+e);e.bindBuffer(e.ARRAY_BUFFER,l);for(let e=0;e<i.locationSize;e++)y(i.location+e,o/i.locationSize,u,r,c*d,(p+o/i.locationSize*e)*d,f)}else{if(s.isInstancedBufferAttribute){for(let e=0;e<i.locationSize;e++)_(i.location+e,s.meshPerAttribute);n.isInstancedMesh!==!0&&a._maxInstanceCount===void 0&&(a._maxInstanceCount=s.meshPerAttribute*s.count)}else for(let e=0;e<i.locationSize;e++)g(i.location+e);e.bindBuffer(e.ARRAY_BUFFER,l);for(let e=0;e<i.locationSize;e++)y(i.location+e,o/i.locationSize,u,r,o*d,o/i.locationSize*e*d,f)}}else if(c!==void 0){let t=c[r];if(t!==void 0)switch(t.length){case 2:e.vertexAttrib2fv(i.location,t);break;case 3:e.vertexAttrib3fv(i.location,t);break;case 4:e.vertexAttrib4fv(i.location,t);break;default:e.vertexAttrib1fv(i.location,t)}}}}v()}function x(){T();for(let e in r){let t=r[e];for(let e in t){let n=t[e];for(let e in n){let t=n[e];for(let e in t)u(t[e].object),delete t[e];delete n[e]}}delete r[e]}}function S(e){if(r[e.id]===void 0)return;let t=r[e.id];for(let e in t){let n=t[e];for(let e in n){let t=n[e];for(let e in t)u(t[e].object),delete t[e];delete n[e]}}delete r[e.id]}function C(e){for(let t in r){let n=r[t];for(let t in n){let r=n[t];if(r[e.id]===void 0)continue;let i=r[e.id];for(let e in i)u(i[e].object),delete i[e];delete r[e.id]}}}function w(e){for(let t in r){let n=r[t],i=e.isInstancedMesh===!0?e.id:0,a=n[i];if(a!==void 0){for(let e in a){let t=a[e];for(let e in t)u(t[e].object),delete t[e];delete a[e]}delete n[i],Object.keys(n).length===0&&delete r[t]}}}function T(){E(),o=!0,a!==i&&(a=i,l(a.object))}function E(){i.geometry=null,i.program=null,i.wireframe=!1}return{setup:s,reset:T,resetDefaultState:E,dispose:x,releaseStatesOfGeometry:S,releaseStatesOfObject:w,releaseStatesOfProgram:C,initAttributes:h,enableAttribute:g,disableUnusedAttributes:v}}function Wu(e,t,n){let r;function i(e){r=e}function a(t,i){e.drawArrays(r,t,i),n.update(i,r,1)}function o(t,i,a){a!==0&&(e.drawArraysInstanced(r,t,i,a),n.update(i,r,a))}function s(e,i,a){if(a===0)return;t.get(`WEBGL_multi_draw`).multiDrawArraysWEBGL(r,e,0,i,0,a);let o=0;for(let e=0;e<a;e++)o+=i[e];n.update(o,r,1)}this.setMode=i,this.render=a,this.renderInstances=o,this.renderMultiDraw=s}function Gu(e,t,n,r){let i;function a(){if(i!==void 0)return i;if(t.has(`EXT_texture_filter_anisotropic`)===!0){let n=t.get(`EXT_texture_filter_anisotropic`);i=e.getParameter(n.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function o(t){return t===1023||r.convert(t)===e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT)}function s(n){let i=n===1016&&(t.has(`EXT_color_buffer_half_float`)||t.has(`EXT_color_buffer_float`));return!(n!==1009&&n!==1015&&!i&&r.convert(n)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE))}function c(t){if(t===`highp`){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return`highp`;t=`mediump`}return t===`mediump`&&e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0?`mediump`:`lowp`}let l=n.precision===void 0?`highp`:n.precision,u=c(l);u!==l&&(V(`WebGLRenderer:`,l,`not supported, using`,u,`instead.`),l=u);let d=n.reversedDepthBuffer===!0&&t.has(`EXT_clip_control`),f=n.logarithmicDepthBuffer===!0&&d===!1;n.reversedDepthBuffer===!0&&d===!1&&V(`WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.`),n.logarithmicDepthBuffer===!0&&d===!0&&V(`WebGLRenderer: Logarithmic depth buffer is ignored when reversed depth buffer is enabled.`);let p=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),m=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),h=e.getParameter(e.MAX_TEXTURE_SIZE),g=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),_=e.getParameter(e.MAX_VERTEX_ATTRIBS),v=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),y=e.getParameter(e.MAX_VARYING_VECTORS),b=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),x=e.getParameter(e.MAX_SAMPLES),S=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:a,getMaxPrecision:c,textureFormatReadable:o,textureTypeReadable:s,precision:l,logarithmicDepthBuffer:f,reversedDepthBuffer:d,maxTextures:p,maxVertexTextures:m,maxTextureSize:h,maxCubemapSize:g,maxAttributes:_,maxVertexUniforms:v,maxVaryings:y,maxFragmentUniforms:b,maxSamples:x,samples:S}}function Ku(e){let t=this,n=null,r=0,i=!1,a=!1,o=new Ko,s=new K,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(e,t){let n=e.length!==0||t||r!==0||i;return i=t,r=e.length,n},this.beginShadows=function(){a=!0,u(null)},this.endShadows=function(){a=!1},this.setGlobalState=function(e,t){n=u(e,t,0)},this.setState=function(t,o,s){let d=t.clippingPlanes,f=t.clipIntersection,p=t.clipShadows,m=e.get(t);if(!i||d===null||d.length===0||a&&!p)a?u(null):l();else{let e=a?0:r,t=e*4,i=m.clippingState||null;c.value=i,i=u(d,o,t,s);for(let e=0;e!==t;++e)i[e]=n[e];m.clippingState=i,this.numIntersection=f?this.numPlanes:0,this.numPlanes+=e}};function l(){c.value!==n&&(c.value=n,c.needsUpdate=r>0),t.numPlanes=r,t.numIntersection=0}function u(e,n,r,i){let a=e===null?0:e.length,l=null;if(a!==0){if(l=c.value,i!==!0||l===null){let t=r+a*4,i=n.matrixWorldInverse;s.getNormalMatrix(i),(l===null||l.length<t)&&(l=new Float32Array(t));for(let t=0,n=r;t!==a;++t,n+=4)o.copy(e[t]).applyMatrix4(i,s),o.normal.toArray(l,n),l[n+3]=o.constant}c.value=l,c.needsUpdate=!0}return t.numPlanes=a,t.numIntersection=0,l}}var qu=class extends aa{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},r=[n,n,n,n,n,n];this.texture=new mc(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new yc(5,5,5),i=new Al({name:`CubemapFromEquirect`,uniforms:Sl(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:1,blending:0});i.uniforms.tEquirect.value=t;let a=new Os(r,i),o=t.minFilter;return t.minFilter===1008&&(t.minFilter=Jn),new bu(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,n=!0,r=!0){let i=e.getRenderTarget();for(let i=0;i<6;i++)e.setRenderTarget(this,i),e.clear(t,n,r);e.setRenderTarget(i)}},Ju=256,Yu=3,Xu=20,Zu=256,Qu=16,$u=3,ed=new G,td=new J,nd=class e{constructor(e){this._renderer=e,this._cubeSize=0,this._sourceTarget=null,this._cubeCamera=new bu(1,10,null),this._boxMesh=new Os(new yc(5,5,5),null),this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null,this._integrationMaterial=null}fromScene(e,t=0,n=.1,r=100,i={}){let{size:a=256,position:o=ed}=i,s=this._renderer;this._setSize(a);let c=this._allocateTarget(),l=this._getSourceTarget(!0);t>0&&(l.texture.mipmapsAutoUpdate=!1);let u=s.autoClear,d=s.autoClearColor,f=s.autoClearDepth,p=s.autoClearStencil,m=e.background;s.autoClear=!0,s.autoClearColor=!0,s.autoClearDepth=!0,s.autoClearStencil=!0,m===null&&(e.background=s.getClearColor(td));let h=new bu(n,r,l);return h.position.copy(o),h.update(s,e),s.autoClear=u,s.autoClearColor=d,s.autoClearDepth=f,s.autoClearStencil=p,e.background=m,t>0&&(l.texture.mipmapsAutoUpdate=!0,this._blur(c,t)),this._applyPMREM(c),c}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=ld(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=cd(),this._compileMaterial(this._equirectMaterial))}dispose(){this._sourceTarget!==null&&this._sourceTarget.dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._integrationMaterial!==null&&this._integrationMaterial.dispose(),this._boxMesh.geometry.dispose()}static lodToRoughness(e,t){return t>0?1-Math.sqrt(1-e/t):0}_setSize(e){this._cubeSize=Math.max(Ju,Fi(e))}_fromTexture(e,t){e.mapping===301||e.mapping===302?this._setSize(e.image.length===0?Ju:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4);let n=t||this._allocateTarget();return this._textureToCubemap(e),this._applyPMREM(n),n}_allocateTarget(){let e=this._cubeSize,t=rd(e,!1,!1),n=Math.log2(e)-Yu;for(let r=0;r<=n;r++)t.texture.mipmaps.push({width:e>>r,height:e>>r});return t.texture.name=`PMREM`,t.texture.isPMREMTexture=!0,t}_getSourceTarget(e=!1){let t=this._cubeSize,n=this._sourceTarget;return(n===null||n.width!==t||e&&n.depthBuffer===!1)&&(n!==null&&n.dispose(),this._sourceTarget=rd(t,!0,e)),this._sourceTarget}_compileMaterial(e){this._boxMesh.material=e,this._renderer.compile(this._boxMesh,this._cubeCamera.children[0])}_renderCube(e,t,n){let r=this._boxMesh,i=this._cubeCamera;r.material=n,i.renderTarget=e,i.activeMipmapLevel=t;let a=e.width>>t;e.viewport.set(0,0,a,a),i.update(this._renderer,r),e.viewport.set(0,0,e.width,e.height)}_textureToCubemap(e){let t;e.mapping===301||e.mapping===302?(this._cubemapMaterial===null&&(this._cubemapMaterial=ld()),t=this._cubemapMaterial,t.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):(this._equirectMaterial===null&&(this._equirectMaterial=cd()),t=this._equirectMaterial),t.uniforms.envMap.value=e,this._renderCube(this._getSourceTarget(),0,t)}_applyPMREM(t){this._ggxMaterial===null&&(this._ggxMaterial=ad(),this._integrationMaterial=od());let n=this._cubeSize,r=t.texture.mipmaps.length-1,i=this._ggxMaterial.uniforms;i.envMap.value=this._sourceTarget.texture;let a=this._integrationMaterial.uniforms;a.envMap.value=this._sourceTarget.texture,a.sourceLod.value=Math.log2(n/Qu);for(let o=0;o<=r;o++){let s=e.lodToRoughness(o,r);if(o>r-$u)a.roughness.value=s,this._renderCube(t,o,this._integrationMaterial);else{let e=s>0?Math.log2(n)+.5*Math.log2(6/(Zu*s**4))+.5:0;i.roughness.value=s,i.lodBias.value=e,this._renderCube(t,o,this._ggxMaterial)}}}_blur(e,t){this._blurMaterial===null&&(this._blurMaterial=sd());let n=this._blurMaterial,r=n.uniforms,i=this._sourceTarget;r.sigma.value=Math.min(t,Math.PI)/Math.SQRT2,r.envMap.value=i.texture,this._renderCube(e,0,n),r.envMap.value=e.texture,this._renderCube(i,0,n)}};function rd(e,t,n){return new qu(e,{minFilter:Xn,generateMipmaps:t,type:ir,colorSpace:di,depthBuffer:n})}function id(e,t,n){return new Al({name:e,uniforms:t,vertexShader:X.cube_vert,fragmentShader:n,side:1,blending:0,depthTest:!1,depthWrite:!1})}function ad(){return id(`PMREMGGXConvolution`,{envMap:{value:null},roughness:{value:0},lodBias:{value:0}},`

		#define GGX_SAMPLES ${Zu}u

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float roughness;
		uniform float lodBias;

		#include <common>

		// Van der Corput radical inverse
		float radicalInverse_VdC( uint bits ) {

			bits = ( bits << 16u ) | ( bits >> 16u );
			bits = ( ( bits & 0x55555555u ) << 1u ) | ( ( bits & 0xAAAAAAAAu ) >> 1u );
			bits = ( ( bits & 0x33333333u ) << 2u ) | ( ( bits & 0xCCCCCCCCu ) >> 2u );
			bits = ( ( bits & 0x0F0F0F0Fu ) << 4u ) | ( ( bits & 0xF0F0F0F0u ) >> 4u );
			bits = ( ( bits & 0x00FF00FFu ) << 8u ) | ( ( bits & 0xFF00FF00u ) >> 8u );
			return float( bits ) * 2.3283064365386963e-10; // / 0x100000000

		}

		// Hammersley sequence
		vec2 hammersley( uint i, uint N ) {

			return vec2( float( i ) / float( N ), radicalInverse_VdC( i ) );

		}

		void main() {

			vec3 N = normalize( vWorldDirection );

			// For very low roughness, just sample the environment directly
			if ( roughness < 0.001 ) {

				gl_FragColor = vec4( textureLod( envMap, N, 0.0 ).rgb, 1.0 );
				return;

			}

			float alpha = roughness * roughness;
			float alpha2 = alpha * alpha;

			// Tangent space basis for VNDF sampling
			vec3 up = abs( N.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
			vec3 tangent = normalize( cross( up, N ) );
			vec3 bitangent = cross( N, tangent );

			vec3 prefilteredColor = vec3( 0.0 );
			float totalWeight = 0.0;

			for ( uint i = 0u; i < GGX_SAMPLES; i ++ ) {

				vec2 Xi = hammersley( i, GGX_SAMPLES );

				// With V = N, sample the reflected direction directly.
				float invQ = 1.0 / ( 1.0 - Xi.x + alpha2 * Xi.x );
				float NdotL = ( 1.0 - Xi.x - alpha2 * Xi.x ) * invQ;

				if ( NdotL > 0.0 ) {

					float phi = 2.0 * PI * Xi.y;
					float sinTheta = 2.0 * alpha * sqrt( Xi.x * ( 1.0 - Xi.x ) ) * invQ;
					vec3 L = N * NdotL + ( tangent * cos( phi ) + bitangent * sin( phi ) ) * sinTheta;

					// Match the source mip to the sample's solid angle. The terms
					// independent of the sample are precomputed in lodBias.
					float d = alpha2 * invQ;
					float lod = max( log2( d ) + lodBias, 0.0 );

					// Weight by NdotL for the split-sum approximation
					prefilteredColor += textureLod( envMap, L, lod ).rgb * NdotL;
					totalWeight += NdotL;

				}

			}

			gl_FragColor = vec4( prefilteredColor / totalWeight, 1.0 );

		}
	`)}function od(){return id(`PMREMGGXIntegration`,{envMap:{value:null},roughness:{value:0},sourceLod:{value:0},sourceSize:{value:Qu}},`

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float roughness;
		uniform float sourceLod;
		uniform int sourceSize;

		void main() {

			vec3 N = normalize( vWorldDirection );

			float alpha = roughness * roughness;
			float alpha2 = alpha * alpha;

			float texelSize = 2.0 / float( sourceSize );

			vec3 prefilteredColor = vec3( 0.0 );
			float totalWeight = 0.0;

			// Pair opposite texels: only the one in N's hemisphere contributes.
			for ( int face = 0; face < 3; face ++ ) {

				for ( int y = 0; y < sourceSize; y ++ ) {

					for ( int x = 0; x < sourceSize; x ++ ) {

						vec2 uv = ( vec2( x, y ) + 0.5 ) * texelSize - 1.0;
						vec3 texelDirection = face == 0 ? vec3( 1.0, uv ) : ( face == 1 ? vec3( uv.x, 1.0, uv.y ) : vec3( uv, 1.0 ) );

						float invDistance = inversesqrt( 1.0 + dot( uv, uv ) );
						float NdotL = dot( N, texelDirection );
						texelDirection *= NdotL < 0.0 ? - 1.0 : 1.0;
						NdotL = abs( NdotL ) * invDistance;

						// With V = N, NdotH squared is ( 1 + NdotL ) / 2. Common factors
						// in the GGX distribution and texel solid angle cancel when normalized.
						float d = 1.0 + alpha2 + ( alpha2 - 1.0 ) * NdotL;
						float weight = NdotL * invDistance * invDistance * invDistance / ( d * d );

						prefilteredColor += textureLod( envMap, texelDirection, sourceLod ).rgb * weight;
						totalWeight += weight;

					}

				}

			}

			gl_FragColor = vec4( prefilteredColor / totalWeight, 1.0 );

		}
	`)}function sd(){return id(`PMREMSphericalGaussianBlur`,{envMap:{value:null},sigma:{value:0}},`

		#define SAMPLES ${Xu}
		#define GOLDEN_ANGLE 2.39996322973

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float sigma;

		#include <common>

		void main() {

			vec3 outputDirection = normalize( vWorldDirection );

			vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
			vec3 tangent = normalize( cross( up, outputDirection ) );
			vec3 bitangent = cross( outputDirection, tangent );

			// Truncate the kernel at three standard deviations or at the antipode.
			float thetaMax = min( 3.0 * sigma, PI );
			float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

			vec3 accumColor = vec3( 0.0 );
			float accumWeight = 0.0;

			for ( int i = 0; i < SAMPLES; i ++ ) {

				// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
				float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
				float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
				float phi = float( i ) * GOLDEN_ANGLE;

				vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
				vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

				// Correct the planar sample density to solid angle.
				float weight = sin( theta ) / theta;

				accumColor += weight * textureLod( envMap, sampleDirection, 0.0 ).rgb;
				accumWeight += weight;

			}

			gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

		}
	`)}function cd(){return id(`PMREMEquirectangularToCubemap`,{envMap:{value:null}},`

		varying vec3 vWorldDirection;

		uniform sampler2D envMap;

		#include <common>

		void main() {

			// Average four subpixel samples to preserve small, bright features.
			vec3 direction = normalize( vWorldDirection );
			vec3 dx = dFdx( direction ) * 0.25;
			vec3 dy = dFdy( direction ) * 0.25;

			vec3 color = textureLod( envMap, equirectUv( normalize( direction - dx - dy ) ), 0.0 ).rgb;
			color += textureLod( envMap, equirectUv( normalize( direction + dx - dy ) ), 0.0 ).rgb;
			color += textureLod( envMap, equirectUv( normalize( direction - dx + dy ) ), 0.0 ).rgb;
			color += textureLod( envMap, equirectUv( normalize( direction + dx + dy ) ), 0.0 ).rgb;
			gl_FragColor = vec4( color * 0.25, 1.0 );

		}
	`)}function ld(){return id(`PMREMCubemapToCubemap`,{envMap:{value:null},flipEnvMap:{value:-1}},`

		varying vec3 vWorldDirection;

		uniform samplerCube envMap;
		uniform float flipEnvMap;

		void main() {

			gl_FragColor = vec4( textureCube( envMap, vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) ).rgb, 1.0 );

		}
	`)}function ud(e){let t=new WeakMap,n=new WeakMap,r=null;function i(e,t=!1){return e==null?null:t?o(e):a(e)}function a(n){if(n&&n.isTexture){let r=n.mapping;if(r===303||r===304){if(t.has(n)){let e=t.get(n).texture;return s(e,n.mapping)}{let r=n.image;if(r&&r.height>0){let i=new qu(r.height);return i.fromEquirectangularTexture(e,n),t.set(n,i),n.addEventListener(`dispose`,l),s(i.texture,n.mapping)}return null}}}return n}function o(t){if(t&&t.isTexture&&t.isPMREMTexture!==!0){let i=t.mapping,a=i===303||i===304,o=i===301||i===302;if(a||o){let i=n.get(t),s=i===void 0?0:i.texture.pmremVersion;if(t.isRenderTargetTexture&&t.pmremVersion!==s)return r===null&&(r=new nd(e)),i=a?r.fromEquirectangular(t,i):r.fromCubemap(t,i),i.texture.pmremVersion=t.pmremVersion,n.set(t,i),i.texture;if(i!==void 0)return i.texture;{let s=t.image;return a&&s&&s.height>0||o&&s&&c(s)?(r===null&&(r=new nd(e)),i=a?r.fromEquirectangular(t):r.fromCubemap(t),i.texture.pmremVersion=t.pmremVersion,n.set(t,i),t.addEventListener(`dispose`,u),i.texture):null}}}return t}function s(e,t){return t===303?e.mapping=301:t===304&&(e.mapping=302),e}function c(e){let t=0;for(let n=0;n<6;n++)e[n]!==void 0&&t++;return t===6}function l(e){let n=e.target;n.removeEventListener(`dispose`,l);let r=t.get(n);r!==void 0&&(t.delete(n),r.dispose())}function u(e){let t=e.target;t.removeEventListener(`dispose`,u);let r=n.get(t);r!==void 0&&(n.delete(t),r.dispose())}function d(){t=new WeakMap,n=new WeakMap,r!==null&&(r.dispose(),r=null)}return{get:i,dispose:d}}function dd(e){let t={};function n(n){if(t[n]!==void 0)return t[n];let r=e.getExtension(n);return t[n]=r,r}return{has:function(e){return n(e)!==null},init:function(){n(`EXT_color_buffer_float`),n(`WEBGL_clip_cull_distance`),n(`OES_texture_float_linear`),n(`EXT_color_buffer_half_float`),n(`WEBGL_multisampled_render_to_texture`),n(`WEBGL_render_shared_exponent`)},get:function(e){let t=n(e);return t===null&&Ti(`WebGLRenderer: `+e+` extension not supported.`),t}}}function fd(e,t,n,r){let i={},a=new WeakMap,o=new FinalizationRegistry(e=>delete i[e]);function s(e){c(e.target)}function c(e){e.index!==null&&t.remove(e.index);for(let n in e.attributes)t.remove(e.attributes[n]);e.removeEventListener(`dispose`,s),delete i[e.id],o.unregister(e);let c=a.get(e);c&&(t.remove(c),a.delete(e)),r.releaseStatesOfGeometry(e),e.isInstancedBufferGeometry===!0&&delete e._maxInstanceCount,n.memory.geometries--}function l(e,t){return i[t.id]===void 0&&(t.addEventListener(`dispose`,s),i[t.id]=new WeakRef(t),o.register(t,t.id,t),n.memory.geometries++),t}function u(n){let r=n.attributes;for(let n in r)t.update(r[n],e.ARRAY_BUFFER)}function d(e){let n=e.index,r=e.attributes.position,i=0;if(r===void 0)return;let o=n===null?r.array.length/3-1:n.array.length,s=new(r.count>=65535?Eo:To)(Math.ceil(o/3)*6,1),c=s.array;if(n!==null){let e=n.array;i=n.version;for(let t=0,n=0;t<o;t+=3){let r=e[t+0],i=e[t+1],a=e[t+2];c[n++]=r,c[n++]=i,c[n++]=i,c[n++]=a,c[n++]=a,c[n++]=r}}else{i=r.version;for(let e=0,t=0;e<o;e+=3){let n=e+0,r=e+1,i=e+2;c[t++]=n,c[t++]=r,c[t++]=r,c[t++]=i,c[t++]=i,c[t++]=n}}s.version=i;let l=a.get(e);l&&t.remove(l),a.set(e,s)}function f(e){let t=a.get(e);if(t){let n=e.index;n!==null&&t.version<n.version&&d(e)}else d(e);return a.get(e)}function p(){for(let e in i){let t=i[e].deref();t!==void 0&&c(t)}}return{get:l,update:u,getWireframeAttribute:f,dispose:p}}function pd(e,t,n){let r;function i(e){r=e}let a,o;function s(e){a=e.type,o=e.bytesPerElement}function c(t,i){e.drawElements(r,i,a,t*o),n.update(i,r,1)}function l(t,i,s){s!==0&&(e.drawElementsInstanced(r,i,a,t*o,s),n.update(i,r,s))}function u(e,i,o){if(o===0)return;t.get(`WEBGL_multi_draw`).multiDrawElementsWEBGL(r,i,0,a,e,0,o);let s=0;for(let e=0;e<o;e++)s+=i[e];n.update(s,r,1)}this.setMode=i,this.setIndex=s,this.render=c,this.renderInstances=l,this.renderMultiDraw=u}function md(e){let t={geometries:0,textures:0},n={frame:0,calls:0,triangles:0,points:0,lines:0};function r(t,r,i){switch(n.calls++,r){case e.TRIANGLES:n.triangles+=t/3*i;break;case e.LINES:n.lines+=t/2*i;break;case e.LINE_STRIP:n.lines+=i*(t-1);break;case e.LINE_LOOP:n.lines+=i*t;break;case e.POINTS:n.points+=i*t;break;default:H(`WebGLInfo: Unknown draw mode:`,r)}}function i(){n.calls=0,n.triangles=0,n.points=0,n.lines=0}return{memory:t,render:n,programs:null,autoReset:!0,reset:i,update:r}}function hd(e,t,n){let r=new WeakMap,i=new ra;function a(a,o,s){let c=a.morphTargetInfluences,l=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=l===void 0?0:l.length,d=r.get(o);if(d===void 0||d.count!==u){d!==void 0&&d.texture.dispose();let e=o.morphAttributes.position!==void 0,n=o.morphAttributes.normal!==void 0,a=o.morphAttributes.color!==void 0,s=o.morphAttributes.position||[],c=o.morphAttributes.normal||[],l=o.morphAttributes.color||[],f=0;e===!0&&(f=1),n===!0&&(f=2),a===!0&&(f=3);let p=o.attributes.position.count*f,m=1;p>t.maxTextureSize&&(m=Math.ceil(p/t.maxTextureSize),p=t.maxTextureSize);let h=new Float32Array(p*m*4*u),g=new oa(h,p,m,u);g.type=rr,g.needsUpdate=!0;let _=f*4;for(let t=0;t<u;t++){let r=s[t],o=c[t],u=l[t],d=p*m*4*t;for(let t=0;t<r.count;t++){let s=t*_;e===!0&&(i.fromBufferAttribute(r,t),h[d+s+0]=i.x,h[d+s+1]=i.y,h[d+s+2]=i.z,h[d+s+3]=0),n===!0&&(i.fromBufferAttribute(o,t),h[d+s+4]=i.x,h[d+s+5]=i.y,h[d+s+6]=i.z,h[d+s+7]=0),a===!0&&(i.fromBufferAttribute(u,t),h[d+s+8]=i.x,h[d+s+9]=i.y,h[d+s+10]=i.z,h[d+s+11]=u.itemSize===4?i.w:1)}}d={count:u,texture:g,size:new W(p,m)},r.set(o,d);function v(){g.dispose(),r.delete(o),o.removeEventListener(`dispose`,v)}o.addEventListener(`dispose`,v)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)s.getUniforms().setValue(e,`morphTexture`,a.morphTexture,n);else{let t=0;for(let e=0;e<c.length;e++)t+=c[e];let n=o.morphTargetsRelative?1:1-t;s.getUniforms().setValue(e,`morphTargetBaseInfluence`,n),s.getUniforms().setValue(e,`morphTargetInfluences`,c)}s.getUniforms().setValue(e,`morphTargetsTexture`,d.texture,n),s.getUniforms().setValue(e,`morphTargetsTextureSize`,d.size)}return{update:a}}function gd(e,t,n,r,i){let a=new WeakMap;function o(r){let o=i.render.frame,s=r.geometry,l=t.get(r,s);if(a.get(l)!==o&&(t.update(l),a.set(l,o)),r.isInstancedMesh&&(r.hasEventListener(`dispose`,c)===!1&&r.addEventListener(`dispose`,c),a.get(r)!==o&&(n.update(r.instanceMatrix,e.ARRAY_BUFFER),r.instanceColor!==null&&n.update(r.instanceColor,e.ARRAY_BUFFER),a.set(r,o))),r.isSkinnedMesh){let e=r.skeleton;a.get(e)!==o&&(e.update(),a.set(e,o))}return l}function s(){a=new WeakMap}function c(e){let t=e.target;t.removeEventListener(`dispose`,c),r.releaseStatesOfObject(t),n.remove(t.instanceMatrix),t.instanceColor!==null&&n.remove(t.instanceColor)}return{update:o,dispose:s}}var _d={1:`LINEAR_TONE_MAPPING`,2:`REINHARD_TONE_MAPPING`,3:`CINEON_TONE_MAPPING`,4:`ACES_FILMIC_TONE_MAPPING`,6:`AGX_TONE_MAPPING`,7:`NEUTRAL_TONE_MAPPING`,5:`CUSTOM_TONE_MAPPING`};function vd(e,t,n,r,i,a){let o=new aa(t,n,{type:e,depthBuffer:i,stencilBuffer:a,samples:r?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),s=null,c=null,l=null,u=new Ro;u.setAttribute(`position`,new Y([-1,3,0,-1,-1,0,3,-1,0],3)),u.setAttribute(`uv`,new Y([0,2,0,0,2,0],2));let d=new jl({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),f=new Os(u,d),p=new hu(-1,1,1,-1,0,1),m=null,h=null,g=!1,_,v=null,y=[],b=!1;this.setSize=function(e,t){o.setSize(e,t),s!==null&&s.setSize(e,t),c!==null&&c.setSize(e,t);for(let n=0;n<y.length;n++){let r=y[n];r.setSize&&r.setSize(e,t)}},this.setEffects=function(e){y=e,b=y.length>0&&y[0].isRenderPass===!0;let t=o.width,n=o.height;y.length>0&&s===null&&(s=new aa(t,n,{type:ir,depthBuffer:!1,stencilBuffer:!1}),c=new aa(t,n,{type:ir,depthBuffer:!1,stencilBuffer:!1}));let r=i===!0&&y.some(e=>e.needsDepthTexture===!0);r!==(o.depthTexture!==null)&&(r===!0&&l===null&&(l=new gc(t,n),a===!0&&(l.format=mr,l.type=sr)),o.dispose(),o.depthTexture=r?l:null,o.resolveDepthBuffer=r,o.storeMultisampledDepthBuffer=r);for(let e=0;e<y.length;e++){let i=y[e];i.setSize&&i.setSize(t,n),r&&i.needsDepthTexture===!0&&i.setDepthTexture&&i.setDepthTexture(l)}},this.begin=function(e,t){if(g||e.toneMapping===0&&y.length===0)return!1;if(v=t,t!==null){let e=t.width,n=t.height;(o.width!==e||o.height!==n)&&this.setSize(e,n)}return b===!1&&e.setRenderTarget(o),_=e.toneMapping,e.toneMapping=0,!0},this.hasRenderPass=function(){return b},this.end=function(e,t){e.toneMapping=_,g=!0;let n=o,r=s;for(let i=0;i<y.length;i++){let a=y[i];a.enabled!==!1&&(a.render(e,r,n,t),a.needsSwap!==!1&&(n=r,r=r===s?c:s))}if(m!==e.outputColorSpace||h!==e.toneMapping){m=e.outputColorSpace,h=e.toneMapping,d.defines={},Ki.getTransfer(m)===`srgb`&&(d.defines.SRGB_TRANSFER=``);let t=_d[h];t&&(d.defines[t]=``),d.needsUpdate=!0}d.uniforms.tDiffuse.value=n.texture,e.setRenderTarget(v),e.render(f,p),v=null,g=!1},this.isCompositing=function(){return g},this.dispose=function(){o.dispose(),s!==null&&s.dispose(),c!==null&&c.dispose(),u.dispose(),d.dispose()}}var yd=new na,bd=new gc(1,1),xd=new _c(1),Sd=new oa,Cd=new sa,wd=new mc,Td=[],Ed=[],Dd=new Float32Array(16),Od=new Float32Array(9),kd=new Float32Array(4);function Ad(e,t,n){let r=e[0];if(r<=0||r>0)return e;let i=t*n,a=Td[i];if(a===void 0&&(a=new Float32Array(i),Td[i]=a),t!==0){r.toArray(a,0);for(let r=1,i=0;r!==t;++r)i+=n,e[r].toArray(a,i)}return a}function jd(e,t){if(e.length!==t.length)return!1;for(let n=0,r=e.length;n<r;n++)if(e[n]!==t[n])return!1;return!0}function Md(e,t){for(let n=0,r=t.length;n<r;n++)e[n]=t[n]}function Nd(e,t){let n=Ed[t];n===void 0&&(n=new Int32Array(t),Ed[t]=n);for(let r=0;r!==t;++r)n[r]=e.allocateTextureUnit();return n}function Pd(e,t){let n=this.cache;n[0]!==t&&(e.uniform1f(this.addr,t),n[0]=t)}function Fd(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2f(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(jd(n,t))return;e.uniform2fv(this.addr,t),Md(n,t)}}function Id(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3f(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else if(t.r!==void 0)(n[0]!==t.r||n[1]!==t.g||n[2]!==t.b)&&(e.uniform3f(this.addr,t.r,t.g,t.b),n[0]=t.r,n[1]=t.g,n[2]=t.b);else{if(jd(n,t))return;e.uniform3fv(this.addr,t),Md(n,t)}}function Ld(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4f(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(jd(n,t))return;e.uniform4fv(this.addr,t),Md(n,t)}}function Rd(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(jd(n,t))return;e.uniformMatrix2fv(this.addr,!1,t),Md(n,t)}else{if(jd(n,r))return;kd.set(r),e.uniformMatrix2fv(this.addr,!1,kd),Md(n,r)}}function zd(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(jd(n,t))return;e.uniformMatrix3fv(this.addr,!1,t),Md(n,t)}else{if(jd(n,r))return;Od.set(r),e.uniformMatrix3fv(this.addr,!1,Od),Md(n,r)}}function Bd(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(jd(n,t))return;e.uniformMatrix4fv(this.addr,!1,t),Md(n,t)}else{if(jd(n,r))return;Dd.set(r),e.uniformMatrix4fv(this.addr,!1,Dd),Md(n,r)}}function Vd(e,t){let n=this.cache;n[0]!==t&&(e.uniform1i(this.addr,t),n[0]=t)}function Hd(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2i(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(jd(n,t))return;e.uniform2iv(this.addr,t),Md(n,t)}}function Ud(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3i(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(jd(n,t))return;e.uniform3iv(this.addr,t),Md(n,t)}}function Wd(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4i(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(jd(n,t))return;e.uniform4iv(this.addr,t),Md(n,t)}}function Gd(e,t){let n=this.cache;n[0]!==t&&(e.uniform1ui(this.addr,t),n[0]=t)}function Kd(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2ui(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(jd(n,t))return;e.uniform2uiv(this.addr,t),Md(n,t)}}function qd(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3ui(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(jd(n,t))return;e.uniform3uiv(this.addr,t),Md(n,t)}}function Jd(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4ui(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(jd(n,t))return;e.uniform4uiv(this.addr,t),Md(n,t)}}function Yd(e){return e.version===0&&(e.compareFunction=519,e.needsUpdate=!0),e}function Xd(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i);let a;a=this.type===e.SAMPLER_2D_SHADOW?Yd(bd):yd,n.setTexture2D(t||a,i)}function Zd(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTexture3D(t||Cd,i)}function Qd(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i);let a;a=this.type===e.SAMPLER_CUBE_SHADOW?Yd(xd):wd,n.setTextureCube(t||a,i)}function $d(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTexture2DArray(t||Sd,i)}function ef(e){switch(e){case 5126:return Pd;case 35664:return Fd;case 35665:return Id;case 35666:return Ld;case 35674:return Rd;case 35675:return zd;case 35676:return Bd;case 5124:case 35670:return Vd;case 35667:case 35671:return Hd;case 35668:case 35672:return Ud;case 35669:case 35673:return Wd;case 5125:return Gd;case 36294:return Kd;case 36295:return qd;case 36296:return Jd;case 35678:case 36198:case 36298:case 36306:case 35682:return Xd;case 35679:case 36299:case 36307:return Zd;case 35680:case 36300:case 36308:case 36293:return Qd;case 36289:case 36303:case 36311:case 36292:return $d}}function tf(e,t){e.uniform1fv(this.addr,t)}function nf(e,t){let n=Ad(t,this.size,2);e.uniform2fv(this.addr,n)}function rf(e,t){let n=Ad(t,this.size,3);e.uniform3fv(this.addr,n)}function af(e,t){let n=Ad(t,this.size,4);e.uniform4fv(this.addr,n)}function of(e,t){let n=Ad(t,this.size,4);e.uniformMatrix2fv(this.addr,!1,n)}function sf(e,t){let n=Ad(t,this.size,9);e.uniformMatrix3fv(this.addr,!1,n)}function cf(e,t){let n=Ad(t,this.size,16);e.uniformMatrix4fv(this.addr,!1,n)}function lf(e,t){e.uniform1iv(this.addr,t)}function uf(e,t){e.uniform2iv(this.addr,t)}function df(e,t){e.uniform3iv(this.addr,t)}function ff(e,t){e.uniform4iv(this.addr,t)}function pf(e,t){e.uniform1uiv(this.addr,t)}function mf(e,t){e.uniform2uiv(this.addr,t)}function hf(e,t){e.uniform3uiv(this.addr,t)}function gf(e,t){e.uniform4uiv(this.addr,t)}function _f(e,t,n){let r=this.cache,i=t.length,a=Nd(n,i);jd(r,a)||(e.uniform1iv(this.addr,a),Md(r,a));let o;o=this.type===e.SAMPLER_2D_SHADOW?Yd(bd):yd;for(let e=0;e!==i;++e)n.setTexture2D(t[e]||o,a[e])}function vf(e,t,n){let r=this.cache,i=t.length,a=Nd(n,i);jd(r,a)||(e.uniform1iv(this.addr,a),Md(r,a));for(let e=0;e!==i;++e)n.setTexture3D(t[e]||Cd,a[e])}function yf(e,t,n){let r=this.cache,i=t.length,a=Nd(n,i);jd(r,a)||(e.uniform1iv(this.addr,a),Md(r,a));let o;o=this.type===e.SAMPLER_CUBE_SHADOW?Yd(xd):wd;for(let e=0;e!==i;++e)n.setTextureCube(t[e]||o,a[e])}function bf(e,t,n){let r=this.cache,i=t.length,a=Nd(n,i);jd(r,a)||(e.uniform1iv(this.addr,a),Md(r,a));for(let e=0;e!==i;++e)n.setTexture2DArray(t[e]||Sd,a[e])}function xf(e){switch(e){case 5126:return tf;case 35664:return nf;case 35665:return rf;case 35666:return af;case 35674:return of;case 35675:return sf;case 35676:return cf;case 5124:case 35670:return lf;case 35667:case 35671:return uf;case 35668:case 35672:return df;case 35669:case 35673:return ff;case 5125:return pf;case 36294:return mf;case 36295:return hf;case 36296:return gf;case 35678:case 36198:case 36298:case 36306:case 35682:return _f;case 35679:case 36299:case 36307:return vf;case 35680:case 36300:case 36308:case 36293:return yf;case 36289:case 36303:case 36311:case 36292:return bf}}var Sf=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=ef(t.type)}},Cf=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=xf(t.type)}},wf=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let r=this.seq;for(let i=0,a=r.length;i!==a;++i){let a=r[i];a.setValue(e,t[a.id],n)}}},Tf=/(\w+)(\])?(\[|\.)?/g;function Ef(e,t){e.seq.push(t),e.map[t.id]=t}function Df(e,t,n){let r=e.name,i=r.length;for(Tf.lastIndex=0;;){let a=Tf.exec(r),o=Tf.lastIndex,s=a[1],c=a[2]===`]`,l=a[3];if(c&&(s|=0),l===void 0||l===`[`&&o+2===i){Ef(n,l===void 0?new Sf(s,e,t):new Cf(s,e,t));break}{let e=n.map[s];e===void 0&&(e=new wf(s),Ef(n,e)),n=e}}}var Of=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<n;++r){let n=e.getActiveUniform(t,r);Df(n,e.getUniformLocation(t,n.name),this)}let r=[],i=[];for(let t of this.seq)t.type===e.SAMPLER_2D_SHADOW||t.type===e.SAMPLER_CUBE_SHADOW||t.type===e.SAMPLER_2D_ARRAY_SHADOW?r.push(t):i.push(t);r.length>0&&(this.seq=r.concat(i))}setValue(e,t,n,r){let i=this.map[t];i!==void 0&&i.setValue(e,n,r)}setOptional(e,t,n){let r=t[n];r!==void 0&&this.setValue(e,n,r)}static upload(e,t,n,r){for(let i=0,a=t.length;i!==a;++i){let a=t[i],o=n[a.id];o.needsUpdate!==!1&&a.setValue(e,o.value,r)}}static seqWithValue(e,t){let n=[];for(let r=0,i=e.length;r!==i;++r){let i=e[r];i.id in t&&n.push(i)}return n}};function kf(e,t,n){let r=e.createShader(t);return e.shaderSource(r,n),e.compileShader(r),r}var Af=37297,jf=0;function Mf(e,t){let n=e.split(`
`),r=[],i=Math.max(t-6,0),a=Math.min(t+6,n.length);for(let e=i;e<a;e++){let i=e+1;r.push(`${i===t?`>`:` `} ${i}: ${n[e]}`)}return r.join(`
`)}var Nf=new K;function Pf(e){Ki._getMatrix(Nf,Ki.workingColorSpace,e);let t=`mat3( ${Nf.elements.map(e=>e.toFixed(4))} )`;switch(Ki.getTransfer(e)){case fi:return[t,`LinearTransferOETF`];case pi:return[t,`sRGBTransferOETF`];default:return V(`WebGLProgram: Unsupported color space: `,e),[t,`LinearTransferOETF`]}}function Ff(e,t,n){let r=e.getShaderParameter(t,e.COMPILE_STATUS),i=(e.getShaderInfoLog(t)||``).trim();if(r&&i===``)return``;let a=/ERROR: 0:(\d+)/.exec(i);if(a){let r=parseInt(a[1]);return n.toUpperCase()+`

`+i+`

`+Mf(e.getShaderSource(t),r)}return i}function If(e,t){let n=Pf(t);return[`vec4 ${e}( vec4 value ) {`,`	return ${n[1]}( vec4( ${n[0]} * value.rgb, value.a ) );`,`}`].join(`
`)}var Lf={1:`Linear`,2:`Reinhard`,3:`Cineon`,4:`ACESFilmic`,6:`AgX`,7:`Neutral`,5:`Custom`};function Rf(e,t){let n=Lf[t];return n===void 0?(V(`WebGLProgram: Unsupported toneMapping:`,t),`vec3 `+e+`( vec3 color ) { return LinearToneMapping( color ); }`):`vec3 `+e+`( vec3 color ) { return `+n+`ToneMapping( color ); }`}var zf=new G;function Bf(){return Ki.getLuminanceCoefficients(zf),[`float luminance( const in vec3 rgb ) {`,`	const vec3 weights = vec3( ${zf.x.toFixed(4)}, ${zf.y.toFixed(4)}, ${zf.z.toFixed(4)} );`,`	return dot( weights, rgb );`,`}`].join(`
`)}function Vf(e){return[e.extensionClipCullDistance?`#extension GL_ANGLE_clip_cull_distance : require`:``,e.extensionMultiDraw?`#extension GL_ANGLE_multi_draw : require`:``].filter(Wf).join(`
`)}function Hf(e){let t=[];for(let n in e){let r=e[n];r!==!1&&t.push(`#define `+n+` `+r)}return t.join(`
`)}function Uf(e,t){let n={},r=e.getProgramParameter(t,e.ACTIVE_ATTRIBUTES);for(let i=0;i<r;i++){let r=e.getActiveAttrib(t,i),a=r.name,o=1;r.type===e.FLOAT_MAT2&&(o=2),r.type===e.FLOAT_MAT3&&(o=3),r.type===e.FLOAT_MAT4&&(o=4),n[a]={type:r.type,location:e.getAttribLocation(t,a),locationSize:o}}return n}function Wf(e){return e!==``}function Gf(e,t){let n=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return e.replace(/NUM_SUN_LIGHTS/g,t.numSunLights).replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,n).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,t.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows).replace(/NUM_LIGHT_PROBE_GRIDS/g,t.numLightProbeGrids)}function Kf(e,t){return e.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var qf=/^[ \t]*#include +<([\w\d./]+)>/gm;function Jf(e){return e.replace(qf,Yf)}function Yf(e,t){let n=X[t];if(n===void 0)throw Error(`THREE.WebGLProgram: Can not resolve #include <`+t+`>`);return Jf(n)}var Xf=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Zf(e){return e.replace(Xf,Qf)}function Qf(e,t,n,r){let i=``;for(let e=parseInt(t);e<parseInt(n);e++)i+=r.replace(/\[\s*i\s*\]/g,`[ `+e+` ]`).replace(/UNROLLED_LOOP_INDEX/g,e);return i}function $f(e){let t=`precision ${e.precision} float;
	precision ${e.precision} int;
	precision ${e.precision} sampler2D;
	precision ${e.precision} samplerCube;
	precision ${e.precision} sampler3D;
	precision ${e.precision} sampler2DArray;
	precision ${e.precision} sampler2DShadow;
	precision ${e.precision} samplerCubeShadow;
	precision ${e.precision} sampler2DArrayShadow;
	precision ${e.precision} isampler2D;
	precision ${e.precision} isampler3D;
	precision ${e.precision} isamplerCube;
	precision ${e.precision} isampler2DArray;
	precision ${e.precision} usampler2D;
	precision ${e.precision} usampler3D;
	precision ${e.precision} usamplerCube;
	precision ${e.precision} usampler2DArray;
	`;return e.precision===`highp`?t+=`
#define HIGH_PRECISION`:e.precision===`mediump`?t+=`
#define MEDIUM_PRECISION`:e.precision===`lowp`&&(t+=`
#define LOW_PRECISION`),t}var ep={1:`SHADOWMAP_TYPE_PCF`,3:`SHADOWMAP_TYPE_VSM`};function tp(e){return ep[e.shadowMapType]||`SHADOWMAP_TYPE_BASIC`}var np={302:`ENVMAP_MODE_REFRACTION`};function rp(e){return e.envMap===!1?`ENVMAP_MODE_REFLECTION`:np[e.envMapMode]||`ENVMAP_MODE_REFLECTION`}var ip={0:`ENVMAP_BLENDING_MULTIPLY`,1:`ENVMAP_BLENDING_MIX`,2:`ENVMAP_BLENDING_ADD`};function ap(e){return e.envMap===!1?`ENVMAP_BLENDING_NONE`:ip[e.combine]||`ENVMAP_BLENDING_NONE`}function op(e,t,n,r){let i=e.getContext(),a=n.defines,o=n.vertexShader,s=n.fragmentShader,c=tp(n),l=n.envMapPMREM===!0?`ENVMAP_TYPE_PMREM`:`ENVMAP_TYPE_CUBE`,u=rp(n),d=ap(n),f=Vf(n),p=Hf(a),m=i.createProgram(),h,g,_=n.glslVersion?`#version `+n.glslVersion+`
`:``;n.isRawShaderMaterial?(h=[`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,p].filter(Wf).join(`
`),h.length>0&&(h+=`
`),g=[`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,p].filter(Wf).join(`
`),g.length>0&&(g+=`
`)):(h=[$f(n),`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,p,n.extensionClipCullDistance?`#define USE_CLIP_DISTANCE`:``,n.batching?`#define USE_BATCHING`:``,n.batchingColor?`#define USE_BATCHING_COLOR`:``,n.instancing?`#define USE_INSTANCING`:``,n.instancingColor?`#define USE_INSTANCING_COLOR`:``,n.instancingMorph?`#define USE_INSTANCING_MORPH`:``,n.useFog&&n.fog?`#define USE_FOG`:``,n.useFog&&n.fogExp2?`#define FOG_EXP2`:``,n.map?`#define USE_MAP`:``,n.envMap?`#define USE_ENVMAP`:``,n.envMap?`#define `+u:``,n.lightMap?`#define USE_LIGHTMAP`:``,n.aoMap?`#define USE_AOMAP`:``,n.bumpMap?`#define USE_BUMPMAP`:``,n.normalMap?`#define USE_NORMALMAP`:``,n.normalMapObjectSpace?`#define USE_NORMALMAP_OBJECTSPACE`:``,n.normalMapTangentSpace?`#define USE_NORMALMAP_TANGENTSPACE`:``,n.displacementMap?`#define USE_DISPLACEMENTMAP`:``,n.emissiveMap?`#define USE_EMISSIVEMAP`:``,n.anisotropy?`#define USE_ANISOTROPY`:``,n.anisotropyMap?`#define USE_ANISOTROPYMAP`:``,n.clearcoatMap?`#define USE_CLEARCOATMAP`:``,n.clearcoatRoughnessMap?`#define USE_CLEARCOAT_ROUGHNESSMAP`:``,n.clearcoatNormalMap?`#define USE_CLEARCOAT_NORMALMAP`:``,n.diffuseRoughnessMap?`#define USE_DIFFUSE_ROUGHNESSMAP`:``,n.iridescenceMap?`#define USE_IRIDESCENCEMAP`:``,n.iridescenceThicknessMap?`#define USE_IRIDESCENCE_THICKNESSMAP`:``,n.specularMap?`#define USE_SPECULARMAP`:``,n.specularColorMap?`#define USE_SPECULAR_COLORMAP`:``,n.specularIntensityMap?`#define USE_SPECULAR_INTENSITYMAP`:``,n.roughnessMap?`#define USE_ROUGHNESSMAP`:``,n.metalnessMap?`#define USE_METALNESSMAP`:``,n.alphaMap?`#define USE_ALPHAMAP`:``,n.alphaHash?`#define USE_ALPHAHASH`:``,n.transmission?`#define USE_TRANSMISSION`:``,n.transmissionMap?`#define USE_TRANSMISSIONMAP`:``,n.thicknessMap?`#define USE_THICKNESSMAP`:``,n.sheenColorMap?`#define USE_SHEEN_COLORMAP`:``,n.sheenRoughnessMap?`#define USE_SHEEN_ROUGHNESSMAP`:``,n.mapUv?`#define MAP_UV `+n.mapUv:``,n.alphaMapUv?`#define ALPHAMAP_UV `+n.alphaMapUv:``,n.lightMapUv?`#define LIGHTMAP_UV `+n.lightMapUv:``,n.aoMapUv?`#define AOMAP_UV `+n.aoMapUv:``,n.emissiveMapUv?`#define EMISSIVEMAP_UV `+n.emissiveMapUv:``,n.bumpMapUv?`#define BUMPMAP_UV `+n.bumpMapUv:``,n.normalMapUv?`#define NORMALMAP_UV `+n.normalMapUv:``,n.displacementMapUv?`#define DISPLACEMENTMAP_UV `+n.displacementMapUv:``,n.metalnessMapUv?`#define METALNESSMAP_UV `+n.metalnessMapUv:``,n.roughnessMapUv?`#define ROUGHNESSMAP_UV `+n.roughnessMapUv:``,n.anisotropyMapUv?`#define ANISOTROPYMAP_UV `+n.anisotropyMapUv:``,n.clearcoatMapUv?`#define CLEARCOATMAP_UV `+n.clearcoatMapUv:``,n.clearcoatNormalMapUv?`#define CLEARCOAT_NORMALMAP_UV `+n.clearcoatNormalMapUv:``,n.clearcoatRoughnessMapUv?`#define CLEARCOAT_ROUGHNESSMAP_UV `+n.clearcoatRoughnessMapUv:``,n.diffuseRoughnessMapUv?`#define DIFFUSE_ROUGHNESSMAP_UV `+n.diffuseRoughnessMapUv:``,n.iridescenceMapUv?`#define IRIDESCENCEMAP_UV `+n.iridescenceMapUv:``,n.iridescenceThicknessMapUv?`#define IRIDESCENCE_THICKNESSMAP_UV `+n.iridescenceThicknessMapUv:``,n.sheenColorMapUv?`#define SHEEN_COLORMAP_UV `+n.sheenColorMapUv:``,n.sheenRoughnessMapUv?`#define SHEEN_ROUGHNESSMAP_UV `+n.sheenRoughnessMapUv:``,n.specularMapUv?`#define SPECULARMAP_UV `+n.specularMapUv:``,n.specularColorMapUv?`#define SPECULAR_COLORMAP_UV `+n.specularColorMapUv:``,n.specularIntensityMapUv?`#define SPECULAR_INTENSITYMAP_UV `+n.specularIntensityMapUv:``,n.transmissionMapUv?`#define TRANSMISSIONMAP_UV `+n.transmissionMapUv:``,n.thicknessMapUv?`#define THICKNESSMAP_UV `+n.thicknessMapUv:``,n.vertexTangents&&n.flatShading===!1?`#define USE_TANGENT`:``,n.vertexNormals?`#define HAS_NORMAL`:``,n.vertexColors?`#define USE_COLOR`:``,n.vertexAlphas?`#define USE_COLOR_ALPHA`:``,n.vertexUv1s?`#define USE_UV1`:``,n.vertexUv2s?`#define USE_UV2`:``,n.vertexUv3s?`#define USE_UV3`:``,n.pointsUvs?`#define USE_POINTS_UV`:``,n.flatShading?`#define FLAT_SHADED`:``,n.skinning?`#define USE_SKINNING`:``,n.morphTargets?`#define USE_MORPHTARGETS`:``,n.morphNormals&&n.flatShading===!1?`#define USE_MORPHNORMALS`:``,n.morphColors?`#define USE_MORPHCOLORS`:``,n.morphTargetsCount>0?`#define MORPHTARGETS_TEXTURE_STRIDE `+n.morphTextureStride:``,n.morphTargetsCount>0?`#define MORPHTARGETS_COUNT `+n.morphTargetsCount:``,n.doubleSided?`#define DOUBLE_SIDED`:``,n.flipSided?`#define FLIP_SIDED`:``,n.shadowMapEnabled?`#define USE_SHADOWMAP`:``,n.shadowMapEnabled?`#define `+c:``,n.sizeAttenuation?`#define USE_SIZEATTENUATION`:``,n.numLightProbes>0?`#define USE_LIGHT_PROBES`:``,n.logarithmicDepthBuffer?`#define USE_LOGARITHMIC_DEPTH_BUFFER`:``,n.reversedDepthBuffer?`#define USE_REVERSED_DEPTH_BUFFER`:``,`uniform mat4 modelMatrix;`,`uniform mat4 modelViewMatrix;`,`uniform mat4 projectionMatrix;`,`uniform mat4 viewMatrix;`,`uniform mat3 normalMatrix;`,`uniform vec3 cameraPosition;`,`uniform bool isOrthographic;`,`#ifdef USE_INSTANCING`,`	attribute mat4 instanceMatrix;`,`#endif`,`#ifdef USE_INSTANCING_COLOR`,`	attribute vec3 instanceColor;`,`#endif`,`#ifdef USE_INSTANCING_MORPH`,`	uniform sampler2D morphTexture;`,`#endif`,`attribute vec3 position;`,`attribute vec3 normal;`,`attribute vec2 uv;`,`#ifdef USE_UV1`,`	attribute vec2 uv1;`,`#endif`,`#ifdef USE_UV2`,`	attribute vec2 uv2;`,`#endif`,`#ifdef USE_UV3`,`	attribute vec2 uv3;`,`#endif`,`#ifdef USE_TANGENT`,`	attribute vec4 tangent;`,`#endif`,`#if defined( USE_COLOR_ALPHA )`,`	attribute vec4 color;`,`#elif defined( USE_COLOR )`,`	attribute vec3 color;`,`#endif`,`#ifdef USE_SKINNING`,`	attribute vec4 skinIndex;`,`	attribute vec4 skinWeight;`,`#endif`,`
`].filter(Wf).join(`
`),g=[$f(n),`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,p,n.useFog&&n.fog?`#define USE_FOG`:``,n.useFog&&n.fogExp2?`#define FOG_EXP2`:``,n.alphaToCoverage?`#define ALPHA_TO_COVERAGE`:``,n.map?`#define USE_MAP`:``,n.matcap?`#define USE_MATCAP`:``,n.envMap?`#define USE_ENVMAP`:``,n.envMap?`#define `+l:``,n.envMap?`#define `+u:``,n.envMap?`#define `+d:``,n.envMapPMREM?`#define ENVMAP_MAX_LOD `+n.envMapMaxLod+`.0`:``,n.envMapPMREM?`#define ENVMAP_SIZE `+n.envMapSize+`.0`:``,n.lightMap?`#define USE_LIGHTMAP`:``,n.aoMap?`#define USE_AOMAP`:``,n.bumpMap?`#define USE_BUMPMAP`:``,n.normalMap?`#define USE_NORMALMAP`:``,n.normalMapObjectSpace?`#define USE_NORMALMAP_OBJECTSPACE`:``,n.normalMapTangentSpace?`#define USE_NORMALMAP_TANGENTSPACE`:``,n.packedNormalMap?`#define USE_PACKED_NORMALMAP`:``,n.emissiveMap?`#define USE_EMISSIVEMAP`:``,n.anisotropy?`#define USE_ANISOTROPY`:``,n.anisotropyMap?`#define USE_ANISOTROPYMAP`:``,n.clearcoat?`#define USE_CLEARCOAT`:``,n.clearcoatMap?`#define USE_CLEARCOATMAP`:``,n.clearcoatRoughnessMap?`#define USE_CLEARCOAT_ROUGHNESSMAP`:``,n.clearcoatNormalMap?`#define USE_CLEARCOAT_NORMALMAP`:``,n.diffuseRoughness?`#define USE_DIFFUSE_ROUGHNESS`:``,n.diffuseRoughnessMap?`#define USE_DIFFUSE_ROUGHNESSMAP`:``,n.dispersion?`#define USE_DISPERSION`:``,n.retroreflection?`#define USE_RETROREFLECTION`:``,n.iridescence?`#define USE_IRIDESCENCE`:``,n.iridescenceMap?`#define USE_IRIDESCENCEMAP`:``,n.iridescenceThicknessMap?`#define USE_IRIDESCENCE_THICKNESSMAP`:``,n.specularMap?`#define USE_SPECULARMAP`:``,n.specularColorMap?`#define USE_SPECULAR_COLORMAP`:``,n.specularIntensityMap?`#define USE_SPECULAR_INTENSITYMAP`:``,n.roughnessMap?`#define USE_ROUGHNESSMAP`:``,n.metalnessMap?`#define USE_METALNESSMAP`:``,n.alphaMap?`#define USE_ALPHAMAP`:``,n.alphaTest?`#define USE_ALPHATEST`:``,n.alphaHash?`#define USE_ALPHAHASH`:``,n.sheen?`#define USE_SHEEN`:``,n.sheenColorMap?`#define USE_SHEEN_COLORMAP`:``,n.sheenRoughnessMap?`#define USE_SHEEN_ROUGHNESSMAP`:``,n.transmission?`#define USE_TRANSMISSION`:``,n.transmissionMap?`#define USE_TRANSMISSIONMAP`:``,n.thicknessMap?`#define USE_THICKNESSMAP`:``,n.vertexTangents&&n.flatShading===!1?`#define USE_TANGENT`:``,n.vertexColors||n.instancingColor?`#define USE_COLOR`:``,n.vertexAlphas||n.batchingColor?`#define USE_COLOR_ALPHA`:``,n.vertexUv1s?`#define USE_UV1`:``,n.vertexUv2s?`#define USE_UV2`:``,n.vertexUv3s?`#define USE_UV3`:``,n.pointsUvs?`#define USE_POINTS_UV`:``,n.gradientMap?`#define USE_GRADIENTMAP`:``,n.flatShading?`#define FLAT_SHADED`:``,n.doubleSided?`#define DOUBLE_SIDED`:``,n.flipSided?`#define FLIP_SIDED`:``,n.shadowMapEnabled?`#define USE_SHADOWMAP`:``,n.shadowMapEnabled?`#define `+c:``,n.premultipliedAlpha?`#define PREMULTIPLIED_ALPHA`:``,n.numLightProbes>0?`#define USE_LIGHT_PROBES`:``,n.decodeVideoTexture?`#define DECODE_VIDEO_TEXTURE`:``,n.decodeVideoTextureEmissive?`#define DECODE_VIDEO_TEXTURE_EMISSIVE`:``,n.logarithmicDepthBuffer?`#define USE_LOGARITHMIC_DEPTH_BUFFER`:``,n.reversedDepthBuffer?`#define USE_REVERSED_DEPTH_BUFFER`:``,`uniform mat4 viewMatrix;`,`uniform vec3 cameraPosition;`,`uniform bool isOrthographic;`,n.toneMapping===0?``:`#define TONE_MAPPING`,n.toneMapping===0?``:X.tonemapping_pars_fragment,n.toneMapping===0?``:Rf(`toneMapping`,n.toneMapping),n.dithering?`#define DITHERING`:``,n.opaque?`#define OPAQUE`:``,X.colorspace_pars_fragment,If(`linearToOutputTexel`,n.outputColorSpace),Bf(),n.useDepthPacking?`#define DEPTH_PACKING `+n.depthPacking:``,`
`].filter(Wf).join(`
`)),o=Jf(o),o=Gf(o,n),o=Kf(o,n),s=Jf(s),s=Gf(s,n),s=Kf(s,n),o=Zf(o),s=Zf(s),n.isRawShaderMaterial!==!0&&(_=`#version 300 es
`,h=[f,`#define attribute in`,`#define varying out`,`#define texture2D texture`].join(`
`)+`
`+h,g=[`#define varying in`,n.glslVersion===`300 es`?``:`layout(location = 0) out highp vec4 pc_fragColor;`,n.glslVersion===`300 es`?``:`#define gl_FragColor pc_fragColor`,`#define gl_FragDepthEXT gl_FragDepth`,`#define texture2D texture`,`#define textureCube texture`,`#define texture2DProj textureProj`,`#define texture2DLodEXT textureLod`,`#define texture2DProjLodEXT textureProjLod`,`#define textureCubeLodEXT textureLod`,`#define texture2DGradEXT textureGrad`,`#define texture2DProjGradEXT textureProjGrad`,`#define textureCubeGradEXT textureGrad`].join(`
`)+`
`+g);let v=_+h+o,y=_+g+s,b=kf(i,i.VERTEX_SHADER,v),x=kf(i,i.FRAGMENT_SHADER,y);i.attachShader(m,b),i.attachShader(m,x),n.index0AttributeName===void 0?n.hasPositionAttribute===!0&&i.bindAttribLocation(m,0,`position`):i.bindAttribLocation(m,0,n.index0AttributeName),i.linkProgram(m);function S(t){if(e.debug.checkShaderErrors){let n=i.getProgramInfoLog(m)||``,r=i.getShaderInfoLog(b)||``,a=i.getShaderInfoLog(x)||``,o=n.trim(),s=r.trim(),c=a.trim(),l=!0,u=!0;if(i.getProgramParameter(m,i.LINK_STATUS)===!1){if(l=!1,typeof e.debug.onShaderError==`function`)e.debug.onShaderError(i,m,b,x);else{let e=Ff(i,b,`vertex`),n=Ff(i,x,`fragment`);H(`WebGLProgram: Shader Error `+i.getError()+` - VALIDATE_STATUS `+i.getProgramParameter(m,i.VALIDATE_STATUS)+`

Material Name: `+t.name+`
Material Type: `+t.type+`

Program Info Log: `+o+`
`+e+`
`+n)}}else o===``?(s===``||c===``)&&(u=!1):V(`WebGLProgram: Program Info Log:`,o);u&&(t.diagnostics={runnable:l,programLog:o,vertexShader:{log:s,prefix:h},fragmentShader:{log:c,prefix:g}})}i.deleteShader(b),i.deleteShader(x),C=new Of(i,m),w=Uf(i,m)}let C;this.getUniforms=function(){return C===void 0&&S(this),C};let w;this.getAttributes=function(){return w===void 0&&S(this),w};let T=n.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return T===!1&&(T=i.getProgramParameter(m,Af)),T},this.destroy=function(){r.releaseStatesOfProgram(this),i.deleteProgram(m),this.program=void 0},this.type=n.shaderType,this.name=n.shaderName,this.id=jf++,this.cacheKey=t,this.usedTimes=1,this.program=m,this.vertexShader=b,this.fragmentShader=x,this}var sp=0,cp=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){let r=this._getShaderCacheForMaterial(e);return r.has(t)===!1&&(r.add(t),t.usedTimes++),r.has(n)===!1&&(r.add(n),n.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let e of t)e.usedTimes--,e.usedTimes===0&&this.shaderCache.delete(e.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new lp(e),t.set(e,n)),n}},lp=class{constructor(e){this.id=sp++,this.code=e,this.usedTimes=0}};function up(e){return e===1030||e===37490||e===36285}function dp(e,t,n,r,i,a){let o=new va,s=new cp,c=new Set,l=[],u=new Map,d=r.logarithmicDepthBuffer,f={MeshDepthMaterial:`depth`,MeshDistanceMaterial:`distance`,MeshNormalMaterial:`normal`,MeshBasicMaterial:`basic`,MeshLambertMaterial:`lambert`,MeshPhongMaterial:`phong`,MeshToonMaterial:`toon`,MeshStandardMaterial:`physical`,MeshPhysicalMaterial:`physical`,MeshMatcapMaterial:`matcap`,LineBasicMaterial:`basic`,LineDashedMaterial:`dashed`,PointsMaterial:`points`,ShadowMaterial:`shadow`,SpriteMaterial:`sprite`};function p(e){return c.add(e),e===0?`uv`:`uv${e}`}function m(i,o,l,u,m,h){let g=u.fog,_=m.geometry,v=i.isMeshStandardMaterial||i.isMeshLambertMaterial||i.isMeshPhongMaterial?u.environment:null,y=i.isMeshStandardMaterial||i.isMeshLambertMaterial&&!i.envMap||i.isMeshPhongMaterial&&!i.envMap,b=t.get(i.envMap||v,y),x=f[i.type],S=r.precision;i.precision!==null&&(S=r.getMaxPrecision(i.precision),S!==i.precision&&V(`WebGLProgram.getParameters:`,i.precision,`not supported, using`,S,`instead.`));let C=_.morphAttributes.position||_.morphAttributes.normal||_.morphAttributes.color,w=C===void 0?0:C.length,T=0;_.morphAttributes.position!==void 0&&(T=1),_.morphAttributes.normal!==void 0&&(T=2),_.morphAttributes.color!==void 0&&(T=3);let E,D,O,k;if(x){let e=Ru[x];E=e.vertexShader,D=e.fragmentShader}else{E=i.vertexShader,D=i.fragmentShader;let e=s.getVertexShaderStage(i),t=s.getFragmentShaderStage(i);s.update(i,e,t),O=e.id,k=t.id}let A=e.getRenderTarget(),j=e.state.buffers.depth.getReversed(),ee=m.isInstancedMesh===!0,M=m.isBatchedMesh===!0,N=!!i.map,P=!!i.matcap,F=!!b,te=F&&b.isPMREMTexture===!0,ne=!!i.aoMap,re=!!i.lightMap,ie=!!i.bumpMap&&i.wireframe===!1,ae=!!i.normalMap,oe=!!i.displacementMap,se=!!i.emissiveMap,ce=!!i.metalnessMap,le=!!i.roughnessMap,ue=i.anisotropy>0,I=i.clearcoat>0,de=i.diffuseRoughness>0,fe=i.dispersion>0,pe=i.retroreflectivity>0,me=i.iridescence>0,he=i.sheen>0,ge=i.transmission>0,_e=ue&&!!i.anisotropyMap,ve=I&&!!i.clearcoatMap,ye=I&&!!i.clearcoatNormalMap,be=I&&!!i.clearcoatRoughnessMap,xe=de&&!!i.diffuseRoughnessMap,L=me&&!!i.iridescenceMap,Se=me&&!!i.iridescenceThicknessMap,Ce=he&&!!i.sheenColorMap,we=he&&!!i.sheenRoughnessMap,R=!!i.specularMap,Te=!!i.specularColorMap,z=!!i.specularIntensityMap,B=ge&&!!i.transmissionMap,Ee=ge&&!!i.thicknessMap,De=!!i.gradientMap,Oe=!!i.alphaMap,ke=i.alphaTest>0,Ae=!!i.alphaHash,je=!!i.extensions,Me=0;i.toneMapped&&(A===null||A.isXRRenderTarget===!0)&&(Me=e.toneMapping);let Ne=te?b.isCompressedCubeTexture?b.image[0].mipmaps:b.mipmaps:null,Pe={shaderID:x,shaderType:i.type,shaderName:i.name,vertexShader:E,fragmentShader:D,defines:i.defines,customVertexShaderID:O,customFragmentShaderID:k,isRawShaderMaterial:i.isRawShaderMaterial===!0,glslVersion:i.glslVersion,precision:S,batching:M,batchingColor:M&&m._colorsTexture!==null,instancing:ee,instancingColor:ee&&m.instanceColor!==null,instancingMorph:ee&&m.morphTexture!==null,outputColorSpace:A===null?e.outputColorSpace:A.isXRRenderTarget===!0?A.texture.colorSpace:Ki.workingColorSpace,alphaToCoverage:!!i.alphaToCoverage,map:N,matcap:P,envMap:F,envMapMode:F&&b.mapping,envMapPMREM:te,envMapMaxLod:te?Ne.length-1:null,envMapSize:te?Ne[0].width:null,aoMap:ne,lightMap:re,bumpMap:ie,normalMap:ae,displacementMap:oe,emissiveMap:se,normalMapObjectSpace:ae&&i.normalMapType===1,normalMapTangentSpace:ae&&i.normalMapType===0,packedNormalMap:ae&&i.normalMapType===0&&up(i.normalMap.format),metalnessMap:ce,roughnessMap:le,anisotropy:ue,anisotropyMap:_e,clearcoat:I,clearcoatMap:ve,clearcoatNormalMap:ye,clearcoatRoughnessMap:be,diffuseRoughness:de,diffuseRoughnessMap:xe,dispersion:fe,retroreflection:pe,iridescence:me,iridescenceMap:L,iridescenceThicknessMap:Se,sheen:he,sheenColorMap:Ce,sheenRoughnessMap:we,specularMap:R,specularColorMap:Te,specularIntensityMap:z,transmission:ge,transmissionMap:B,thicknessMap:Ee,gradientMap:De,opaque:i.transparent===!1&&i.blending===1&&i.alphaToCoverage===!1,alphaMap:Oe,alphaTest:ke,alphaHash:Ae,combine:i.combine,mapUv:N&&p(i.map.channel),aoMapUv:ne&&p(i.aoMap.channel),lightMapUv:re&&p(i.lightMap.channel),bumpMapUv:ie&&p(i.bumpMap.channel),normalMapUv:ae&&p(i.normalMap.channel),displacementMapUv:oe&&p(i.displacementMap.channel),emissiveMapUv:se&&p(i.emissiveMap.channel),metalnessMapUv:ce&&p(i.metalnessMap.channel),roughnessMapUv:le&&p(i.roughnessMap.channel),anisotropyMapUv:_e&&p(i.anisotropyMap.channel),clearcoatMapUv:ve&&p(i.clearcoatMap.channel),clearcoatNormalMapUv:ye&&p(i.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:be&&p(i.clearcoatRoughnessMap.channel),diffuseRoughnessMapUv:xe&&p(i.diffuseRoughnessMap.channel),iridescenceMapUv:L&&p(i.iridescenceMap.channel),iridescenceThicknessMapUv:Se&&p(i.iridescenceThicknessMap.channel),sheenColorMapUv:Ce&&p(i.sheenColorMap.channel),sheenRoughnessMapUv:we&&p(i.sheenRoughnessMap.channel),specularMapUv:R&&p(i.specularMap.channel),specularColorMapUv:Te&&p(i.specularColorMap.channel),specularIntensityMapUv:z&&p(i.specularIntensityMap.channel),transmissionMapUv:B&&p(i.transmissionMap.channel),thicknessMapUv:Ee&&p(i.thicknessMap.channel),alphaMapUv:Oe&&p(i.alphaMap.channel),vertexTangents:!!_.attributes.tangent&&(ae||ue),vertexNormals:!!_.attributes.normal,vertexColors:i.vertexColors,vertexAlphas:i.vertexColors===!0&&!!_.attributes.color&&_.attributes.color.itemSize===4,pointsUvs:m.isPoints===!0&&!!_.attributes.uv&&(N||Oe),fog:!!g,useFog:i.fog===!0,fogExp2:!!g&&g.isFogExp2,flatShading:i.wireframe===!1&&(i.flatShading===!0||_.attributes.normal===void 0&&ae===!1&&(i.isMeshLambertMaterial||i.isMeshPhongMaterial||i.isMeshStandardMaterial||i.isMeshPhysicalMaterial)),sizeAttenuation:i.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:j,skinning:m.isSkinnedMesh===!0,hasPositionAttribute:_.attributes.position!==void 0,morphTargets:_.morphAttributes.position!==void 0,morphNormals:_.morphAttributes.normal!==void 0,morphColors:_.morphAttributes.color!==void 0,morphTargetsCount:w,morphTextureStride:T,numSunLights:o.sun.length,numDirLights:o.directional.length,numPointLights:o.point.length,numSpotLights:o.spot.length,numSpotLightMaps:o.spotLightMap.length,numRectAreaLights:o.rectArea.length,numHemiLights:o.hemi.length,numSunLightShadows:o.sunShadowMap.length,numDirLightShadows:o.directionalShadowMap.length,numPointLightShadows:o.pointShadowMap.length,numSpotLightShadows:o.spotShadowMap.length,numSpotLightShadowsWithMaps:o.numSpotLightShadowsWithMaps,numLightProbes:o.numLightProbes,numLightProbeGrids:h.filter(e=>e.texture!==null).length,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:i.dithering,shadowMapEnabled:e.shadowMap.enabled&&l.length>0,shadowMapType:e.shadowMap.type,toneMapping:Me,decodeVideoTexture:N&&i.map.isVideoTexture===!0&&Ki.getTransfer(i.map.colorSpace)===`srgb`,decodeVideoTextureEmissive:se&&i.emissiveMap.isVideoTexture===!0&&Ki.getTransfer(i.emissiveMap.colorSpace)===`srgb`,premultipliedAlpha:i.premultipliedAlpha,doubleSided:i.side===2,flipSided:i.side===1,useDepthPacking:i.depthPacking>=0,depthPacking:i.depthPacking||0,index0AttributeName:i.index0AttributeName,extensionClipCullDistance:je&&i.extensions.clipCullDistance===!0&&n.has(`WEBGL_clip_cull_distance`),extensionMultiDraw:(je&&i.extensions.multiDraw===!0||M)&&n.has(`WEBGL_multi_draw`),rendererExtensionParallelShaderCompile:n.has(`KHR_parallel_shader_compile`),customProgramCacheKey:i.customProgramCacheKey()};return Pe.vertexUv1s=c.has(1),Pe.vertexUv2s=c.has(2),Pe.vertexUv3s=c.has(3),c.clear(),Pe}function h(t){let n=[];if(t.shaderID?n.push(t.shaderID):(n.push(t.customVertexShaderID),n.push(t.customFragmentShaderID)),t.defines!==void 0)for(let e in t.defines)n.push(e),n.push(t.defines[e]);return t.isRawShaderMaterial===!1&&(g(n,t),_(n,t),n.push(e.outputColorSpace)),n.push(t.customProgramCacheKey),n.join()}function g(e,t){e.push(t.precision),e.push(t.outputColorSpace),e.push(t.envMapMode),e.push(t.envMapPMREM),e.push(t.envMapMaxLod),e.push(t.envMapSize),e.push(t.mapUv),e.push(t.alphaMapUv),e.push(t.lightMapUv),e.push(t.aoMapUv),e.push(t.bumpMapUv),e.push(t.normalMapUv),e.push(t.displacementMapUv),e.push(t.emissiveMapUv),e.push(t.metalnessMapUv),e.push(t.roughnessMapUv),e.push(t.anisotropyMapUv),e.push(t.clearcoatMapUv),e.push(t.clearcoatNormalMapUv),e.push(t.clearcoatRoughnessMapUv),e.push(t.diffuseRoughnessMapUv),e.push(t.iridescenceMapUv),e.push(t.iridescenceThicknessMapUv),e.push(t.sheenColorMapUv),e.push(t.sheenRoughnessMapUv),e.push(t.specularMapUv),e.push(t.specularColorMapUv),e.push(t.specularIntensityMapUv),e.push(t.transmissionMapUv),e.push(t.thicknessMapUv),e.push(t.combine),e.push(t.fogExp2),e.push(t.sizeAttenuation),e.push(t.morphTargetsCount),e.push(t.numSunLights),e.push(t.numDirLights),e.push(t.numPointLights),e.push(t.numSpotLights),e.push(t.numSpotLightMaps),e.push(t.numHemiLights),e.push(t.numRectAreaLights),e.push(t.numSunLightShadows),e.push(t.numDirLightShadows),e.push(t.numPointLightShadows),e.push(t.numSpotLightShadows),e.push(t.numSpotLightShadowsWithMaps),e.push(t.numLightProbes),e.push(t.numLightProbeGrids),e.push(t.shadowMapType),e.push(t.toneMapping),e.push(t.numClippingPlanes),e.push(t.numClipIntersection),e.push(t.depthPacking)}function _(e,t){o.disableAll(),t.instancing&&o.enable(0),t.instancingColor&&o.enable(1),t.instancingMorph&&o.enable(2),t.matcap&&o.enable(3),t.envMap&&o.enable(4),t.normalMapObjectSpace&&o.enable(5),t.normalMapTangentSpace&&o.enable(6),t.clearcoat&&o.enable(7),t.iridescence&&o.enable(8),t.alphaTest&&o.enable(9),t.vertexColors&&o.enable(10),t.vertexAlphas&&o.enable(11),t.vertexUv1s&&o.enable(12),t.vertexUv2s&&o.enable(13),t.vertexUv3s&&o.enable(14),t.vertexTangents&&o.enable(15),t.anisotropy&&o.enable(16),t.alphaHash&&o.enable(17),t.batching&&o.enable(18),t.dispersion&&o.enable(19),t.retroreflection&&o.enable(24),t.diffuseRoughness&&o.enable(25),t.batchingColor&&o.enable(20),t.gradientMap&&o.enable(21),t.packedNormalMap&&o.enable(22),t.vertexNormals&&o.enable(23),e.push(o.mask),o.disableAll(),t.fog&&o.enable(0),t.useFog&&o.enable(1),t.flatShading&&o.enable(2),t.logarithmicDepthBuffer&&o.enable(3),t.reversedDepthBuffer&&o.enable(4),t.skinning&&o.enable(5),t.morphTargets&&o.enable(6),t.morphNormals&&o.enable(7),t.morphColors&&o.enable(8),t.premultipliedAlpha&&o.enable(9),t.shadowMapEnabled&&o.enable(10),t.doubleSided&&o.enable(11),t.flipSided&&o.enable(12),t.useDepthPacking&&o.enable(13),t.dithering&&o.enable(14),t.transmission&&o.enable(15),t.sheen&&o.enable(16),t.opaque&&o.enable(17),t.pointsUvs&&o.enable(18),t.decodeVideoTexture&&o.enable(19),t.decodeVideoTextureEmissive&&o.enable(20),t.alphaToCoverage&&o.enable(21),t.numLightProbeGrids>0&&o.enable(22),t.hasPositionAttribute&&o.enable(23),e.push(o.mask)}function v(e){let t=f[e.type],n;if(t){let e=Ru[t];n=Dl.clone(e.uniforms)}else n=e.uniforms;return n}function y(t,n){let r=u.get(n);return r===void 0?(r=new op(e,n,t,i),l.push(r),u.set(n,r)):++r.usedTimes,r}function b(e){if(--e.usedTimes===0){let t=l.indexOf(e);l[t]=l[l.length-1],l.pop(),u.delete(e.cacheKey),e.destroy()}}function x(e){s.remove(e)}function S(){s.dispose()}return{getParameters:m,getProgramCacheKey:h,getUniforms:v,acquireProgram:y,releaseProgram:b,releaseShaderCache:x,programs:l,dispose:S}}function fp(){let e=new WeakMap;function t(t){return e.has(t)}function n(t){let n=e.get(t);return n===void 0&&(n={},e.set(t,n)),n}function r(t){e.delete(t)}function i(t,n,r){e.get(t)[n]=r}function a(){e=new WeakMap}return{has:t,get:n,remove:r,update:i,dispose:a}}function pp(e,t){return e.groupOrder===t.groupOrder?e.renderOrder===t.renderOrder?e.material.id===t.material.id?e.materialVariant===t.materialVariant?e.z===t.z?e.id-t.id:e.z-t.z:e.materialVariant-t.materialVariant:e.material.id-t.material.id:e.renderOrder-t.renderOrder:e.groupOrder-t.groupOrder}function mp(e,t){return e.groupOrder===t.groupOrder?e.renderOrder===t.renderOrder?e.z===t.z?e.id-t.id:t.z-e.z:e.renderOrder-t.renderOrder:e.groupOrder-t.groupOrder}function hp(){let e=[],t=0,n=[],r=[],i=[];function a(){t=0,n.length=0,r.length=0,i.length=0}function o(e){let t=0;return e.isInstancedMesh&&(t+=2),e.isSkinnedMesh&&(t+=1),t}function s(n,r,i,a,s,c){let l=e[t];return l===void 0?(l={id:n.id,object:n,geometry:r,material:i,materialVariant:o(n),groupOrder:a,renderOrder:n.renderOrder,z:s,group:c},e[t]=l):(l.id=n.id,l.object=n,l.geometry=r,l.material=i,l.materialVariant=o(n),l.groupOrder=a,l.renderOrder=n.renderOrder,l.z=s,l.group=c),t++,l}function c(e,t,a,o,c,l,u){u.reversedDepth===!0&&(c=-c);let d=s(e,t,a,o,c,l);a.transmission>0?r.push(d):a.transparent===!0?i.push(d):n.push(d)}function l(e,t,a,o,c,l){let u=s(e,t,a,o,c,l);a.transmission>0?r.unshift(u):a.transparent===!0?i.unshift(u):n.unshift(u)}function u(e,t){n.length>1&&n.sort(e||pp),r.length>1&&r.sort(t||mp),i.length>1&&i.sort(t||mp)}function d(){for(let n=t,r=e.length;n<r;n++){let t=e[n];if(t.id===null)break;t.id=null,t.object=null,t.geometry=null,t.material=null,t.group=null}}return{opaque:n,transmissive:r,transparent:i,init:a,push:c,unshift:l,finish:d,sort:u}}function gp(){let e=new WeakMap;function t(t,n){let r=e.get(t),i;return r===void 0?(i=new hp,e.set(t,[i])):n>=r.length?(i=new hp,r.push(i)):i=r[n],i}function n(){e=new WeakMap}return{get:t,dispose:n}}function _p(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case`SunLight`:case`DirectionalLight`:n={direction:new G,color:new J};break;case`SpotLight`:n={position:new G,direction:new G,color:new J,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case`PointLight`:n={position:new G,color:new J,distance:0,decay:0};break;case`HemisphereLight`:n={direction:new G,skyColor:new J,groundColor:new J};break;case`RectAreaLight`:n={color:new J,position:new G,halfWidth:new G,halfHeight:new G}}return e[t.id]=n,n}}}function vp(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case`SunLight`:case`DirectionalLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new W};break;case`SpotLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new W};break;case`PointLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new W,shadowCameraNear:1,shadowCameraFar:1e3}}return e[t.id]=n,n}}}var yp=0;function bp(e,t){return(t.castShadow?2:0)-(e.castShadow?2:0)+ +!!t.map-!!e.map}function xp(e){let t=new _p,n=vp(),r={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let e=0;e<9;e++)r.probe.push(new G);let i=new G,a=new q,o=new q;function s(i){let a=0,o=0,s=0;for(let e=0;e<9;e++)r.probe[e].set(0,0,0);let c=0,l=0,u=0,d=0,f=0,p=0,m=0,h=0,g=0,_=0,v=0,y=0,b=0,x=0;i.sort(bp);for(let e=0,S=i.length;e<S;e++){let S=i[e],C=S.color,w=S.intensity,T=S.distance,E=null;if(S.shadow&&S.shadow.map&&(E=S.shadow.map.texture.format===1030?S.shadow.map.texture:S.shadow.map.depthTexture||S.shadow.map.texture),S.isAmbientLight)a+=C.r*w,o+=C.g*w,s+=C.b*w;else if(S.isLightProbe){for(let e=0;e<9;e++)r.probe[e].addScaledVector(S.sh.coefficients[e],w);x++}else if(S.isSunLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize.copy(e.mapSize).multiply(e.getFrameExtents()),r.sunShadow[l]=t,r.sunShadowMap[l]=E;let i=e.getViewportCount();for(let t=0;t<i;t++)r.sunShadowMatrix[u+t]=e.getMatrix(t),r.sunShadowCascade[u+t]=e._cascadeData[t];u+=i,l++}r.sun[c]=e,c++}else if(S.isDirectionalLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize=e.mapSize,r.directionalShadow[d]=t,r.directionalShadowMap[d]=E,r.directionalShadowMatrix[d]=S.shadow.matrix,g++}r.directional[d]=e,d++}else if(S.isSpotLight){let e=t.get(S);e.position.setFromMatrixPosition(S.matrixWorld),e.color.copy(C).multiplyScalar(w),e.distance=T,e.coneCos=Math.cos(S.angle),e.penumbraCos=Math.cos(S.angle*(1-S.penumbra)),e.decay=S.decay,r.spot[p]=e;let i=S.shadow;if(S.map&&(r.spotLightMap[y]=S.map,y++,i.updateMatrices(S),S.castShadow&&b++),r.spotLightMatrix[p]=i.matrix,S.castShadow){let e=n.get(S);e.shadowIntensity=i.intensity,e.shadowBias=i.bias,e.shadowNormalBias=i.normalBias,e.shadowRadius=i.radius,e.shadowMapSize=i.mapSize,r.spotShadow[p]=e,r.spotShadowMap[p]=E,v++}p++}else if(S.isRectAreaLight){let e=t.get(S);e.color.copy(C).multiplyScalar(w),e.halfWidth.set(S.width*.5,0,0),e.halfHeight.set(0,S.height*.5,0),r.rectArea[m]=e,m++}else if(S.isPointLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),e.distance=S.distance,e.decay=S.decay,S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize=e.mapSize,t.shadowCameraNear=e.camera.near,t.shadowCameraFar=e.camera.far,r.pointShadow[f]=t,r.pointShadowMap[f]=E,r.pointShadowMatrix[f]=S.shadow.matrix,_++}r.point[f]=e,f++}else if(S.isHemisphereLight){let e=t.get(S);e.skyColor.copy(S.color).multiplyScalar(w),e.groundColor.copy(S.groundColor).multiplyScalar(w),r.hemi[h]=e,h++}}m>0&&(e.has(`OES_texture_float_linear`)===!0?(r.rectAreaLTC1=Z.LTC_FLOAT_1,r.rectAreaLTC2=Z.LTC_FLOAT_2):(r.rectAreaLTC1=Z.LTC_HALF_1,r.rectAreaLTC2=Z.LTC_HALF_2)),r.ambient[0]=a,r.ambient[1]=o,r.ambient[2]=s;let S=r.hash;(S.sunLength!==c||S.directionalLength!==d||S.pointLength!==f||S.spotLength!==p||S.rectAreaLength!==m||S.hemiLength!==h||S.numSunShadows!==l||S.numDirectionalShadows!==g||S.numPointShadows!==_||S.numSpotShadows!==v||S.numSpotMaps!==y||S.numLightProbes!==x)&&(r.sun.length=c,r.directional.length=d,r.spot.length=p,r.rectArea.length=m,r.point.length=f,r.hemi.length=h,r.sunShadow.length=l,r.sunShadowMap.length=l,r.sunShadowMatrix.length=u,r.sunShadowCascade.length=u,r.directionalShadow.length=g,r.directionalShadowMap.length=g,r.directionalShadowMatrix.length=g,r.pointShadow.length=_,r.pointShadowMap.length=_,r.pointShadowMatrix.length=_,r.spotShadow.length=v,r.spotShadowMap.length=v,r.spotLightMatrix.length=v+y-b,r.spotLightMap.length=y,r.numSpotLightShadowsWithMaps=b,r.numLightProbes=x,S.sunLength=c,S.directionalLength=d,S.pointLength=f,S.spotLength=p,S.rectAreaLength=m,S.hemiLength=h,S.numSunShadows=l,S.numDirectionalShadows=g,S.numPointShadows=_,S.numSpotShadows=v,S.numSpotMaps=y,S.numLightProbes=x,r.version=yp++)}function c(e,t){let n=0,s=0,c=0,l=0,u=0,d=0,f=t.matrixWorldInverse;for(let t=0,p=e.length;t<p;t++){let p=e[t];if(p.isSunLight){let e=r.sun[n];e.direction.setFromMatrixPosition(p.matrixWorld),e.direction.transformDirection(f),n++}else if(p.isDirectionalLight){let e=r.directional[s];e.direction.setFromMatrixPosition(p.matrixWorld),i.setFromMatrixPosition(p.target.matrixWorld),e.direction.sub(i),e.direction.transformDirection(f),s++}else if(p.isSpotLight){let e=r.spot[l];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),e.direction.setFromMatrixPosition(p.matrixWorld),i.setFromMatrixPosition(p.target.matrixWorld),e.direction.sub(i),e.direction.transformDirection(f),l++}else if(p.isRectAreaLight){let e=r.rectArea[u];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),o.identity(),a.copy(p.matrixWorld),a.premultiply(f),o.extractRotation(a),e.halfWidth.set(p.width*.5,0,0),e.halfHeight.set(0,p.height*.5,0),e.halfWidth.applyMatrix4(o),e.halfHeight.applyMatrix4(o),u++}else if(p.isPointLight){let e=r.point[c];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),c++}else if(p.isHemisphereLight){let e=r.hemi[d];e.direction.setFromMatrixPosition(p.matrixWorld),e.direction.transformDirection(f),d++}}}return{setup:s,setupView:c,state:r}}function Sp(e){let t=new xp(e),n=[],r=[],i=[];function a(e){u.camera=e,n.length=0,r.length=0,i.length=0}function o(e){e.isLightProbeGrid?i.push(e):n.push(e)}function s(e){r.push(e)}function c(){t.setup(n),i.sort((e,t)=>e.priority-t.priority||e.id-t.id)}function l(e){t.setupView(n,e)}let u={lightsArray:n,shadowsArray:r,lightProbeGridArray:i,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:a,state:u,setupLights:c,setupLightsView:l,pushLight:o,pushShadow:s}}function Cp(e){let t=new WeakMap;function n(n,r=0){let i=t.get(n),a;return i===void 0?(a=new Sp(e),t.set(n,[a])):r>=i.length?(a=new Sp(e),i.push(a)):a=i[r],a}function r(){t=new WeakMap}return{get:n,dispose:r}}var wp=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Tp=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,Ep=[new G(1,0,0),new G(-1,0,0),new G(0,1,0),new G(0,-1,0),new G(0,0,1),new G(0,0,-1)],Dp=[new G(0,-1,0),new G(0,-1,0),new G(0,0,1),new G(0,0,-1),new G(0,-1,0),new G(0,-1,0)],Op=new q,kp=new G,Ap=new G;function jp(e,t,n){let r=new ic,i=new W,a=new W,o=new ra,s=new Nl,c=new Pl,l={},u=n.maxTextureSize,d={0:1,1:0,2:2},f=new Al({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new W},radius:{value:4}},vertexShader:wp,fragmentShader:Tp}),p=f.clone();p.defines.HORIZONTAL_PASS=1;let m=new Ro;m.setAttribute(`position`,new wo(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let h=new Os(m,f),g=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=1;let _=this.type;this.render=function(t,n,s){if(g.enabled===!1||g.autoUpdate===!1&&g.needsUpdate===!1||t.length===0)return;this.type===2&&(V(`WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.`),this.type=1);let c=e.getRenderTarget(),l=e.getActiveCubeFace(),d=e.getActiveMipmapLevel(),f=e.state;f.setBlending(0),f.buffers.depth.getReversed()===!0?f.buffers.color.setClear(0,0,0,0):f.buffers.color.setClear(1,1,1,1),f.buffers.depth.setTest(!0),f.setScissorTest(!1);let p=_!==this.type;p&&n.traverse(function(e){e.material&&(Array.isArray(e.material)?e.material.forEach(e=>e.needsUpdate=!0):e.material.needsUpdate=!0)});for(let c=0,l=t.length;c<l;c++){let l=t[c],d=l.shadow;if(d===void 0){V(`WebGLShadowMap:`,l,`has no shadow.`);continue}if(d.autoUpdate===!1&&d.needsUpdate===!1)continue;i.copy(d.mapSize);let m=d.getFrameExtents();i.multiply(m),a.copy(d.mapSize),(i.x>u||i.y>u)&&(i.x>u&&(a.x=Math.floor(u/m.x),i.x=a.x*m.x,d.mapSize.x=a.x),i.y>u&&(a.y=Math.floor(u/m.y),i.y=a.y*m.y,d.mapSize.y=a.y));let h=e.state.buffers.depth.getReversed();if(d.camera._reversedDepth=h,d.map===null||p===!0){if(d.map!==null&&(d.map.depthTexture!==null&&(d.map.depthTexture.dispose(),d.map.depthTexture=null),d.map.dispose()),this.type===3){if(l.isPointLight){V(`WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.`);continue}d.map=new aa(i.x,i.y,{format:_r,type:ir,minFilter:Jn,magFilter:Jn,generateMipmaps:!1}),d.map.texture.name=l.name+`.shadowMap`,d.map.depthTexture=new gc(i.x,i.y,rr),d.map.depthTexture.name=l.name+`.shadowMapDepth`,d.map.depthTexture.format=pr,d.map.depthTexture.compareFunction=null,d.map.depthTexture.minFilter=Gn,d.map.depthTexture.magFilter=Gn}else l.isPointLight?(d.map=new qu(i.x),d.map.depthTexture=new _c(i.x,nr)):(d.map=new aa(i.x,i.y),d.map.depthTexture=new gc(i.x,i.y,nr)),d.map.depthTexture.name=l.name+`.shadowMap`,d.map.depthTexture.format=pr,this.type===1?(d.map.depthTexture.compareFunction=h?518:515,d.map.depthTexture.minFilter=Jn,d.map.depthTexture.magFilter=Jn):(d.map.depthTexture.compareFunction=null,d.map.depthTexture.minFilter=Gn,d.map.depthTexture.magFilter=Gn);d.camera.updateProjectionMatrix()}d.map.isWebGLCubeRenderTarget!==!0&&(d.map.width!==i.x||d.map.height!==i.y)&&d.map.setSize(i.x,i.y);let g=d.map.isWebGLCubeRenderTarget?6:d.getViewportCount();l.isPointLight!==!0&&d.updateMatrices(l,s);let _=d.camera.layers.mask&4294967294?d.camera.layers:s.layers;for(let t=0;t<g;t++){let i=d.getCamera(t);if(l.isPointLight){let e=d.camera,n=d.matrix,r=l.distance||e.far;r!==e.far&&(e.far=r,e.updateProjectionMatrix()),kp.setFromMatrixPosition(l.matrixWorld),e.position.copy(kp),Ap.copy(e.position),Ap.add(Ep[t]),e.up.copy(Dp[t]),e.lookAt(Ap),e.updateMatrixWorld(),n.makeTranslation(-kp.x,-kp.y,-kp.z),Op.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),d._frustum.setFromProjectionMatrix(Op,e.coordinateSystem,e.reversedDepth)}if(d.map.isWebGLCubeRenderTarget)e.setRenderTarget(d.map,t),e.clear();else{t===0&&(e.setRenderTarget(d.map),e.clear());let n=d.getViewport(t);o.set(a.x*n.x,a.y*n.y,a.x*n.z,a.y*n.w),f.viewport(o)}r=d.getFrustum(t),b(n,s,i,l,_,this.type)}d.isPointLightShadow!==!0&&this.type===3&&v(d,s),d.needsUpdate=!1}_=this.type,g.needsUpdate=!1,e.setRenderTarget(c,l,d)};function v(n,r){let a=t.update(h);f.defines.VSM_SAMPLES!==n.blurSamples&&(f.defines.VSM_SAMPLES=n.blurSamples,p.defines.VSM_SAMPLES=n.blurSamples,f.needsUpdate=!0,p.needsUpdate=!0),n.mapPass===null?n.mapPass=new aa(i.x,i.y,{format:_r,type:ir}):(n.mapPass.width!==n.map.width||n.mapPass.height!==n.map.height)&&n.mapPass.setSize(n.map.width,n.map.height),f.uniforms.shadow_pass.value=n.map.depthTexture,f.uniforms.resolution.value.set(n.map.width,n.map.height),f.uniforms.radius.value=n.radius,e.setRenderTarget(n.mapPass),e.clear(),e.renderBufferDirect(r,null,a,f,h,null),p.uniforms.shadow_pass.value=n.mapPass.texture,p.uniforms.resolution.value.set(n.map.width,n.map.height),p.uniforms.radius.value=n.radius,e.setRenderTarget(n.map),e.clear(),e.renderBufferDirect(r,null,a,p,h,null)}function y(t,n,r,i){let a=null,o=r.isPointLight===!0?t.customDistanceMaterial:t.customDepthMaterial;if(o!==void 0)a=o;else if(a=r.isPointLight===!0?c:s,e.localClippingEnabled&&n.clipShadows===!0&&Array.isArray(n.clippingPlanes)&&n.clippingPlanes.length!==0||n.displacementMap&&n.displacementScale!==0||n.alphaMap&&n.alphaTest>0||n.map&&n.alphaTest>0||n.alphaToCoverage===!0){let e=a.uuid,t=n.uuid,r=l[e];r===void 0&&(r={},l[e]=r);let i=r[t];i===void 0&&(i=a.clone(),r[t]=i,n.addEventListener(`dispose`,x)),a=i}if(a.visible=n.visible,a.wireframe=n.wireframe,i===3?a.side=n.shadowSide===null?n.side:n.shadowSide:a.side=n.shadowSide===null?d[n.side]:n.shadowSide,a.alphaMap=n.alphaMap,a.alphaTest=n.alphaToCoverage===!0?.5:n.alphaTest,a.map=n.map,a.clipShadows=n.clipShadows,a.clippingPlanes=n.clippingPlanes,a.clipIntersection=n.clipIntersection,a.displacementMap=n.displacementMap,a.displacementScale=n.displacementScale,a.displacementBias=n.displacementBias,a.wireframeLinewidth=n.wireframeLinewidth,a.linewidth=n.linewidth,r.isPointLight===!0&&a.isMeshDistanceMaterial===!0){let t=e.properties.get(a);t.light=r}return a}function b(n,i,a,o,s,c){if(n.visible===!1)return;if(n.layers.test(s)&&(n.isMesh||n.isLine||n.isPoints)&&(n.castShadow||n.receiveShadow&&c===3)&&(!n.frustumCulled||n.intersectsFrustum(r))){n.modelViewMatrix.multiplyMatrices(a.matrixWorldInverse,n.matrixWorld);let r=t.update(n),s=n.material;if(Array.isArray(s)){let t=r.groups;for(let l=0,u=t.length;l<u;l++){let u=t[l],d=s[u.materialIndex];if(d&&d.visible){let t=y(n,d,o,c);n.onBeforeShadow(e,n,i,a,r,t,u),e.renderBufferDirect(a,null,r,t,n,u),n.onAfterShadow(e,n,i,a,r,t,u)}}}else if(s.visible){let t=y(n,s,o,c);n.onBeforeShadow(e,n,i,a,r,t,null),e.renderBufferDirect(a,null,r,t,n,null),n.onAfterShadow(e,n,i,a,r,t,null)}}let l=n.children;for(let e=0,t=l.length;e<t;e++)b(l[e],i,a,o,s,c)}function x(e){e.target.removeEventListener(`dispose`,x);for(let t in l){let n=l[t],r=e.target.uuid;r in n&&(n[r].dispose(),delete n[r])}}}function Mp(e,t){function n(){let t=!1,n=new ra,r=null,i=new ra(0,0,0,0);return{setMask:function(n){r!==n&&!t&&(e.colorMask(n,n,n,n),r=n)},setLocked:function(e){t=e},setClear:function(t,r,a,o,s){s===!0&&(t*=o,r*=o,a*=o),n.set(t,r,a,o),i.equals(n)===!1&&(e.clearColor(t,r,a,o),i.copy(n))},reset:function(){t=!1,r=null,i.set(-1,0,0,0)}}}function r(){let n=!1,r=!1,i=null,a=null,o=null;return{setReversed:function(e){if(r!==e){let n=t.get(`EXT_clip_control`);e?n.clipControlEXT(n.LOWER_LEFT_EXT,n.ZERO_TO_ONE_EXT):n.clipControlEXT(n.LOWER_LEFT_EXT,n.NEGATIVE_ONE_TO_ONE_EXT),r=e;let i=o;o=null,this.setClear(i)}},getReversed:function(){return r},setTest:function(t){t?ce(e.DEPTH_TEST):le(e.DEPTH_TEST)},setMask:function(t){i!==t&&!n&&(e.depthMask(t),i=t)},setFunc:function(t){if(r&&(t=Di[t]),a!==t){switch(t){case 0:e.depthFunc(e.NEVER);break;case 1:e.depthFunc(e.ALWAYS);break;case 2:e.depthFunc(e.LESS);break;case 3:e.depthFunc(e.LEQUAL);break;case 4:e.depthFunc(e.EQUAL);break;case 5:e.depthFunc(e.GEQUAL);break;case 6:e.depthFunc(e.GREATER);break;case 7:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}a=t}},setLocked:function(e){n=e},setClear:function(t){o!==t&&(o=t,r&&(t=1-t),e.clearDepth(t))},reset:function(){n=!1,i=null,a=null,o=null,r=!1}}}function i(){let t=!1,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null;return{setTest:function(n){t||(n?ce(e.STENCIL_TEST):le(e.STENCIL_TEST))},setMask:function(r){n!==r&&!t&&(e.stencilMask(r),n=r)},setFunc:function(t,n,o){(r!==t||i!==n||a!==o)&&(e.stencilFunc(t,n,o),r=t,i=n,a=o)},setOp:function(t,n,r){(o!==t||s!==n||c!==r)&&(e.stencilOp(t,n,r),o=t,s=n,c=r)},setLocked:function(e){t=e},setClear:function(t){l!==t&&(e.clearStencil(t),l=t)},reset:function(){t=!1,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null}}}let a=new n,o=new r,s=new i,c={},l=new WeakMap,u={},d={},f={},p=new WeakMap,m=[],h=null,g=!1,_=null,v=null,y=null,b=null,x=null,S=null,C=null,w=new J(0,0,0),T=0,E=!1,D=null,O=null,k=null,A=null,j=null,ee=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS),M=!1,N=0,P=e.getParameter(e.VERSION);P.indexOf(`WebGL`)===-1?P.indexOf(`OpenGL ES`)!==-1&&(N=parseFloat(/^OpenGL ES (\d)/.exec(P)[1]),M=N>=2):(N=parseFloat(/^WebGL (\d)/.exec(P)[1]),M=N>=1);let F=null,te={},ne=e.getParameter(e.SCISSOR_BOX),re=e.getParameter(e.VIEWPORT),ie=new ra().fromArray(ne),ae=new ra().fromArray(re);function oe(t,n,r,i){let a=new Uint8Array(4),o=e.createTexture();e.bindTexture(t,o),e.texParameteri(t,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(t,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let o=0;o<r;o++)t===e.TEXTURE_3D||t===e.TEXTURE_2D_ARRAY?e.texImage3D(n,0,e.RGBA,1,1,i,0,e.RGBA,e.UNSIGNED_BYTE,a):e.texImage2D(n+o,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,a);return o}let se={};se[e.TEXTURE_2D]=oe(e.TEXTURE_2D,e.TEXTURE_2D,1),se[e.TEXTURE_CUBE_MAP]=oe(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),se[e.TEXTURE_2D_ARRAY]=oe(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),se[e.TEXTURE_3D]=oe(e.TEXTURE_3D,e.TEXTURE_3D,1,1),a.setClear(0,0,0,1),o.setClear(1),s.setClear(0),ce(e.DEPTH_TEST),o.setFunc(3),ge(!1),_e(1),ce(e.CULL_FACE),me(0);function ce(t){u[t]!==!0&&(e.enable(t),u[t]=!0)}function le(t){u[t]!==!1&&(e.disable(t),u[t]=!1)}function ue(t,n){return f[t]!==n&&(e.bindFramebuffer(t,n),f[t]=n,t===e.DRAW_FRAMEBUFFER&&(f[e.FRAMEBUFFER]=n),t===e.FRAMEBUFFER&&(f[e.DRAW_FRAMEBUFFER]=n),!0)}function I(t,n){let r=m,i=!1;if(t){r=p.get(n),r===void 0&&(r=[],p.set(n,r));let a=t.textures;if(r.length!==a.length||r[0]!==e.COLOR_ATTACHMENT0){for(let t=0,n=a.length;t<n;t++)r[t]=e.COLOR_ATTACHMENT0+t;r.length=a.length,i=!0}}else r[0]!==e.BACK&&(r[0]=e.BACK,i=!0);i&&e.drawBuffers(r)}function de(t){return h!==t&&(e.useProgram(t),h=t,!0)}let fe={100:e.FUNC_ADD,101:e.FUNC_SUBTRACT,102:e.FUNC_REVERSE_SUBTRACT};fe[103]=e.MIN,fe[104]=e.MAX;let pe={200:e.ZERO,201:e.ONE,202:e.SRC_COLOR,204:e.SRC_ALPHA,210:e.SRC_ALPHA_SATURATE,208:e.DST_COLOR,206:e.DST_ALPHA,203:e.ONE_MINUS_SRC_COLOR,205:e.ONE_MINUS_SRC_ALPHA,209:e.ONE_MINUS_DST_COLOR,207:e.ONE_MINUS_DST_ALPHA,211:e.CONSTANT_COLOR,212:e.ONE_MINUS_CONSTANT_COLOR,213:e.CONSTANT_ALPHA,214:e.ONE_MINUS_CONSTANT_ALPHA};function me(t,n,r,i,a,o,s,c,l,u){if(t===0)g===!0&&(le(e.BLEND),g=!1);else if(g===!1&&(ce(e.BLEND),g=!0),t!==5){if(t!==_||u!==E){if((v!==100||x!==100)&&(e.blendEquation(e.FUNC_ADD),v=100,x=100),u)switch(t){case 1:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFunc(e.ONE,e.ONE);break;case 3:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case 4:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:H(`WebGLState: Invalid blending: `,t)}else switch(t){case 1:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case 3:H(`WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true`);break;case 4:H(`WebGLState: MultiplyBlending requires material.premultipliedAlpha = true`);break;default:H(`WebGLState: Invalid blending: `,t)}y=null,b=null,S=null,C=null,w.set(0,0,0),T=0,_=t,E=u}}else a=a||n,o=o||r,s=s||i,(n!==v||a!==x)&&(e.blendEquationSeparate(fe[n],fe[a]),v=n,x=a),(r!==y||i!==b||o!==S||s!==C)&&(e.blendFuncSeparate(pe[r],pe[i],pe[o],pe[s]),y=r,b=i,S=o,C=s),(c.equals(w)===!1||l!==T)&&(e.blendColor(c.r,c.g,c.b,l),w.copy(c),T=l),_=t,E=!1}function he(t,n){t.side===2?le(e.CULL_FACE):ce(e.CULL_FACE);let r=t.side===1;n&&(r=!r),ge(r),t.blending===1&&t.transparent===!1?me(0):me(t.blending,t.blendEquation,t.blendSrc,t.blendDst,t.blendEquationAlpha,t.blendSrcAlpha,t.blendDstAlpha,t.blendColor,t.blendAlpha,t.premultipliedAlpha),o.setFunc(t.depthFunc),o.setTest(t.depthTest),o.setMask(t.depthWrite),a.setMask(t.colorWrite);let i=t.stencilWrite;s.setTest(i),i&&(s.setMask(t.stencilWriteMask),s.setFunc(t.stencilFunc,t.stencilRef,t.stencilFuncMask),s.setOp(t.stencilFail,t.stencilZFail,t.stencilZPass)),ye(t.polygonOffset,t.polygonOffsetFactor,t.polygonOffsetUnits),t.alphaToCoverage===!0?ce(e.SAMPLE_ALPHA_TO_COVERAGE):le(e.SAMPLE_ALPHA_TO_COVERAGE)}function ge(t){D!==t&&(t?e.frontFace(e.CW):e.frontFace(e.CCW),D=t)}function _e(t){t===0?le(e.CULL_FACE):(ce(e.CULL_FACE),t!==O&&(t===1?e.cullFace(e.BACK):t===2?e.cullFace(e.FRONT):e.cullFace(e.FRONT_AND_BACK))),O=t}function ve(t){t!==k&&(M&&e.lineWidth(t),k=t)}function ye(t,n,r){t?(ce(e.POLYGON_OFFSET_FILL),(A!==n||j!==r)&&(A=n,j=r,o.getReversed()&&(n=-n,r=-r),e.polygonOffset(n,r))):le(e.POLYGON_OFFSET_FILL)}function be(t){t?ce(e.SCISSOR_TEST):le(e.SCISSOR_TEST)}function xe(t){t===void 0&&(t=e.TEXTURE0+ee-1),F!==t&&(e.activeTexture(t),F=t)}function L(t,n,r){r===void 0&&(r=F===null?e.TEXTURE0+ee-1:F);let i=te[r];i===void 0&&(i={type:void 0,texture:void 0},te[r]=i),(i.type!==t||i.texture!==n)&&(F!==r&&(e.activeTexture(r),F=r),e.bindTexture(t,n||se[t]),i.type=t,i.texture=n)}function Se(){let t=te[F];t!==void 0&&t.type!==void 0&&(e.bindTexture(t.type,null),t.type=void 0,t.texture=void 0)}function Ce(){try{e.compressedTexImage2D(...arguments)}catch(e){H(`WebGLState:`,e)}}function we(){try{e.compressedTexImage3D(...arguments)}catch(e){H(`WebGLState:`,e)}}function R(){try{e.texSubImage2D(...arguments)}catch(e){H(`WebGLState:`,e)}}function Te(){try{e.texSubImage3D(...arguments)}catch(e){H(`WebGLState:`,e)}}function z(){try{e.compressedTexSubImage2D(...arguments)}catch(e){H(`WebGLState:`,e)}}function B(){try{e.compressedTexSubImage3D(...arguments)}catch(e){H(`WebGLState:`,e)}}function Ee(){try{e.texStorage2D(...arguments)}catch(e){H(`WebGLState:`,e)}}function De(){try{e.texStorage3D(...arguments)}catch(e){H(`WebGLState:`,e)}}function Oe(){try{e.texImage2D(...arguments)}catch(e){H(`WebGLState:`,e)}}function ke(){try{e.texImage3D(...arguments)}catch(e){H(`WebGLState:`,e)}}function Ae(t){return d[t]===void 0?e.getParameter(t):d[t]}function je(t,n){d[t]!==n&&(e.pixelStorei(t,n),d[t]=n)}function Me(t){ie.equals(t)===!1&&(e.scissor(t.x,t.y,t.z,t.w),ie.copy(t))}function Ne(t){ae.equals(t)===!1&&(e.viewport(t.x,t.y,t.z,t.w),ae.copy(t))}function Pe(t,n){let r=l.get(n);r===void 0&&(r=new WeakMap,l.set(n,r));let i=r.get(t);i===void 0&&(i=e.getUniformBlockIndex(n,t.name),e.uniformBlockBinding(n,i,i),r.set(t,i))}function Fe(t,n,r){let i=l.get(n).get(t);c[i]!==r&&(e.bindBufferBase(e.UNIFORM_BUFFER,i,r),c[i]=r)}function Ie(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),o.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),e.pixelStorei(e.PACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),e.pixelStorei(e.PACK_ROW_LENGTH,0),e.pixelStorei(e.PACK_SKIP_PIXELS,0),e.pixelStorei(e.PACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_IMAGE_HEIGHT,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_IMAGES,0),u={},d={},F=null,te={},f={},c={},p=new WeakMap,m=[],h=null,g=!1,_=null,v=null,y=null,b=null,x=null,S=null,C=null,w=new J(0,0,0),T=0,E=!1,D=null,O=null,k=null,A=null,j=null,ie.set(0,0,e.canvas.width,e.canvas.height),ae.set(0,0,e.canvas.width,e.canvas.height),a.reset(),o.reset(),s.reset()}return{buffers:{color:a,depth:o,stencil:s},enable:ce,disable:le,bindFramebuffer:ue,drawBuffers:I,useProgram:de,setBlending:me,setMaterial:he,setFlipSided:ge,setCullFace:_e,setLineWidth:ve,setPolygonOffset:ye,setScissorTest:be,activeTexture:xe,bindTexture:L,unbindTexture:Se,compressedTexImage2D:Ce,compressedTexImage3D:we,texImage2D:Oe,texImage3D:ke,pixelStorei:je,getParameter:Ae,updateUBOMapping:Pe,uniformBlockBinding:Fe,texStorage2D:Ee,texStorage3D:De,texSubImage2D:R,texSubImage3D:Te,compressedTexSubImage2D:z,compressedTexSubImage3D:B,scissor:Me,viewport:Ne,reset:Ie}}function Np(e,t,n,r,i,a,o){let s=t.has(`WEBGL_multisampled_render_to_texture`)?t.get(`WEBGL_multisampled_render_to_texture`):null,c=typeof navigator>`u`?!1:/OculusBrowser/g.test(navigator.userAgent),l=new W,u=new WeakMap,d=new Set,f,p=new WeakMap,m=new Set,h=new FinalizationRegistry(e=>m.delete(e)),g=!1;try{g=typeof OffscreenCanvas<`u`&&new OffscreenCanvas(1,1).getContext(`2d`)!==null}catch{}function _(e,t){return g?new OffscreenCanvas(e,t):bi(`canvas`)}function v(e,t,n){let r=1,i=Ee(e);if((i.width>n||i.height>n)&&(r=n/Math.max(i.width,i.height)),r<1){if(typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap||typeof VideoFrame<`u`&&e instanceof VideoFrame){let n=Math.floor(r*i.width),a=Math.floor(r*i.height);f===void 0&&(f=_(n,a));let o=t?_(n,a):f;return o.width=n,o.height=a,o.getContext(`2d`).drawImage(e,0,0,n,a),V(`WebGLRenderer: Texture has been resized from (`+i.width+`x`+i.height+`) to (`+n+`x`+a+`).`),o}return`data`in e&&V(`WebGLRenderer: Image in DataTexture is too big (`+i.width+`x`+i.height+`).`),e}return e}function y(e){return e.generateMipmaps}function b(t){e.generateMipmap(t)}function x(t){return t.isWebGLCubeRenderTarget?e.TEXTURE_CUBE_MAP:t.isWebGL3DRenderTarget?e.TEXTURE_3D:t.isWebGLArrayRenderTarget||t.isCompressedArrayTexture?e.TEXTURE_2D_ARRAY:e.TEXTURE_2D}function S(n,r,i,a,o,s=!1){if(n!==null){if(e[n]!==void 0)return e[n];V(`WebGLRenderer: Attempt to use non-existing WebGL internal format '`+n+`'`)}let c;a&&(c=t.get(`EXT_texture_norm16`),c||V(`WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension`));let l=r;if(r===e.RED&&(i===e.FLOAT&&(l=e.R32F),i===e.HALF_FLOAT&&(l=e.R16F),i===e.UNSIGNED_BYTE&&(l=e.R8),i===e.UNSIGNED_SHORT&&c&&(l=c.R16_EXT),i===e.SHORT&&c&&(l=c.R16_SNORM_EXT)),r===e.RED_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.R8UI),i===e.UNSIGNED_SHORT&&(l=e.R16UI),i===e.UNSIGNED_INT&&(l=e.R32UI),i===e.BYTE&&(l=e.R8I),i===e.SHORT&&(l=e.R16I),i===e.INT&&(l=e.R32I)),r===e.RG&&(i===e.FLOAT&&(l=e.RG32F),i===e.HALF_FLOAT&&(l=e.RG16F),i===e.UNSIGNED_BYTE&&(l=e.RG8),i===e.UNSIGNED_SHORT&&c&&(l=c.RG16_EXT),i===e.SHORT&&c&&(l=c.RG16_SNORM_EXT)),r===e.RG_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RG8UI),i===e.UNSIGNED_SHORT&&(l=e.RG16UI),i===e.UNSIGNED_INT&&(l=e.RG32UI),i===e.BYTE&&(l=e.RG8I),i===e.SHORT&&(l=e.RG16I),i===e.INT&&(l=e.RG32I)),r===e.RGB_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RGB8UI),i===e.UNSIGNED_SHORT&&(l=e.RGB16UI),i===e.UNSIGNED_INT&&(l=e.RGB32UI),i===e.BYTE&&(l=e.RGB8I),i===e.SHORT&&(l=e.RGB16I),i===e.INT&&(l=e.RGB32I)),r===e.RGBA_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RGBA8UI),i===e.UNSIGNED_SHORT&&(l=e.RGBA16UI),i===e.UNSIGNED_INT&&(l=e.RGBA32UI),i===e.BYTE&&(l=e.RGBA8I),i===e.SHORT&&(l=e.RGBA16I),i===e.INT&&(l=e.RGBA32I)),r===e.RGB&&(i===e.UNSIGNED_SHORT&&c&&(l=c.RGB16_EXT),i===e.SHORT&&c&&(l=c.RGB16_SNORM_EXT),i===e.UNSIGNED_INT_5_9_9_9_REV&&(l=e.RGB9_E5),i===e.UNSIGNED_INT_10F_11F_11F_REV&&(l=e.R11F_G11F_B10F)),r===e.RGBA){let t=s?fi:Ki.getTransfer(o);i===e.FLOAT&&(l=e.RGBA32F),i===e.HALF_FLOAT&&(l=e.RGBA16F),i===e.UNSIGNED_BYTE&&(l=t===`srgb`?e.SRGB8_ALPHA8:e.RGBA8),i===e.UNSIGNED_SHORT&&c&&(l=c.RGBA16_EXT),i===e.SHORT&&c&&(l=c.RGBA16_SNORM_EXT),i===e.UNSIGNED_SHORT_4_4_4_4&&(l=e.RGBA4),i===e.UNSIGNED_SHORT_5_5_5_1&&(l=e.RGB5_A1)}return(l===e.R16F||l===e.R32F||l===e.RG16F||l===e.RG32F||l===e.RGBA16F||l===e.RGBA32F)&&t.get(`EXT_color_buffer_float`),l}function C(t,n){let r;return t?n===null||n===1014||n===1020?r=e.DEPTH24_STENCIL8:n===1015?r=e.DEPTH32F_STENCIL8:n===1012&&(r=e.DEPTH24_STENCIL8,V(`DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.`)):n===null||n===1014||n===1020?r=e.DEPTH_COMPONENT24:n===1015?r=e.DEPTH_COMPONENT32F:n===1012&&(r=e.DEPTH_COMPONENT16),r}function w(e,t){return y(e)===!0||e.isFramebufferTexture&&e.minFilter!==1003&&e.minFilter!==1006?Math.log2(Math.max(t.width,t.height))+1:e.mipmaps.length>0?e.mipmaps.length:e.isCompressedTexture&&Array.isArray(e.image)?t.mipmaps.length:1}function T(e){let t=new WeakRef(e);r.get(e).__ref=t,m.add(t),h.register(e,t,t)}function E(e){let t=r.get(e).__ref;t!==void 0&&(m.delete(t),h.unregister(t))}function D(e){k(e.target)}function O(e){A(e.target)}function k(e){e.removeEventListener(`dispose`,D),E(e),ee(e),e.isVideoTexture&&u.delete(e),e.isHTMLTexture&&d.delete(e)}function A(e){e.removeEventListener(`dispose`,O),E(e),N(e)}function j(){for(let e of m){let t=e.deref();t!==void 0&&(t.isRenderTarget===!0?A(t):k(t))}m.clear(),d.clear()}function ee(e){let t=r.get(e);if(t.__webglInit===void 0)return;let n=e.source,i=p.get(n);if(i){let r=i[t.__cacheKey];r.usedTimes--,r.usedTimes===0&&M(e),Object.keys(i).length===0&&p.delete(n)}r.remove(e)}function M(t){let n=r.get(t);e.deleteTexture(n.__webglTexture);let i=t.source,a=p.get(i);delete a[n.__cacheKey],o.memory.textures--}function N(t){let n=r.get(t);n.__depthDisposeCallback&&n.__depthDisposeCallback();let i=t.depthTexture;if(i&&i.renderTarget===t&&k(i),t.isWebGLCubeRenderTarget)for(let t=0;t<6;t++){if(Array.isArray(n.__webglFramebuffer[t]))for(let r=0;r<n.__webglFramebuffer[t].length;r++)e.deleteFramebuffer(n.__webglFramebuffer[t][r]);else e.deleteFramebuffer(n.__webglFramebuffer[t]);n.__webglDepthbuffer&&e.deleteRenderbuffer(n.__webglDepthbuffer[t])}else{if(Array.isArray(n.__webglFramebuffer))for(let t=0;t<n.__webglFramebuffer.length;t++)e.deleteFramebuffer(n.__webglFramebuffer[t]);else e.deleteFramebuffer(n.__webglFramebuffer);if(n.__webglDepthbuffer&&e.deleteRenderbuffer(n.__webglDepthbuffer),n.__webglMultisampledFramebuffer&&e.deleteFramebuffer(n.__webglMultisampledFramebuffer),n.__webglColorRenderbuffer)for(let t=0;t<n.__webglColorRenderbuffer.length;t++)n.__webglColorRenderbuffer[t]&&e.deleteRenderbuffer(n.__webglColorRenderbuffer[t]);n.__webglDepthRenderbuffer&&e.deleteRenderbuffer(n.__webglDepthRenderbuffer)}let a=t.textures;for(let t=0,n=a.length;t<n;t++){let n=r.get(a[t]);n.__webglTexture&&(e.deleteTexture(n.__webglTexture),o.memory.textures--),r.remove(a[t])}r.remove(t)}let P=0;function F(){P=0}function te(){return P}function ne(e){P=e}function re(){let e=P;return e>=i.maxTextures&&V(`WebGLTextures: Trying to use `+(e+1)+` texture units while this GPU supports only `+i.maxTextures),P+=1,e}function ie(e){let t=[];return t.push(e.wrapS),t.push(e.wrapT),t.push(e.wrapR||0),t.push(e.magFilter),t.push(e.minFilter),t.push(e.anisotropy),t.push(e.internalFormat),t.push(e.format),t.push(e.type),t.push(e.generateMipmaps),t.push(e.mipmapsAutoUpdate),t.push(e.premultiplyAlpha),t.push(e.flipY),t.push(e.unpackAlignment),t.push(e.colorSpace),t.join()}function ae(t,i){let a=r.get(t);if(t.isVideoTexture&&z(t),t.isRenderTargetTexture===!1&&t.isExternalTexture!==!0&&t.version>0&&a.__version!==t.version){let e=t.image;if(e===null)V(`WebGLRenderer: Texture marked for update but no image data found.`);else if(e.complete===!1)V(`WebGLRenderer: Texture marked for update but image is incomplete`);else{he(a,t,i);return}}else t.isExternalTexture&&(a.__webglTexture=t.sourceTexture?t.sourceTexture:null);n.bindTexture(e.TEXTURE_2D,a.__webglTexture,e.TEXTURE0+i)}function oe(t,i){let a=r.get(t);t.isRenderTargetTexture===!1&&t.version>0&&a.__version!==t.version?he(a,t,i):(t.isExternalTexture&&(a.__webglTexture=t.sourceTexture?t.sourceTexture:null),n.bindTexture(e.TEXTURE_2D_ARRAY,a.__webglTexture,e.TEXTURE0+i))}function se(t,i){let a=r.get(t);t.isRenderTargetTexture===!1&&t.version>0&&a.__version!==t.version?he(a,t,i):n.bindTexture(e.TEXTURE_3D,a.__webglTexture,e.TEXTURE0+i)}function ce(t,i){let a=r.get(t);t.version>0&&a.__version!==t.version?ge(a,t,i):n.bindTexture(e.TEXTURE_CUBE_MAP,a.__webglTexture,e.TEXTURE0+i)}let le={[Hn]:e.REPEAT,[Un]:e.CLAMP_TO_EDGE,[Wn]:e.MIRRORED_REPEAT},ue={[Gn]:e.NEAREST,[Kn]:e.NEAREST_MIPMAP_NEAREST,[qn]:e.NEAREST_MIPMAP_LINEAR,[Jn]:e.LINEAR,[Yn]:e.LINEAR_MIPMAP_NEAREST,[Xn]:e.LINEAR_MIPMAP_LINEAR},I={512:e.NEVER,519:e.ALWAYS,513:e.LESS,515:e.LEQUAL,514:e.EQUAL,518:e.GEQUAL,516:e.GREATER,517:e.NOTEQUAL};function de(n,a){if(a.type===1015&&t.has(`OES_texture_float_linear`)===!1&&(a.magFilter===1006||a.magFilter===1007||a.magFilter===1005||a.magFilter===1008||a.minFilter===1006||a.minFilter===1007||a.minFilter===1005||a.minFilter===1008)&&V(`WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device.`),e.texParameteri(n,e.TEXTURE_WRAP_S,le[a.wrapS]),e.texParameteri(n,e.TEXTURE_WRAP_T,le[a.wrapT]),(n===e.TEXTURE_3D||n===e.TEXTURE_2D_ARRAY)&&e.texParameteri(n,e.TEXTURE_WRAP_R,le[a.wrapR]),e.texParameteri(n,e.TEXTURE_MAG_FILTER,ue[a.magFilter]),e.texParameteri(n,e.TEXTURE_MIN_FILTER,ue[a.minFilter]),a.compareFunction&&(e.texParameteri(n,e.TEXTURE_COMPARE_MODE,e.COMPARE_REF_TO_TEXTURE),e.texParameteri(n,e.TEXTURE_COMPARE_FUNC,I[a.compareFunction])),t.has(`EXT_texture_filter_anisotropic`)===!0){if(a.magFilter===1003||a.minFilter!==1005&&a.minFilter!==1008||a.type===1015&&t.has(`OES_texture_float_linear`)===!1)return;if(a.anisotropy>1||r.get(a).__currentAnisotropy){let o=t.get(`EXT_texture_filter_anisotropic`);e.texParameterf(n,o.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(a.anisotropy,i.getMaxAnisotropy())),r.get(a).__currentAnisotropy=a.anisotropy}}}function fe(t,n){let r=!1;t.__webglInit===void 0&&(t.__webglInit=!0,n.addEventListener(`dispose`,D),T(n));let i=n.source,a=p.get(i);a===void 0&&(a={},p.set(i,a));let s=ie(n);if(s!==t.__cacheKey){a[s]===void 0&&(a[s]={texture:e.createTexture(),usedTimes:0},o.memory.textures++,r=!0),a[s].usedTimes++;let i=a[t.__cacheKey];i!==void 0&&(a[t.__cacheKey].usedTimes--,i.usedTimes===0&&M(n)),t.__cacheKey=s,t.__webglTexture=a[s].texture}return r}function pe(e,t,n){return Math.floor(Math.floor(e/n)/t)}function me(t,r,i,a){let o=t.updateRanges;if(o.length===0)n.texSubImage2D(e.TEXTURE_2D,0,0,0,r.width,r.height,i,a,r.data);else{o.sort((e,t)=>e.start-t.start);let s=0;for(let e=1;e<o.length;e++){let t=o[s],n=o[e],i=t.start+t.count,a=pe(n.start,r.width,4),c=pe(t.start,r.width,4);n.start<=i+1&&a===c&&pe(n.start+n.count-1,r.width,4)===a?t.count=Math.max(t.count,n.start+n.count-t.start):(++s,o[s]=n)}o.length=s+1;let c=n.getParameter(e.UNPACK_ROW_LENGTH),l=n.getParameter(e.UNPACK_SKIP_PIXELS),u=n.getParameter(e.UNPACK_SKIP_ROWS);n.pixelStorei(e.UNPACK_ROW_LENGTH,r.width);for(let t=0,s=o.length;t<s;t++){let s=o[t],c=Math.floor(s.start/4),l=Math.ceil(s.count/4),u=c%r.width,d=Math.floor(c/r.width),f=l;n.pixelStorei(e.UNPACK_SKIP_PIXELS,u),n.pixelStorei(e.UNPACK_SKIP_ROWS,d),n.texSubImage2D(e.TEXTURE_2D,0,u,d,f,1,i,a,r.data)}t.clearUpdateRanges(),n.pixelStorei(e.UNPACK_ROW_LENGTH,c),n.pixelStorei(e.UNPACK_SKIP_PIXELS,l),n.pixelStorei(e.UNPACK_SKIP_ROWS,u)}}function he(t,o,s){let c=e.TEXTURE_2D;(o.isDataArrayTexture||o.isCompressedArrayTexture)&&(c=e.TEXTURE_2D_ARRAY),o.isData3DTexture&&(c=e.TEXTURE_3D);let l=fe(t,o),u=o.source;n.bindTexture(c,t.__webglTexture,e.TEXTURE0+s);let f=r.get(u);if(u.version!==f.__version||l===!0){if(n.activeTexture(e.TEXTURE0+s),!(typeof ImageBitmap<`u`&&o.image instanceof ImageBitmap)){let t=Ki.getPrimaries(Ki.workingColorSpace),r=o.colorSpace===``?null:Ki.getPrimaries(o.colorSpace),i=o.colorSpace===``||t===r?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,o.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,o.premultiplyAlpha),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,i)}n.pixelStorei(e.UNPACK_ALIGNMENT,o.unpackAlignment);let t=v(o.image,!1,i.maxTextureSize);t=B(o,t);let r=a.convert(o.format,o.colorSpace),p=a.convert(o.type),m=S(o.internalFormat,r,p,o.normalized,o.colorSpace,o.isVideoTexture);de(c,o);let h,g=o.mipmaps,_=o.isVideoTexture!==!0,x=f.__version===void 0||l===!0,T=u.dataReady,E=w(o,t);if(o.isDepthTexture)m=C(o.format===mr,o.type),x&&(_?n.texStorage2D(e.TEXTURE_2D,1,m,t.width,t.height):n.texImage2D(e.TEXTURE_2D,0,m,t.width,t.height,0,r,p,null));else if(o.isDataTexture){if(g.length>0){_&&x&&n.texStorage2D(e.TEXTURE_2D,E,m,g[0].width,g[0].height);for(let t=0,i=g.length;t<i;t++)h=g[t],_?T&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,h.width,h.height,r,p,h.data):n.texImage2D(e.TEXTURE_2D,t,m,h.width,h.height,0,r,p,h.data);o.generateMipmaps=!1}else _?(x&&n.texStorage2D(e.TEXTURE_2D,E,m,t.width,t.height),T&&me(o,t,r,p)):n.texImage2D(e.TEXTURE_2D,0,m,t.width,t.height,0,r,p,t.data)}else if(o.isCompressedTexture){if(o.isCompressedArrayTexture){_&&x&&n.texStorage3D(e.TEXTURE_2D_ARRAY,E,m,g[0].width,g[0].height,t.depth);for(let i=0,a=g.length;i<a;i++)if(h=g[i],o.format!==1023){if(r!==null){if(_){if(T){if(o.layerUpdates.size>0){let t=Pu(h.width,h.height,o.format,o.type);for(let a of o.layerUpdates){let o=h.data.subarray(a*t/h.data.BYTES_PER_ELEMENT,(a+1)*t/h.data.BYTES_PER_ELEMENT);n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,a,h.width,h.height,1,r,o)}}else n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,0,h.width,h.height,t.depth,r,h.data)}}else n.compressedTexImage3D(e.TEXTURE_2D_ARRAY,i,m,h.width,h.height,t.depth,0,h.data,0,0)}else V(`WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()`)}else _?T&&n.texSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,0,h.width,h.height,t.depth,r,p,h.data):n.texImage3D(e.TEXTURE_2D_ARRAY,i,m,h.width,h.height,t.depth,0,r,p,h.data);o.layerUpdates.size>0&&o.clearLayerUpdates()}else{_&&x&&n.texStorage2D(e.TEXTURE_2D,E,m,g[0].width,g[0].height);for(let t=0,i=g.length;t<i;t++)h=g[t],o.format===1023?_?T&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,h.width,h.height,r,p,h.data):n.texImage2D(e.TEXTURE_2D,t,m,h.width,h.height,0,r,p,h.data):r===null?V(`WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()`):_?T&&n.compressedTexSubImage2D(e.TEXTURE_2D,t,0,0,h.width,h.height,r,h.data):n.compressedTexImage2D(e.TEXTURE_2D,t,m,h.width,h.height,0,h.data)}}else if(o.isDataArrayTexture){if(_){if(x&&n.texStorage3D(e.TEXTURE_2D_ARRAY,E,m,t.width,t.height,t.depth),T){if(o.layerUpdates.size>0){let i=Pu(t.width,t.height,o.format,o.type);for(let a of o.layerUpdates){let o=t.data.subarray(a*i/t.data.BYTES_PER_ELEMENT,(a+1)*i/t.data.BYTES_PER_ELEMENT);n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,a,t.width,t.height,1,r,p,o)}o.clearLayerUpdates()}else n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,0,t.width,t.height,t.depth,r,p,t.data)}}else n.texImage3D(e.TEXTURE_2D_ARRAY,0,m,t.width,t.height,t.depth,0,r,p,t.data)}else if(o.isData3DTexture)_?(x&&n.texStorage3D(e.TEXTURE_3D,E,m,t.width,t.height,t.depth),T&&n.texSubImage3D(e.TEXTURE_3D,0,0,0,0,t.width,t.height,t.depth,r,p,t.data)):n.texImage3D(e.TEXTURE_3D,0,m,t.width,t.height,t.depth,0,r,p,t.data);else if(o.isFramebufferTexture){if(x){if(_)n.texStorage2D(e.TEXTURE_2D,E,m,t.width,t.height);else{let i=t.width,a=t.height;for(let t=0;t<E;t++)n.texImage2D(e.TEXTURE_2D,t,m,i,a,0,r,p,null),i>>=1,a>>=1}}}else if(o.isHTMLTexture){if(`texElementImage2D`in e){let n=e.canvas;if(n.hasAttribute(`layoutsubtree`)||n.setAttribute(`layoutsubtree`,`true`),t.parentNode!==n){n.appendChild(t),d.add(o),n.onpaint=e=>{let t=e.changedElements;for(let e of d)t.includes(e.image)&&(e.needsUpdate=!0)},n.requestPaint();return}if(e.texElementImage2D.length===3)e.texElementImage2D(e.TEXTURE_2D,e.RGBA8,t);else{let n=e.RGBA,r=e.RGBA,i=e.UNSIGNED_BYTE;e.texElementImage2D(e.TEXTURE_2D,0,n,r,i,t)}e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}}else if(g.length>0){if(_&&x){let t=Ee(g[0]);n.texStorage2D(e.TEXTURE_2D,E,m,t.width,t.height)}for(let t=0,i=g.length;t<i;t++)h=g[t],_?T&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,r,p,h):n.texImage2D(e.TEXTURE_2D,t,m,r,p,h);o.generateMipmaps=!1}else if(_){if(x){let r=Ee(t);n.texStorage2D(e.TEXTURE_2D,E,m,r.width,r.height)}T&&n.texSubImage2D(e.TEXTURE_2D,0,0,0,r,p,t)}else n.texImage2D(e.TEXTURE_2D,0,m,r,p,t);y(o)&&o.mipmapsAutoUpdate===!0&&b(c),f.__version=u.version,o.onUpdate&&o.onUpdate(o)}t.__version=o.version}function ge(t,o,s){if(o.image.length!==6)return;let c=fe(t,o),l=o.source;n.bindTexture(e.TEXTURE_CUBE_MAP,t.__webglTexture,e.TEXTURE0+s);let u=r.get(l);if(l.version!==u.__version||c===!0){n.activeTexture(e.TEXTURE0+s);let t=Ki.getPrimaries(Ki.workingColorSpace),r=o.colorSpace===``?null:Ki.getPrimaries(o.colorSpace),d=o.colorSpace===``||t===r?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,o.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,o.premultiplyAlpha),n.pixelStorei(e.UNPACK_ALIGNMENT,o.unpackAlignment),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,d);let f=o.isCompressedTexture||o.image[0].isCompressedTexture,p=o.image[0]&&o.image[0].isDataTexture,m=[];for(let e=0;e<6;e++)!f&&!p?m[e]=v(o.image[e],!0,i.maxCubemapSize):m[e]=p?o.image[e].image:o.image[e],m[e]=B(o,m[e]);let h=m[0],g=a.convert(o.format,o.colorSpace),_=a.convert(o.type),x=S(o.internalFormat,g,_,o.normalized,o.colorSpace),T=o.isVideoTexture!==!0,E=u.__version===void 0||c===!0,D=l.dataReady,O=w(o,h);de(e.TEXTURE_CUBE_MAP,o);let k;if(o.isDepthTexture){if(x=C(o.format===mr,o.type),E){if(T)n.texStorage2D(e.TEXTURE_CUBE_MAP,1,x,h.width,h.height);else for(let t=0;t<6;t++)n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,x,h.width,h.height,0,g,_,null)}}else if(f){T&&E&&n.texStorage2D(e.TEXTURE_CUBE_MAP,O,x,h.width,h.height);for(let t=0;t<6;t++){k=m[t].mipmaps;for(let r=0;r<k.length;r++){let i=k[r];o.format===1023?T?D&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,0,0,i.width,i.height,g,_,i.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,x,i.width,i.height,0,g,_,i.data):g===null?V(`WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()`):T?D&&n.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,0,0,i.width,i.height,g,i.data):n.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,x,i.width,i.height,0,i.data)}}}else{if(k=o.mipmaps,T&&E){k.length>0&&O++;let t=Ee(m[0]);n.texStorage2D(e.TEXTURE_CUBE_MAP,O,x,t.width,t.height)}for(let t=0;t<6;t++)if(p){T?D&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,0,0,m[t].width,m[t].height,g,_,m[t].data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,x,m[t].width,m[t].height,0,g,_,m[t].data);for(let r=0;r<k.length;r++){let i=k[r].image[t].image;T?D&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,0,0,i.width,i.height,g,_,i.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,x,i.width,i.height,0,g,_,i.data)}}else{T?D&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,0,0,g,_,m[t]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,x,g,_,m[t]);for(let r=0;r<k.length;r++){let i=k[r];T?D&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,0,0,g,_,i.image[t]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,x,g,_,i.image[t])}}}y(o)&&o.mipmapsAutoUpdate===!0&&b(e.TEXTURE_CUBE_MAP),u.__version=l.version,o.onUpdate&&o.onUpdate(o)}t.__version=o.version}function _e(t,i,o,c,l,u){let d=a.convert(o.format,o.colorSpace),f=a.convert(o.type),p=S(o.internalFormat,d,f,o.normalized,o.colorSpace),m=r.get(i),h=r.get(o);if(h.__renderTarget=i,!m.__hasExternalTextures){let t=Math.max(1,i.width>>u),r=Math.max(1,i.height>>u);l===e.TEXTURE_3D||l===e.TEXTURE_2D_ARRAY?n.texImage3D(l,u,p,t,r,i.depth,0,d,f,null):n.texImage2D(l,u,p,t,r,0,d,f,null)}n.bindFramebuffer(e.FRAMEBUFFER,t),Te(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,c,l,h.__webglTexture,0,R(i)):(l===e.TEXTURE_2D||l>=e.TEXTURE_CUBE_MAP_POSITIVE_X&&l<=e.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&e.framebufferTexture2D(e.FRAMEBUFFER,c,l,h.__webglTexture,u),n.bindFramebuffer(e.FRAMEBUFFER,null)}function ve(t,n,r){if(e.bindRenderbuffer(e.RENDERBUFFER,t),n.depthBuffer){let i=n.depthTexture,a=i&&i.isDepthTexture?i.type:null,o=C(n.stencilBuffer,a),c=n.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;Te(n)?s.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,R(n),o,n.width,n.height):r?e.renderbufferStorageMultisample(e.RENDERBUFFER,R(n),o,n.width,n.height):e.renderbufferStorage(e.RENDERBUFFER,o,n.width,n.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,c,e.RENDERBUFFER,t)}else{let t=n.textures;for(let i=0;i<t.length;i++){let o=t[i],c=a.convert(o.format,o.colorSpace),l=a.convert(o.type),u=S(o.internalFormat,c,l,o.normalized,o.colorSpace);Te(n)?s.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,R(n),u,n.width,n.height):r?e.renderbufferStorageMultisample(e.RENDERBUFFER,R(n),u,n.width,n.height):e.renderbufferStorage(e.RENDERBUFFER,u,n.width,n.height)}}e.bindRenderbuffer(e.RENDERBUFFER,null)}function ye(t,i,a){let o=i.isWebGLCubeRenderTarget===!0;if(n.bindFramebuffer(e.FRAMEBUFFER,t),!(i.depthTexture&&i.depthTexture.isDepthTexture))throw Error(`THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.`);let c=r.get(i.depthTexture);c.__renderTarget=i;let l=o?i.depthTexture.image[0]:i.depthTexture.image;c.__webglTexture&&l.width===i.width&&l.height===i.height||(l.width=i.width,l.height=i.height,i.depthTexture.needsUpdate=!0),o?ce(i.depthTexture,0):ae(i.depthTexture,0);let u=c.__webglTexture,d=R(i),f=o?e.TEXTURE_CUBE_MAP_POSITIVE_X+a:e.TEXTURE_2D,p=i.depthTexture.format===1027?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(i.depthTexture.format===1026)Te(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,p,f,u,0,d):e.framebufferTexture2D(e.FRAMEBUFFER,p,f,u,0);else if(i.depthTexture.format===1027)Te(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,p,f,u,0,d):e.framebufferTexture2D(e.FRAMEBUFFER,p,f,u,0);else throw Error(`THREE.WebGLTextures: Unknown depthTexture format.`)}function be(t){let i=r.get(t),a=t.isWebGLCubeRenderTarget===!0;if(i.__boundDepthTexture!==t.depthTexture){let e=t.depthTexture;if(i.__depthDisposeCallback&&i.__depthDisposeCallback(),e){let t=()=>{delete i.__boundDepthTexture,delete i.__depthDisposeCallback,e.removeEventListener(`dispose`,t)};e.addEventListener(`dispose`,t),i.__depthDisposeCallback=t}i.__boundDepthTexture=e}if(t.depthTexture&&!i.__autoAllocateDepthBuffer){if(a)for(let e=0;e<6;e++)ye(i.__webglFramebuffer[e],t,e);else t.texture.mipmaps.length>0?ye(i.__webglFramebuffer[0],t,0):ye(i.__webglFramebuffer,t,0)}else if(a){i.__webglDepthbuffer=[];for(let r=0;r<6;r++)if(n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer[r]),i.__webglDepthbuffer[r]===void 0)i.__webglDepthbuffer[r]=e.createRenderbuffer(),ve(i.__webglDepthbuffer[r],t,!1);else{let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,a=i.__webglDepthbuffer[r];e.bindRenderbuffer(e.RENDERBUFFER,a),e.framebufferRenderbuffer(e.FRAMEBUFFER,n,e.RENDERBUFFER,a)}}else if(t.texture.mipmaps.length>0?n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer[0]):n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer),i.__webglDepthbuffer===void 0)i.__webglDepthbuffer=e.createRenderbuffer(),ve(i.__webglDepthbuffer,t,!1);else{let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,r=i.__webglDepthbuffer;e.bindRenderbuffer(e.RENDERBUFFER,r),e.framebufferRenderbuffer(e.FRAMEBUFFER,n,e.RENDERBUFFER,r)}n.bindFramebuffer(e.FRAMEBUFFER,null)}function xe(t,n,i){let a=r.get(t);n!==void 0&&_e(a.__webglFramebuffer,t,t.texture,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,0),i!==void 0&&be(t)}function L(t){let i=t.texture,s=r.get(t),c=r.get(i);t.addEventListener(`dispose`,O),T(t);let l=t.textures,u=t.isWebGLCubeRenderTarget===!0,d=l.length>1;if(d||(c.__webglTexture===void 0&&(c.__webglTexture=e.createTexture()),c.__version=i.version,o.memory.textures++),u){s.__webglFramebuffer=[];for(let t=0;t<6;t++)if(i.mipmaps.length>0){s.__webglFramebuffer[t]=[];for(let n=0;n<i.mipmaps.length;n++)s.__webglFramebuffer[t][n]=e.createFramebuffer()}else s.__webglFramebuffer[t]=e.createFramebuffer()}else{if(i.mipmaps.length>0){s.__webglFramebuffer=[];for(let t=0;t<i.mipmaps.length;t++)s.__webglFramebuffer[t]=e.createFramebuffer()}else s.__webglFramebuffer=e.createFramebuffer();if(d)for(let t=0,n=l.length;t<n;t++){let n=r.get(l[t]);n.__webglTexture===void 0&&(n.__webglTexture=e.createTexture(),o.memory.textures++)}if(t.samples>0&&Te(t)===!1){s.__webglMultisampledFramebuffer=e.createFramebuffer(),s.__webglColorRenderbuffer=[],n.bindFramebuffer(e.FRAMEBUFFER,s.__webglMultisampledFramebuffer);for(let n=0;n<l.length;n++){let r=l[n];s.__webglColorRenderbuffer[n]=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,s.__webglColorRenderbuffer[n]);let i=a.convert(r.format,r.colorSpace),o=a.convert(r.type),c=S(r.internalFormat,i,o,r.normalized,r.colorSpace,t.isXRRenderTarget===!0),u=R(t);e.renderbufferStorageMultisample(e.RENDERBUFFER,u,c,t.width,t.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+n,e.RENDERBUFFER,s.__webglColorRenderbuffer[n])}e.bindRenderbuffer(e.RENDERBUFFER,null),t.depthBuffer&&(s.__webglDepthRenderbuffer=e.createRenderbuffer(),ve(s.__webglDepthRenderbuffer,t,!0)),n.bindFramebuffer(e.FRAMEBUFFER,null)}}if(u){n.bindTexture(e.TEXTURE_CUBE_MAP,c.__webglTexture),de(e.TEXTURE_CUBE_MAP,i);for(let n=0;n<6;n++)if(i.mipmaps.length>0)for(let r=0;r<i.mipmaps.length;r++)_e(s.__webglFramebuffer[n][r],t,i,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+n,r);else _e(s.__webglFramebuffer[n],t,i,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+n,0);y(i)?b(e.TEXTURE_CUBE_MAP):i.mipmaps.length>0&&e.texParameteri(e.TEXTURE_CUBE_MAP,e.TEXTURE_MAX_LEVEL,i.mipmaps.length-1),n.unbindTexture()}else if(d){for(let i=0,a=l.length;i<a;i++){let a=l[i],o=r.get(a),c=e.TEXTURE_2D;(t.isWebGL3DRenderTarget||t.isWebGLArrayRenderTarget)&&(c=t.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(c,o.__webglTexture),de(c,a),_e(s.__webglFramebuffer,t,a,e.COLOR_ATTACHMENT0+i,c,0),y(a)&&b(c)}n.unbindTexture()}else{let r=e.TEXTURE_2D;if((t.isWebGL3DRenderTarget||t.isWebGLArrayRenderTarget)&&(r=t.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(r,c.__webglTexture),de(r,i),i.mipmaps.length>0)for(let n=0;n<i.mipmaps.length;n++)_e(s.__webglFramebuffer[n],t,i,e.COLOR_ATTACHMENT0,r,n);else _e(s.__webglFramebuffer,t,i,e.COLOR_ATTACHMENT0,r,0);y(i)?b(r):i.mipmaps.length>0&&e.texParameteri(r,e.TEXTURE_MAX_LEVEL,i.mipmaps.length-1),n.unbindTexture()}t.depthBuffer&&be(t)}function Se(e){let t=e.textures;for(let i=0,a=t.length;i<a;i++){let a=t[i];if(y(a)&&a.mipmapsAutoUpdate===!0){let t=x(e),i=r.get(a).__webglTexture;n.bindTexture(t,i),b(t),n.unbindTexture()}}}let Ce=[];function we(t){if(t.samples>0){if(Te(t)===!1){let i=t.textures,a=t.width,o=t.height,s=e.COLOR_BUFFER_BIT,l=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,u=r.get(t),d=i.length>1;if(d)for(let t=0;t<i.length;t++)n.bindFramebuffer(e.FRAMEBUFFER,u.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.RENDERBUFFER,null),n.bindFramebuffer(e.FRAMEBUFFER,u.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.TEXTURE_2D,null,0);n.bindFramebuffer(e.READ_FRAMEBUFFER,u.__webglMultisampledFramebuffer),t.texture.mipmaps.length>0?n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglFramebuffer[0]):n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglFramebuffer);for(let n=0;n<i.length;n++){if(t.resolveDepthBuffer&&(t.depthBuffer&&(s|=e.DEPTH_BUFFER_BIT),t.stencilBuffer&&t.resolveStencilBuffer&&(s|=e.STENCIL_BUFFER_BIT)),d){e.framebufferRenderbuffer(e.READ_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,u.__webglColorRenderbuffer[n]);let t=r.get(i[n]).__webglTexture;e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t,0)}e.blitFramebuffer(0,0,a,o,0,0,a,o,s,e.NEAREST),c===!0&&(Ce.length=0,Ce.push(e.COLOR_ATTACHMENT0+n),t.depthBuffer&&t.storeMultisampledDepthBuffer===!1&&Ce.push(l),e.invalidateFramebuffer(e.READ_FRAMEBUFFER,Ce))}if(n.bindFramebuffer(e.READ_FRAMEBUFFER,null),n.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),d)for(let t=0;t<i.length;t++){n.bindFramebuffer(e.FRAMEBUFFER,u.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.RENDERBUFFER,u.__webglColorRenderbuffer[t]);let a=r.get(i[t]).__webglTexture;n.bindFramebuffer(e.FRAMEBUFFER,u.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.TEXTURE_2D,a,0)}n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglMultisampledFramebuffer)}else if(t.depthBuffer&&t.storeMultisampledDepthBuffer===!1&&c){let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,[n])}}}function R(e){return Math.min(i.maxSamples,e.samples)}function Te(e){let n=r.get(e);return e.samples>0&&t.has(`WEBGL_multisampled_render_to_texture`)===!0&&n.__useRenderToTexture!==!1}function z(e){let t=o.render.frame;u.get(e)!==t&&(u.set(e,t),e.update())}function B(e,t){let n=e.colorSpace,r=e.format,i=e.type;return e.isCompressedTexture===!0||e.isVideoTexture===!0||n!==`srgb-linear`&&n!==``&&(Ki.getTransfer(n)===`srgb`?(r!==1023||i!==1009)&&V(`WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.`):H(`WebGLTextures: Unsupported texture color space:`,n)),t}function Ee(e){return typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement?(l.width=e.naturalWidth||e.width,l.height=e.naturalHeight||e.height):typeof VideoFrame<`u`&&e instanceof VideoFrame?(l.width=e.displayWidth,l.height=e.displayHeight):(l.width=e.width,l.height=e.height),l}this.allocateTextureUnit=re,this.resetTextureUnits=F,this.getTextureUnits=te,this.setTextureUnits=ne,this.setTexture2D=ae,this.setTexture2DArray=oe,this.setTexture3D=se,this.setTextureCube=ce,this.rebindTextures=xe,this.setupRenderTarget=L,this.updateRenderTargetMipmap=Se,this.updateMultisampleRenderTarget=we,this.setupDepthRenderbuffer=be,this.setupFrameBufferTexture=_e,this.useMultisampledRTT=Te,this.dispose=j}function Pp(e,t){function n(n,r=``){let i,a=Ki.getTransfer(r);if(n===1009)return e.UNSIGNED_BYTE;if(n===1017)return e.UNSIGNED_SHORT_4_4_4_4;if(n===1018)return e.UNSIGNED_SHORT_5_5_5_1;if(n===35902)return e.UNSIGNED_INT_5_9_9_9_REV;if(n===35899)return e.UNSIGNED_INT_10F_11F_11F_REV;if(n===1010)return e.BYTE;if(n===1011)return e.SHORT;if(n===1012)return e.UNSIGNED_SHORT;if(n===1013)return e.INT;if(n===1014)return e.UNSIGNED_INT;if(n===1015)return e.FLOAT;if(n===1016)return e.HALF_FLOAT;if(n===1021)return e.ALPHA;if(n===1022)return e.RGB;if(n===1023)return e.RGBA;if(n===1026)return e.DEPTH_COMPONENT;if(n===1027)return e.DEPTH_STENCIL;if(n===1028)return e.RED;if(n===1029)return e.RED_INTEGER;if(n===1030)return e.RG;if(n===1031)return e.RG_INTEGER;if(n===1033)return e.RGBA_INTEGER;if(n===33776||n===33777||n===33778||n===33779){if(a===`srgb`){if(i=t.get(`WEBGL_compressed_texture_s3tc_srgb`),i!==null){if(n===33776)return i.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===33777)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===33778)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===33779)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null}else if(i=t.get(`WEBGL_compressed_texture_s3tc`),i!==null){if(n===33776)return i.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===33777)return i.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===33778)return i.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===33779)return i.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null}if(n===35840||n===35841||n===35842||n===35843){if(i=t.get(`WEBGL_compressed_texture_pvrtc`),i!==null){if(n===35840)return i.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===35841)return i.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===35842)return i.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===35843)return i.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null}if(n===36196||n===37492||n===37496||n===37488||n===37489||n===37490||n===37491){if(i=t.get(`WEBGL_compressed_texture_etc`),i!==null){if(n===36196||n===37492)return a===`srgb`?i.COMPRESSED_SRGB8_ETC2:i.COMPRESSED_RGB8_ETC2;if(n===37496)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:i.COMPRESSED_RGBA8_ETC2_EAC;if(n===37488)return i.COMPRESSED_R11_EAC;if(n===37489)return i.COMPRESSED_SIGNED_R11_EAC;if(n===37490)return i.COMPRESSED_RG11_EAC;if(n===37491)return i.COMPRESSED_SIGNED_RG11_EAC}else return null}if(n===37808||n===37809||n===37810||n===37811||n===37812||n===37813||n===37814||n===37815||n===37816||n===37817||n===37818||n===37819||n===37820||n===37821){if(i=t.get(`WEBGL_compressed_texture_astc`),i!==null){if(n===37808)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:i.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===37809)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:i.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===37810)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:i.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===37811)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:i.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===37812)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:i.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===37813)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:i.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===37814)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:i.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===37815)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:i.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===37816)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:i.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===37817)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:i.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===37818)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:i.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===37819)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:i.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===37820)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:i.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===37821)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:i.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null}if(n===36492||n===36494||n===36495){if(i=t.get(`EXT_texture_compression_bptc`),i!==null){if(n===36492)return a===`srgb`?i.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:i.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===36494)return i.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===36495)return i.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null}if(n===36283||n===36284||n===36285||n===36286){if(i=t.get(`EXT_texture_compression_rgtc`),i!==null){if(n===36283)return i.COMPRESSED_RED_RGTC1_EXT;if(n===36284)return i.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===36285)return i.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===36286)return i.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null}return n===1020?e.UNSIGNED_INT_24_8:e[n]===void 0?null:e[n]}return{convert:n}}var Fp=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Ip=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,Lp=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new vc(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,n=new Al({vertexShader:Fp,fragmentShader:Ip,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new Os(new yl(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Rp=class extends Oi{constructor(e,t){super();let n=this,r=null,i=1,a=null,o=`local-floor`,s=1,c=null,l=null,u=null,d=null,f=null,p=null,m=typeof XRWebGLBinding<`u`,h=new Lp,g={},_=t.getContextAttributes(),v=null,y=null,b=[],x=[],S=new W,C=null,w=null,T=new mu;T.viewport=new ra;let E=new mu;E.viewport=new ra;let D=[T,E],O=new xu,k=null,A=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(e){let t=b[e];return t===void 0&&(t=new La,b[e]=t),t.getTargetRaySpace()},this.getControllerGrip=function(e){let t=b[e];return t===void 0&&(t=new La,b[e]=t),t.getGripSpace()},this.getHand=function(e){let t=b[e];return t===void 0&&(t=new La,b[e]=t),t.getHandSpace()};function j(e){let t=x.indexOf(e.inputSource);if(t===-1)return;let n=b[t];n!==void 0&&(n.update(e.inputSource,e.frame,c||a),n.dispatchEvent({type:e.type,data:e.inputSource}))}function ee(){r.removeEventListener(`select`,j),r.removeEventListener(`selectstart`,j),r.removeEventListener(`selectend`,j),r.removeEventListener(`squeeze`,j),r.removeEventListener(`squeezestart`,j),r.removeEventListener(`squeezeend`,j),r.removeEventListener(`end`,ee),r.removeEventListener(`inputsourceschange`,M);for(let e=0;e<b.length;e++){let t=x[e];t!==null&&(x[e]=null,b[e].disconnect(t))}k=null,A=null,h.reset();for(let e in g)delete g[e];if(e.setRenderTarget(v),f=null,d=null,u=null,r=null,y=null,ne.stop(),n.isPresenting=!1,e.setPixelRatio(C),e.setSize(S.width,S.height,!1),w!==null){let e=w.camera;e.fov=w.fov,e.zoom=w.zoom,e.updateProjectionMatrix(),w=null}n.dispatchEvent({type:`sessionend`})}this.setFramebufferScaleFactor=function(e){i=e,n.isPresenting===!0&&V(`WebXRManager: Cannot change framebuffer scale while presenting.`)},this.setReferenceSpaceType=function(e){o=e,n.isPresenting===!0&&V(`WebXRManager: Cannot change reference space type while presenting.`)},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(e){c=e},this.getBaseLayer=function(){return d===null?f:d},this.getBinding=function(){return u===null&&m&&(u=new XRWebGLBinding(r,t)),u},this.getFrame=function(){return p},this.getSession=function(){return r},this.setSession=async function(l){if(r=l,r!==null){if(v=e.getRenderTarget(),r.addEventListener(`select`,j),r.addEventListener(`selectstart`,j),r.addEventListener(`selectend`,j),r.addEventListener(`squeeze`,j),r.addEventListener(`squeezestart`,j),r.addEventListener(`squeezeend`,j),r.addEventListener(`end`,ee),r.addEventListener(`inputsourceschange`,M),_.xrCompatible!==!0&&await t.makeXRCompatible(),C=e.getPixelRatio(),e.getSize(S),m&&`createProjectionLayer`in XRWebGLBinding.prototype){let n=null,a=null,o=null;_.depth&&(o=_.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,n=_.stencil?mr:pr,a=_.stencil?sr:nr);let s={colorFormat:t.RGBA8,depthFormat:o,scaleFactor:i};u=this.getBinding(),d=u.createProjectionLayer(s),r.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),y=new aa(d.textureWidth,d.textureHeight,{format:fr,type:Zn,depthTexture:new gc(d.textureWidth,d.textureHeight,a,void 0,void 0,void 0,void 0,void 0,void 0,n),stencilBuffer:_.stencil,colorSpace:e.outputColorSpace,samples:_.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1,storeMultisampledDepthBuffer:d.ignoreDepthValues===!1,storeMultisampledStencilBuffer:d.ignoreDepthValues===!1})}else{let n={antialias:_.antialias,alpha:!0,depth:_.depth,stencil:_.stencil,framebufferScaleFactor:i};f=new XRWebGLLayer(r,t,n),r.updateRenderState({baseLayer:f}),e.setPixelRatio(1),e.setSize(f.framebufferWidth,f.framebufferHeight,!1),y=new aa(f.framebufferWidth,f.framebufferHeight,{format:fr,type:Zn,colorSpace:e.outputColorSpace,stencilBuffer:_.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1,storeMultisampledDepthBuffer:f.ignoreDepthValues===!1,storeMultisampledStencilBuffer:f.ignoreDepthValues===!1})}y.isXRRenderTarget=!0,this.setFoveation(s),c=null,a=await r.requestReferenceSpace(o),ne.setContext(r),ne.start(),n.isPresenting=!0,n.dispatchEvent({type:`sessionstart`})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return h.getDepthTexture()};function M(e){for(let t=0;t<e.removed.length;t++){let n=e.removed[t],r=x.indexOf(n);r>=0&&(x[r]=null,b[r].disconnect(n))}for(let t=0;t<e.added.length;t++){let n=e.added[t],r=x.indexOf(n);if(r===-1){for(let e=0;e<b.length;e++)if(e>=x.length){x.push(n),r=e;break}else if(x[e]===null){x[e]=n,r=e;break}if(r===-1)break}let i=b[r];i&&i.connect(n)}}function N(e,t){t===null?e.matrixWorld.copy(e.matrix):e.matrixWorld.multiplyMatrices(t.matrixWorld,e.matrix),e.matrixWorldInverse.copy(e.matrixWorld).invert()}this.updateCamera=function(e){if(r===null)return;let t=e.near,n=e.far;h.texture!==null&&(h.depthNear>0&&(t=h.depthNear),h.depthFar>0&&(n=h.depthFar)),O.near=E.near=T.near=t,O.far=E.far=T.far=n,(k!==O.near||A!==O.far)&&(r.updateRenderState({depthNear:O.near,depthFar:O.far}),k=O.near,A=O.far),O.layers.mask=e.layers.mask|6,T.layers.mask=O.layers.mask&-5,E.layers.mask=O.layers.mask&-3;let i=e.parent,a=O.cameras;N(O,i);for(let e=0;e<a.length;e++)N(a[e],i);O.projectionMatrix.copy(T.projectionMatrix),O.projectionMatrixInverse.copy(T.projectionMatrixInverse),w===null&&e.isPerspectiveCamera&&(w={camera:e,fov:e.fov,zoom:e.zoom}),P(e,O,i)};function P(e,t,n){n===null?e.matrix.copy(t.matrixWorld):(e.matrix.copy(n.matrixWorld),e.matrix.invert(),e.matrix.multiply(t.matrixWorld)),e.matrix.decompose(e.position,e.quaternion,e.scale),e.updateMatrixWorld(!0),e.projectionMatrix.copy(t.projectionMatrix),e.projectionMatrixInverse.copy(t.projectionMatrixInverse),e.isPerspectiveCamera&&(e.fov=ji*2*Math.atan(1/e.projectionMatrix.elements[5]),e.zoom=1)}this.getCamera=function(){return O},this.getFoveation=function(){if(d!==null||f!==null)return s},this.setFoveation=function(e){s=e,d!==null&&(d.fixedFoveation=e),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=e)},this.hasDepthSensing=function(){return h.texture!==null},this.getDepthSensingMesh=function(){return h.getMesh(O)},this.getCameraTexture=function(e){return g[e]};let F=null;function te(t,i){if(l=i.getViewerPose(c||a),p=i,l!==null){let t=l.views;f!==null&&(e.setRenderTargetFramebuffer(y,f.framebuffer),e.setRenderTarget(y));let i=!1;t.length!==O.cameras.length&&(O.cameras.length=0,i=!0);for(let n=0;n<t.length;n++){let r=t[n],a=null;if(f!==null)a=f.getViewport(r);else{let t=u.getViewSubImage(d,r);a=t.viewport,n===0&&(e.setRenderTargetTextures(y,t.colorTexture,t.depthStencilTexture),e.setRenderTarget(y))}let o=D[n];o===void 0&&(o=new mu,o.layers.enable(n),o.viewport=new ra,D[n]=o),o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.quaternion,o.scale),o.projectionMatrix.fromArray(r.projectionMatrix),o.projectionMatrixInverse.copy(o.projectionMatrix).invert(),o.viewport.set(a.x,a.y,a.width,a.height),n===0&&(O.matrix.copy(o.matrix),O.matrix.decompose(O.position,O.quaternion,O.scale)),i===!0&&O.cameras.push(o)}let a=r.enabledFeatures;if(a&&a.includes(`depth-sensing`)&&r.depthUsage==`gpu-optimized`&&m){u=n.getBinding();let e=u.getDepthInformation(t[0]);e&&e.isValid&&e.texture&&h.init(e,r.renderState)}if(a&&a.includes(`camera-access`)&&m){e.state.unbindTexture(),u=n.getBinding();for(let e=0;e<t.length;e++){let n=t[e].camera;if(n){let e=g[n];e||(e=new vc,g[n]=e);let t=u.getCameraImage(n);e.sourceTexture=t}}}}for(let e=0;e<b.length;e++){let t=x[e],n=b[e];t!==null&&n!==void 0&&n.update(t,i,c||a)}F&&F(t,i),i.detectedPlanes&&n.dispatchEvent({type:`planesdetected`,data:i}),p=null}let ne=new Iu;ne.setAnimationLoop(te),this.setAnimationLoop=function(e){F=e},this.dispose=function(){}}},zp=new q,Bp=new K;Bp.set(-1,0,0,0,1,0,0,0,1);function Vp(e,t){function n(e,t){e.matrixAutoUpdate===!0&&e.updateMatrix(),t.value.copy(e.matrix)}function r(t,n){n.color.getRGB(t.fogColor.value,El(e)),n.isFog?(t.fogNear.value=n.near,t.fogFar.value=n.far):n.isFogExp2&&(t.fogDensity.value=n.density)}function i(e,t,n,r,i){t.isNodeMaterial?t.uniformsNeedUpdate=!1:t.isMeshBasicMaterial?a(e,t):t.isMeshLambertMaterial?(a(e,t),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)):t.isMeshToonMaterial?(a(e,t),d(e,t)):t.isMeshPhongMaterial?(a(e,t),u(e,t),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)):t.isMeshStandardMaterial?(a(e,t),f(e,t),t.isMeshPhysicalMaterial&&p(e,t,i)):t.isMeshMatcapMaterial?(a(e,t),m(e,t)):t.isMeshDepthMaterial?a(e,t):t.isMeshDistanceMaterial?(a(e,t),h(e,t)):t.isMeshNormalMaterial?a(e,t):t.isLineBasicMaterial?(o(e,t),t.isLineDashedMaterial&&s(e,t)):t.isPointsMaterial?c(e,t,n,r):t.isSpriteMaterial?l(e,t):t.isShadowMaterial?(e.color.value.copy(t.color),e.opacity.value=t.opacity):t.isShaderMaterial&&(t.uniformsNeedUpdate=!1)}function a(e,r){e.opacity.value=r.opacity,r.color&&e.diffuse.value.copy(r.color),r.emissive&&e.emissive.value.copy(r.emissive).multiplyScalar(r.emissiveIntensity),r.map&&(e.map.value=r.map,n(r.map,e.mapTransform)),r.alphaMap&&(e.alphaMap.value=r.alphaMap,n(r.alphaMap,e.alphaMapTransform)),r.bumpMap&&(e.bumpMap.value=r.bumpMap,n(r.bumpMap,e.bumpMapTransform),e.bumpScale.value=r.bumpScale,r.side===1&&(e.bumpScale.value*=-1)),r.normalMap&&(e.normalMap.value=r.normalMap,n(r.normalMap,e.normalMapTransform),e.normalScale.value.copy(r.normalScale),r.side===1&&e.normalScale.value.negate()),r.displacementMap&&(e.displacementMap.value=r.displacementMap,n(r.displacementMap,e.displacementMapTransform),e.displacementScale.value=r.displacementScale,e.displacementBias.value=r.displacementBias),r.emissiveMap&&(e.emissiveMap.value=r.emissiveMap,n(r.emissiveMap,e.emissiveMapTransform)),r.specularMap&&(e.specularMap.value=r.specularMap,n(r.specularMap,e.specularMapTransform)),r.alphaTest>0&&(e.alphaTest.value=r.alphaTest);let i=t.get(r),a=i.envMap,o=i.envMapRotation;a&&(e.envMap.value=a,e.envMapRotation.value.setFromMatrix4(zp.makeRotationFromEuler(o)).transpose(),a.isCubeTexture&&a.isRenderTargetTexture===!1&&e.envMapRotation.value.premultiply(Bp),e.reflectivity.value=r.reflectivity,e.ior.value=r.ior,e.refractionRatio.value=r.refractionRatio),r.lightMap&&(e.lightMap.value=r.lightMap,e.lightMapIntensity.value=r.lightMapIntensity,n(r.lightMap,e.lightMapTransform)),r.aoMap&&(e.aoMap.value=r.aoMap,e.aoMapIntensity.value=r.aoMapIntensity,n(r.aoMap,e.aoMapTransform))}function o(e,t){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,t.map&&(e.map.value=t.map,n(t.map,e.mapTransform))}function s(e,t){e.dashSize.value=t.dashSize,e.totalSize.value=t.dashSize+t.gapSize,e.scale.value=t.scale}function c(e,t,r,i){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,e.size.value=t.size*r,e.scale.value=i*.5,t.map&&(e.map.value=t.map,n(t.map,e.uvTransform)),t.alphaMap&&(e.alphaMap.value=t.alphaMap,n(t.alphaMap,e.alphaMapTransform)),t.alphaTest>0&&(e.alphaTest.value=t.alphaTest)}function l(e,t){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,e.rotation.value=t.rotation,t.map&&(e.map.value=t.map,n(t.map,e.mapTransform)),t.alphaMap&&(e.alphaMap.value=t.alphaMap,n(t.alphaMap,e.alphaMapTransform)),t.alphaTest>0&&(e.alphaTest.value=t.alphaTest)}function u(e,t){e.specular.value.copy(t.specular),e.shininess.value=Math.max(t.shininess,1e-4)}function d(e,t){t.gradientMap&&(e.gradientMap.value=t.gradientMap)}function f(e,t){e.metalness.value=t.metalness,t.metalnessMap&&(e.metalnessMap.value=t.metalnessMap,n(t.metalnessMap,e.metalnessMapTransform)),e.roughness.value=t.roughness,t.roughnessMap&&(e.roughnessMap.value=t.roughnessMap,n(t.roughnessMap,e.roughnessMapTransform)),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)}function p(e,t,r){e.ior.value=t.ior,t.diffuseRoughness>0&&(e.diffuseRoughness.value=t.diffuseRoughness,t.diffuseRoughnessMap&&(e.diffuseRoughnessMap.value=t.diffuseRoughnessMap,n(t.diffuseRoughnessMap,e.diffuseRoughnessMapTransform))),t.sheen>0&&(e.sheenColor.value.copy(t.sheenColor).multiplyScalar(t.sheen),e.sheenRoughness.value=t.sheenRoughness,t.sheenColorMap&&(e.sheenColorMap.value=t.sheenColorMap,n(t.sheenColorMap,e.sheenColorMapTransform)),t.sheenRoughnessMap&&(e.sheenRoughnessMap.value=t.sheenRoughnessMap,n(t.sheenRoughnessMap,e.sheenRoughnessMapTransform))),t.clearcoat>0&&(e.clearcoat.value=t.clearcoat,e.clearcoatRoughness.value=t.clearcoatRoughness,t.clearcoatMap&&(e.clearcoatMap.value=t.clearcoatMap,n(t.clearcoatMap,e.clearcoatMapTransform)),t.clearcoatRoughnessMap&&(e.clearcoatRoughnessMap.value=t.clearcoatRoughnessMap,n(t.clearcoatRoughnessMap,e.clearcoatRoughnessMapTransform)),t.clearcoatNormalMap&&(e.clearcoatNormalMap.value=t.clearcoatNormalMap,n(t.clearcoatNormalMap,e.clearcoatNormalMapTransform),e.clearcoatNormalScale.value.copy(t.clearcoatNormalScale),t.side===1&&e.clearcoatNormalScale.value.negate())),t.dispersion>0&&(e.dispersion.value=t.dispersion),t.retroreflectivity>0&&(e.retroreflectivity.value=t.retroreflectivity),t.iridescence>0&&(e.iridescence.value=t.iridescence,e.iridescenceIOR.value=t.iridescenceIOR,e.iridescenceThicknessMinimum.value=t.iridescenceThicknessMinimum,e.iridescenceThicknessMaximum.value=t.iridescenceThicknessMaximum,t.iridescenceMap&&(e.iridescenceMap.value=t.iridescenceMap,n(t.iridescenceMap,e.iridescenceMapTransform)),t.iridescenceThicknessMap&&(e.iridescenceThicknessMap.value=t.iridescenceThicknessMap,n(t.iridescenceThicknessMap,e.iridescenceThicknessMapTransform))),t.transmission>0&&(e.transmission.value=t.transmission,e.transmissionSamplerMap.value=r.texture,e.transmissionSamplerSize.value.set(r.width,r.height),t.transmissionMap&&(e.transmissionMap.value=t.transmissionMap,n(t.transmissionMap,e.transmissionMapTransform)),e.thickness.value=t.thickness,t.thicknessMap&&(e.thicknessMap.value=t.thicknessMap,n(t.thicknessMap,e.thicknessMapTransform)),e.attenuationDistance.value=t.attenuationDistance,e.attenuationColor.value.copy(t.attenuationColor)),t.anisotropy>0&&(e.anisotropyVector.value.set(t.anisotropy*Math.cos(t.anisotropyRotation),t.anisotropy*Math.sin(t.anisotropyRotation)),t.anisotropyMap&&(e.anisotropyMap.value=t.anisotropyMap,n(t.anisotropyMap,e.anisotropyMapTransform))),e.specularIntensity.value=t.specularIntensity,e.specularColor.value.copy(t.specularColor),t.specularColorMap&&(e.specularColorMap.value=t.specularColorMap,n(t.specularColorMap,e.specularColorMapTransform)),t.specularIntensityMap&&(e.specularIntensityMap.value=t.specularIntensityMap,n(t.specularIntensityMap,e.specularIntensityMapTransform))}function m(e,t){t.matcap&&(e.matcap.value=t.matcap)}function h(e,n){let r=t.get(n).light;e.referencePosition.value.setFromMatrixPosition(r.matrixWorld),e.nearDistance.value=r.shadow.camera.near,e.farDistance.value=r.shadow.camera.far}return{refreshFogUniforms:r,refreshMaterialUniforms:i}}function Hp(e,t,n,r){let i={},a={};function o(e,t){let n=t.program;r.uniformBlockBinding(e,n,i[e.id])}function s(e,n){let o=i[e.id];o===void 0&&(m(e),o=c(e),i[e.id]=o,e.addEventListener(`dispose`,g));let s=n.program;r.updateUBOMapping(e,s);let u=t.render.frame;a[e.id]!==u&&(l(e),a[e.id]=u)}function c(t){let n=e.createBuffer(),r=t.__size,i=t.usage;return e.bindBuffer(e.UNIFORM_BUFFER,n),e.bufferData(e.UNIFORM_BUFFER,r,i),e.bindBuffer(e.UNIFORM_BUFFER,null),n}function l(t){let n=i[t.id],r=t.uniforms,a=t.__cache;e.bindBuffer(e.UNIFORM_BUFFER,n);for(let e=0,t=r.length;e<t;e++){let t=r[e];if(Array.isArray(t))for(let n=0,r=t.length;n<r;n++)u(t[n],e,n,a);else u(t,e,0,a)}e.bindBuffer(e.UNIFORM_BUFFER,null)}function u(t,n,r,i){if(f(t,n,r,i)===!0){let n=t.__offset,r=t.value;if(Array.isArray(r)){let e=0;for(let n=0;n<r.length;n++){let i=r[n],a=h(i,!0);d(i,t.__data,e),e+=a.storage/Float32Array.BYTES_PER_ELEMENT}}else d(r,t.__data,0);e.bufferSubData(e.UNIFORM_BUFFER,n,t.__data)}}function d(e,t,n){typeof e==`number`||typeof e==`boolean`?t[n]=e:e.isMatrix3?(t[n]=e.elements[0],t[n+1]=e.elements[1],t[n+2]=e.elements[2],t[n+3]=0,t[n+4]=e.elements[3],t[n+5]=e.elements[4],t[n+6]=e.elements[5],t[n+7]=0,t[n+8]=e.elements[6],t[n+9]=e.elements[7],t[n+10]=e.elements[8],t[n+11]=0):ArrayBuffer.isView(e)?t.set(e.subarray(0,t.length-n),n):e.toArray(t,n)}function f(e,t,n,r){let i=e.value,a=t+`_`+n;if(Array.isArray(i)){r[a]===void 0&&(r[a]=[]);let e=r[a],t=!1;for(let n=0;n<i.length;n++)p(i[n],e,n)===!0&&(t=!0);return t}return p(i,r,a)}function p(e,t,n){if(t[n]===void 0)return t[n]=typeof e==`number`||typeof e==`boolean`?e:ArrayBuffer.isView(e)?e.slice():e.clone(),!0;{let r=t[n];if(typeof e==`number`||typeof e==`boolean`){if(r!==e)return t[n]=e,!0}else if(ArrayBuffer.isView(e))return!0;else if(r.equals(e)===!1)return r.copy(e),!0}return!1}function m(e){let t=e.uniforms,n=0;for(let e=0,r=t.length;e<r;e++){let r=Array.isArray(t[e])?t[e]:[t[e]];for(let i=0,a=r.length;i<a;i++){let a=r[i],o=Array.isArray(a.value)?a.value:[a.value],s=Array.isArray(t[e])||Array.isArray(a.value),c=n;for(let e=0,t=o.length;e<t;e++){let t=o[e],r=h(t,s),i=n%16,a=i%r.boundary,l=i+a;n+=a,l!==0&&16-l<r.storage&&(n+=16-l),e===0&&(c=n),n+=r.storage}a.__data=new(a.type===`int`?Int32Array:a.type===`uint`?Uint32Array:Float32Array)((n-c)/Float32Array.BYTES_PER_ELEMENT),a.__offset=c}}let r=n%16;return r>0&&(n+=16-r),e.__size=n,e.__cache={},this}function h(e,t){let n={boundary:0,storage:0};return typeof e==`number`||typeof e==`boolean`?(n.boundary=4,n.storage=4):e.isVector2?(n.boundary=8,n.storage=8):e.isVector3||e.isColor?(n.boundary=16,n.storage=12):e.isVector4?(n.boundary=16,n.storage=16):e.isMatrix3?(n.boundary=16,n.storage=48):e.isMatrix4?(n.boundary=16,n.storage=64):e.isTexture?V(`WebGLRenderer: Texture samplers can not be part of an uniforms group.`):ArrayBuffer.isView(e)?(n.boundary=16,n.storage=e.byteLength):V(`WebGLRenderer: Unsupported uniform value type.`,e),t===!0&&(n.boundary=16,n.storage=Math.ceil(n.storage/16)*16),n}function g(t){let n=t.target;n.removeEventListener(`dispose`,g),e.deleteBuffer(i[n.id]),delete i[n.id],delete a[n.id]}function _(){for(let t in i)e.deleteBuffer(i[t]);i={},a={}}return{bind:o,update:s,dispose:_}}var Up=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Wp=null;function Gp(){return Wp===null&&(Wp=new Hs(Up,16,16,_r,ir),Wp.name=`DFG_LUT`,Wp.minFilter=Jn,Wp.magFilter=Jn,Wp.wrapS=Un,Wp.wrapT=Un,Wp.generateMipmaps=!1,Wp.needsUpdate=!0),Wp}var Kp=class{constructor(e={}){let{canvas:t=xi(),context:n=null,depth:r=!0,stencil:i=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:s=!0,preserveDrawingBuffer:c=!1,powerPreference:l=`default`,failIfMajorPerformanceCaveat:u=!1,reversedDepthBuffer:d=!1,outputBufferType:f=Zn}=e;this.isWebGLRenderer=!0;let p;if(n!==null){if(typeof WebGLRenderingContext<`u`&&n instanceof WebGLRenderingContext)throw Error(`THREE.WebGLRenderer: WebGL 1 is not supported since r163.`);p=n.getContextAttributes().alpha}else p=a;let m=f,h=new Set([yr,vr,gr]),g=new Set([Zn,nr,er,sr,ar,or]),_=new Uint32Array(4),v=new Int32Array(4),y={textures:[],min:[],max:[],resolution:[]},b=null,x=null,S=[],C=[],w=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=0,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let T=this,E=!1,D=null,O=null,k=null,A=null;this._outputColorSpace=ui;let j=0,ee=0,M=null,N=-1,P=null,F=new ra,te=new ra,ne=null,re=new J(0),ie=0,ae=t.width,oe=t.height,se=1,ce=null,le=null,ue=new ra(0,0,ae,oe),I=new ra(0,0,ae,oe),de=!1,fe=new ic,pe=new oc,me=!1,he=!1,ge=new q,_e=new G,ve=new ra,ye={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},be=!1;function xe(){return M===null?se:1}let L=n;function Se(e,n){return t.getContext(e,n)}let Ce,we,R,Te,z,B,Ee,De,Oe,ke,Ae,je,Me,Ne,Pe,Fe,Ie,Le,Re,ze,Be,Ve,He;try{let e={alpha:!0,depth:r,stencil:i,antialias:o,premultipliedAlpha:s,preserveDrawingBuffer:c,powerPreference:l,failIfMajorPerformanceCaveat:u};if(`setAttribute`in t&&t.setAttribute(`data-engine`,`three.js r187`),t.addEventListener(`webglcontextlost`,Ge,!1),t.addEventListener(`webglcontextrestored`,Ke,!1),t.addEventListener(`webglcontextcreationerror`,qe,!1),L===null){let t=`webgl2`;if(L=Se(t,e),L===null)throw Se(t)?Error(`THREE.WebGLRenderer: Error creating WebGL context with your selected attributes.`):Error(`THREE.WebGLRenderer: Error creating WebGL context.`)}Ue()}catch(e){throw t.removeEventListener(`webglcontextlost`,Ge,!1),t.removeEventListener(`webglcontextrestored`,Ke,!1),t.removeEventListener(`webglcontextcreationerror`,qe,!1),H(`WebGLRenderer: `+e.message),e}function Ue(){Ce=new dd(L),Ce.init(),Be=new Pp(L,Ce),we=new Gu(L,Ce,e,Be),R=new Mp(L,Ce),we.reversedDepthBuffer&&d&&R.buffers.depth.setReversed(!0),O=L.createFramebuffer(),k=L.createFramebuffer(),A=L.createFramebuffer(),Te=new md(L),z=new fp,B=new Np(L,Ce,R,z,we,Be,Te),Ee=new ud(T),De=new Lu(L),Ve=new Uu(L,De),Oe=new fd(L,De,Te,Ve),ke=new gd(L,Oe,De,Ve,Te),Le=new hd(L,we,B),Pe=new Ku(z),Ae=new dp(T,Ee,Ce,we,Ve,Pe),je=new Vp(T,z),Me=new gp,Ne=new Cp(Ce),Ie=new Hu(T,Ee,R,ke,p,s),Fe=new jp(T,ke,we),He=new Hp(L,Te,we,R),Re=new Wu(L,Ce,Te),ze=new pd(L,Ce,Te),Te.programs=Ae.programs,T.capabilities=we,T.extensions=Ce,T.properties=z,T.renderLists=Me,T.shadowMap=Fe,T.state=R,T.info=Te}m!==1009&&(w=new vd(m,t.width,t.height,o,r,i));let We=new Rp(T,L);this.xr=We,this.getContext=function(){return L},this.getContextAttributes=function(){return L.getContextAttributes()},this.forceContextLoss=function(){let e=Ce.get(`WEBGL_lose_context`);e&&e.loseContext()},this.forceContextRestore=function(){let e=Ce.get(`WEBGL_lose_context`);e&&e.restoreContext()},this.getPixelRatio=function(){return se},this.setPixelRatio=function(e){e!==void 0&&(se=e,this.setSize(ae,oe,!1))},this.getSize=function(e){return e.set(ae,oe)},this.setSize=function(e,n,r=!0){We.isPresenting?V(`WebGLRenderer: Can't change size while VR device is presenting.`):(ae=e,oe=n,t.width=Math.floor(e*se),t.height=Math.floor(n*se),r===!0&&(t.style.width=e+`px`,t.style.height=n+`px`),w!==null&&w.setSize(t.width,t.height),this.setViewport(0,0,e,n))},this.getDrawingBufferSize=function(e){return e.set(ae*se,oe*se).floor()},this.setDrawingBufferSize=function(e,n,r){ae=e,oe=n,se=r,t.width=Math.floor(e*r),t.height=Math.floor(n*r),this.setViewport(0,0,e,n)},this.setEffects=function(e){if(m===1009)H(`WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.`);else{if(e){for(let t=0;t<e.length;t++)if(e[t].isOutputPass===!0){V(`WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.`);break}}w.setEffects(e||[])}},this.getCurrentViewport=function(e){return e.copy(F)},this.getViewport=function(e){return e.copy(ue)},this.setViewport=function(e,t,n,r){e.isVector4?ue.set(e.x,e.y,e.z,e.w):ue.set(e,t,n,r),R.viewport(F.copy(ue).multiplyScalar(xe()).round())},this.getScissor=function(e){return e.copy(I)},this.setScissor=function(e,t,n,r){e.isVector4?I.set(e.x,e.y,e.z,e.w):I.set(e,t,n,r),R.scissor(te.copy(I).multiplyScalar(xe()).round())},this.getScissorTest=function(){return de},this.setScissorTest=function(e){R.setScissorTest(de=e)},this.setOpaqueSort=function(e){ce=e},this.setTransparentSort=function(e){le=e},this.getClearColor=function(e){return e.copy(Ie.getClearColor())},this.setClearColor=function(){Ie.setClearColor(...arguments)},this.getClearAlpha=function(){return Ie.getClearAlpha()},this.setClearAlpha=function(){Ie.setClearAlpha(...arguments)},this.clear=function(e=!0,t=!0,n=!0){let r=0;if(e){let e=!1;if(M!==null){let t=M.texture.format;e=h.has(t)}if(e){let e=M.texture.type,t=g.has(e),n=Ie.getClearColor(),r=Ie.getClearAlpha(),i=n.r,a=n.g,o=n.b;t?(_[0]=i,_[1]=a,_[2]=o,_[3]=r,L.clearBufferuiv(L.COLOR,0,_)):(v[0]=i,v[1]=a,v[2]=o,v[3]=r,L.clearBufferiv(L.COLOR,0,v))}else r|=L.COLOR_BUFFER_BIT}t&&(r|=L.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),n&&(r|=L.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),r!==0&&L.clear(r)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(e){e.setRenderer(this),D=e},this.dispose=function(){t.removeEventListener(`webglcontextlost`,Ge,!1),t.removeEventListener(`webglcontextrestored`,Ke,!1),t.removeEventListener(`webglcontextcreationerror`,qe,!1),Ie.dispose(),Me.dispose(),Ne.dispose(),B.dispose(),z.dispose(),Ee.dispose(),ke.dispose(),Oe.dispose(),Ve.dispose(),He.dispose(),Ae.dispose(),We.dispose(),We.removeEventListener(`sessionstart`,et),We.removeEventListener(`sessionend`,tt),nt.stop()};function Ge(e){e.preventDefault(),Ci(`WebGLRenderer: Context Lost.`),E=!0}function Ke(){Ci(`WebGLRenderer: Context Restored.`),E=!1;let e=Te.autoReset,t=Fe.enabled,n=Fe.autoUpdate,r=Fe.needsUpdate,i=Fe.type;Ue(),Te.autoReset=e,Fe.enabled=t,Fe.autoUpdate=n,Fe.needsUpdate=r,Fe.type=i}function qe(e){H(`WebGLRenderer: A WebGL context could not be created. Reason: `,e.statusMessage)}function Je(e){let t=e.target;t.removeEventListener(`dispose`,Je),Ye(t)}function Ye(e){Xe(e),z.remove(e)}function Xe(e){let t=z.get(e).programs;t!==void 0&&(t.forEach(function(e){Ae.releaseProgram(e)}),e.isShaderMaterial&&Ae.releaseShaderCache(e))}this.renderBufferDirect=function(e,t,n,r,i,a){t===null&&(t=ye);let o=i.isMesh&&i.matrixWorld.determinantAffine()<0,s=pt(e,t,n,r,i);R.setMaterial(r,o);let c=n.index,l=1;if(r.wireframe===!0){if(c=Oe.getWireframeAttribute(n),c===void 0)return;l=2}let u=n.drawRange,d=n.attributes.position,f=u.start*l,p=(u.start+u.count)*l;a!==null&&(f=Math.max(f,a.start*l),p=Math.min(p,(a.start+a.count)*l)),c===null?d!=null&&(f=Math.max(f,0),p=Math.min(p,d.count)):(f=Math.max(f,0),p=Math.min(p,c.count));let m=p-f;if(m<0||m===1/0)return;Ve.setup(i,r,s,n,c);let h,g=Re;if(c!==null&&(h=De.get(c),g=ze,g.setIndex(h)),i.isMesh)r.wireframe===!0?(R.setLineWidth(r.wireframeLinewidth*xe()),g.setMode(L.LINES)):g.setMode(L.TRIANGLES);else if(i.isLine){let e=r.linewidth;e===void 0&&(e=1),R.setLineWidth(e*xe()),i.isLineSegments?g.setMode(L.LINES):i.isLineLoop?g.setMode(L.LINE_LOOP):g.setMode(L.LINE_STRIP)}else i.isPoints?g.setMode(L.POINTS):i.isSprite&&g.setMode(L.TRIANGLES);if(i.isBatchedMesh){if(Ce.get(`WEBGL_multi_draw`))g.renderMultiDraw(i._multiDrawStarts,i._multiDrawCounts,i._multiDrawCount);else{let e=i._multiDrawStarts,t=i._multiDrawCounts,n=i._multiDrawCount,a=c?De.get(c).bytesPerElement:1,o=z.get(r).currentProgram.getUniforms();for(let r=0;r<n;r++)o.setValue(L,`_gl_DrawID`,r),g.render(e[r]/a,t[r])}}else if(i.isInstancedMesh)g.renderInstances(f,m,i.count);else if(n.isInstancedBufferGeometry){let e=n._maxInstanceCount===void 0?1/0:n._maxInstanceCount,t=Math.min(n.instanceCount,e);g.renderInstances(f,m,t)}else g.render(f,m)};function Ze(e,t,n,r){D!==null&&e.isNodeMaterial&&D.setObject(r,e),me===!0&&Pe.setState(e,n,!1),e.transparent===!0&&e.side===2&&e.forceSinglePass===!1?(e.side=1,e.needsUpdate=!0,lt(e,t,r),e.side=0,e.needsUpdate=!0,lt(e,t,r),e.side=2):lt(e,t,r)}this.compile=function(e,t,n=null){n===null&&(n=e),D!==null&&D.renderStart(e,t,n),x=Ne.get(n),x.init(t),C.push(x),n.traverseVisible(function(e){e.isLight&&e.layers.test(t.layers)&&(x.pushLight(e),e.castShadow&&x.pushShadow(e))}),e!==n&&e.traverseVisible(function(e){e.isLight&&e.layers.test(t.layers)&&(x.pushLight(e),e.castShadow&&x.pushShadow(e))}),x.setupLights(),D!==null&&D.updateLights(x.state.lightsArray),he=this.localClippingEnabled,me=Pe.init(this.clippingPlanes,he),me===!0&&Pe.setGlobalState(this.clippingPlanes,t),D!==null&&Fe.render(x.state.shadowsArray,n,t);let r=new Set;return e.traverse(function(e){if(!(e.isMesh||e.isPoints||e.isLine||e.isSprite))return;let i=e.material;if(i){if(Array.isArray(i))for(let a=0;a<i.length;a++){let o=i[a];Ze(o,n,t,e),r.add(o)}else Ze(i,n,t,e),r.add(i)}}),x=C.pop(),D!==null&&D.renderEnd(),r},this.compileAsync=function(e,t,n=null){let r=this.compile(e,t,n);return new Promise(t=>{function n(){r.forEach(function(e){let t=z.get(e).currentProgram;(t===void 0||t.isReady())&&r.delete(e)}),r.size===0?t(e):setTimeout(n,10)}Ce.get(`KHR_parallel_shader_compile`)===null?setTimeout(n,10):n()})};let Qe=null;function $e(e){Qe&&Qe(e)}function et(){nt.stop()}function tt(){nt.start()}let nt=new Iu;nt.setAnimationLoop($e),typeof self<`u`&&nt.setContext(self),this.setAnimationLoop=function(e){Qe=e,We.setAnimationLoop(e),e===null?nt.stop():nt.start()},We.addEventListener(`sessionstart`,et),We.addEventListener(`sessionend`,tt),this.render=function(e,t){if(t!==void 0&&t.isCamera!==!0){H(`WebGLRenderer.render: camera is not an instance of THREE.Camera.`);return}if(E===!0)return;D!==null&&D.renderStart(e,t);let n=We.enabled===!0&&We.isPresenting===!0,r=w!==null&&(M===null||n)&&w.begin(T,M);if(e.matrixWorldAutoUpdate===!0&&e.updateMatrixWorld(),t.parent===null&&t.matrixWorldAutoUpdate===!0&&t.updateMatrixWorld(),We.enabled===!0&&We.isPresenting===!0&&(w===null||w.isCompositing()===!1)&&(We.cameraAutoUpdate===!0&&We.updateCamera(t),t=We.getCamera()),e.isScene===!0&&e.onBeforeRender(T,e,t,M),x=Ne.get(e,C.length),x.init(t),x.state.textureUnits=B.getTextureUnits(),C.push(x),ge.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),t.isArrayCamera?pe.setFromArrayCamera(t):fe.setFromProjectionMatrix(ge,_i,t.reversedDepth),he=this.localClippingEnabled,me=Pe.init(this.clippingPlanes,he),b=Me.get(e,S.length),b.init(),S.push(b),this.info.render.frame++,We.enabled===!0&&We.isPresenting===!0){let e=T.xr.getDepthSensingMesh();e!==null&&rt(e,t,-1/0,T.sortObjects)}rt(e,t,0,T.sortObjects),b.finish(),D!==null&&D.updateLights(x.state.lightsArray),T.sortObjects===!0&&b.sort(ce,le),be=We.enabled===!1||We.isPresenting===!1||We.hasDepthSensing()===!1,be&&Ie.addToRenderList(b,e),this.info.autoReset===!0&&this.info.reset(),me===!0&&Pe.beginShadows();let i=x.state.shadowsArray;if(Fe.render(i,e,t),me===!0&&Pe.endShadows(),(r&&w.hasRenderPass())===!1){let n=b.opaque,r=b.transmissive;if(x.setupLights(),t.isArrayCamera){let i=t.cameras;if(r.length>0)for(let t=0,a=i.length;t<a;t++){let a=i[t];at(n,r,e,a)}be&&Ie.render(e);for(let t=0,n=i.length;t<n;t++){let n=i[t];it(b,e,n,n.viewport)}}else r.length>0&&at(n,r,e,t),be&&Ie.render(e),it(b,e,t)}M!==null&&ee===0&&(B.updateMultisampleRenderTarget(M),B.updateRenderTargetMipmap(M)),r&&w.end(T),e.isScene===!0&&e.onAfterRender(T,e,t),Ve.resetDefaultState(),N=-1,P=null,C.pop(),C.length>0?(x=C[C.length-1],B.setTextureUnits(x.state.textureUnits),me===!0&&Pe.setGlobalState(T.clippingPlanes,x.state.camera)):x=null,S.pop(),b=S.length>0?S[S.length-1]:null,D!==null&&D.renderEnd()};function rt(e,t,n,r){if(e.visible===!1)return;if(e.layers.test(t.layers)){if(e.isGroup)n=e.renderOrder;else if(e.isLOD)e.autoUpdate===!0&&e.update(t);else if(e.isLight)x.pushLight(e),e.castShadow&&x.pushShadow(e);else if(e.isSprite){let i=t.isArrayCamera?pe:fe;if(!e.frustumCulled||e.intersectsFrustum(i)){r&&ve.setFromMatrixPosition(e.matrixWorld).applyMatrix4(ge);let i=ke.update(e),a=e.material;a.visible&&b.push(e,i,a,n,ve.z,null,t)}}else if(e.isMesh||e.isLine||e.isPoints){let i=t.isArrayCamera?pe:fe;if(!e.frustumCulled||e.intersectsFrustum(i)){let i=ke.update(e),a=e.material;if(r&&(e.boundingSphere===void 0?(i.boundingSphere===null&&i.computeBoundingSphere(),ve.copy(i.boundingSphere.center)):(e.boundingSphere===null&&e.computeBoundingSphere(),ve.copy(e.boundingSphere.center)),ve.applyMatrix4(e.matrixWorld).applyMatrix4(ge)),Array.isArray(a)){let r=i.groups;for(let o=0,s=r.length;o<s;o++){let s=r[o],c=a[s.materialIndex];c&&c.visible&&b.push(e,i,c,n,ve.z,s,t)}}else a.visible&&b.push(e,i,a,n,ve.z,null,t)}}}let i=e.children;for(let e=0,a=i.length;e<a;e++)rt(i[e],t,n,r)}function it(e,t,n,r){let{opaque:i,transmissive:a,transparent:o}=e;x.setupLightsView(n),me===!0&&Pe.setGlobalState(T.clippingPlanes,n),r&&R.viewport(F.copy(r)),i.length>0&&ot(i,t,n),a.length>0&&ot(a,t,n),o.length>0&&ot(o,t,n),R.buffers.depth.setTest(!0),R.buffers.depth.setMask(!0),R.buffers.color.setMask(!0),R.setPolygonOffset(!1)}function at(e,t,n,r){if((n.isScene===!0?n.overrideMaterial:null)!==null)return;if(x.state.transmissionRenderTarget[r.id]===void 0){let e=Ce.has(`EXT_color_buffer_half_float`)||Ce.has(`EXT_color_buffer_float`);x.state.transmissionRenderTarget[r.id]=new aa(1,1,{generateMipmaps:!0,type:e?ir:Zn,minFilter:Xn,samples:Math.max(4,we.samples),stencilBuffer:i,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:Ki.workingColorSpace})}let a=x.state.transmissionRenderTarget[r.id],o=r.viewport||F;a.setSize(o.z*T.transmissionResolutionScale,o.w*T.transmissionResolutionScale);let s=T.getRenderTarget(),c=T.getActiveCubeFace(),l=T.getActiveMipmapLevel();T.setRenderTarget(a),T.getClearColor(re),ie=T.getClearAlpha(),ie<1&&T.setClearColor(16777215,.5),T.clear(),be&&Ie.render(n);let u=T.toneMapping;T.toneMapping=0;let d=r.viewport;if(r.viewport!==void 0&&(r.viewport=void 0),x.setupLightsView(r),me===!0&&Pe.setGlobalState(T.clippingPlanes,r),ot(e,n,r),B.updateMultisampleRenderTarget(a),B.updateRenderTargetMipmap(a),Ce.has(`WEBGL_multisampled_render_to_texture`)===!1){let e=!1;for(let i=0,a=t.length;i<a;i++){let{object:a,geometry:o,material:s,group:c}=t[i];if(s.side===2&&a.layers.test(r.layers)){let t=s.side;s.side=1,s.needsUpdate=!0,st(a,n,r,o,s,c),s.side=t,s.needsUpdate=!0,e=!0}}e===!0&&(B.updateMultisampleRenderTarget(a),B.updateRenderTargetMipmap(a))}T.setRenderTarget(s,c,l),T.setClearColor(re,ie),d!==void 0&&(r.viewport=d),T.toneMapping=u}function ot(e,t,n){let r=t.isScene===!0?t.overrideMaterial:null;for(let i=0,a=e.length;i<a;i++){let a=e[i],{object:o,geometry:s,group:c}=a,l=a.material;l.allowOverride===!0&&r!==null&&(l=r),o.layers.test(n.layers)&&st(o,t,n,s,l,c)}}function st(e,t,n,r,i,a){D!==null&&i.isNodeMaterial&&D.setObject(e,i),e.onBeforeRender(T,t,n,r,i,a),e.modelViewMatrix.multiplyMatrices(n.matrixWorldInverse,e.matrixWorld),e.normalMatrix.getNormalMatrix(e.modelViewMatrix),i.onBeforeRender(T,t,n,r,e,a),i.transparent===!0&&i.side===2&&i.forceSinglePass===!1?(i.side=1,i.needsUpdate=!0,T.renderBufferDirect(n,t,r,i,e,a),i.side=0,i.needsUpdate=!0,T.renderBufferDirect(n,t,r,i,e,a),i.side=2):T.renderBufferDirect(n,t,r,i,e,a),e.onAfterRender(T,t,n,r,i,a)}function ct(e){let t=0;for(let n of e)n.texture!==null&&t++;return t}function lt(e,t,n){t.isScene!==!0&&(t=ye);let r=z.get(e),i=x.state.lights,a=x.state.shadowsArray,o=i.state.version,s=Ae.getParameters(e,i.state,a,t,n,x.state.lightProbeGridArray),c=Ae.getProgramCacheKey(s),l=r.programs;r.environment=e.isMeshStandardMaterial||e.isMeshLambertMaterial||e.isMeshPhongMaterial?t.environment:null,r.fog=t.fog;let u=e.isMeshStandardMaterial||e.isMeshLambertMaterial&&!e.envMap||e.isMeshPhongMaterial&&!e.envMap;r.envMap=Ee.get(e.envMap||r.environment,u),r.envMapRotation=r.environment!==null&&e.envMap===null?t.environmentRotation:e.envMapRotation,l===void 0&&(e.addEventListener(`dispose`,Je),l=new Map,r.programs=l,r.programVariants=new Map);let d=l.get(c);if(d!==void 0){if(r.currentProgram===d&&r.lightsStateVersion===o)return ft(e,s),d}else s.uniforms=Ae.getUniforms(e),D!==null&&e.isNodeMaterial&&D.build(e,n,s),e.onBeforeCompile(s,T),d=Ae.acquireProgram(s,c),l.set(c,d),r.uniforms=s.uniforms;let f=r.uniforms;return(!e.isShaderMaterial&&!e.isRawShaderMaterial||e.clipping===!0)&&(f.clippingPlanes=Pe.uniform),ft(e,s),r.needsLights=ht(e),r.lightsStateVersion=o,r.needsLights&&(f.ambientLightColor.value=i.state.ambient,f.lightProbe.value=i.state.probe,f.sunLights.value=i.state.sun,f.sunLightShadows.value=i.state.sunShadow,f.directionalLights.value=i.state.directional,f.directionalLightShadows.value=i.state.directionalShadow,f.spotLights.value=i.state.spot,f.spotLightShadows.value=i.state.spotShadow,f.rectAreaLights.value=i.state.rectArea,f.ltc_1.value=i.state.rectAreaLTC1,f.ltc_2.value=i.state.rectAreaLTC2,f.pointLights.value=i.state.point,f.pointLightShadows.value=i.state.pointShadow,f.hemisphereLights.value=i.state.hemi,f.sunShadowMatrix.value=i.state.sunShadowMatrix,f.sunShadowCascade.value=i.state.sunShadowCascade,f.directionalShadowMatrix.value=i.state.directionalShadowMatrix,f.spotLightMatrix.value=i.state.spotLightMatrix,f.spotLightMap.value=i.state.spotLightMap,f.pointShadowMatrix.value=i.state.pointShadowMatrix),r.numLightProbeGrids=ct(x.state.lightProbeGridArray),r.currentProgram=d,r.uniformsList=null,d}function ut(e,t,n,r,i){let a=z.get(e),o=a.currentProgram.id+`,`+r+`,`+i,s=a.programVariants.get(o);return s===void 0?(s=lt(e,t,n),a.programVariants.set(o,s)):(a.currentProgram=s,a.uniformsList=null,a.outputColorSpace=r,a.toneMapping=i),s}function dt(e){if(e.uniformsList===null){let t=e.currentProgram.getUniforms();e.uniformsList=Of.seqWithValue(t.seq,e.uniforms)}return e.uniformsList}function ft(e,t){let n=z.get(e);n.outputColorSpace=t.outputColorSpace,n.batching=t.batching,n.batchingColor=t.batchingColor,n.instancing=t.instancing,n.instancingColor=t.instancingColor,n.instancingMorph=t.instancingMorph,n.skinning=t.skinning,n.morphTargets=t.morphTargets,n.morphNormals=t.morphNormals,n.morphColors=t.morphColors,n.morphTargetsCount=t.morphTargetsCount,n.numClippingPlanes=t.numClippingPlanes,n.numIntersection=t.numClipIntersection,n.vertexAlphas=t.vertexAlphas,n.vertexTangents=t.vertexTangents,n.toneMapping=t.toneMapping}function pt(e,t,n,r,i){t.isScene!==!0&&(t=ye),B.resetTextureUnits();let a=t.fog,o=r.isMeshStandardMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial?t.environment:null,s=M===null?T.outputColorSpace:M.isXRRenderTarget===!0?M.texture.colorSpace:Ki.workingColorSpace,c=r.isMeshStandardMaterial||r.isMeshLambertMaterial&&!r.envMap||r.isMeshPhongMaterial&&!r.envMap,l=Ee.get(r.envMap||o,c),u=r.vertexColors===!0&&!!n.attributes.color&&n.attributes.color.itemSize===4,d=!!n.attributes.tangent&&(!!r.normalMap||r.anisotropy>0),f=!!n.morphAttributes.position,p=!!n.morphAttributes.normal,m=!!n.morphAttributes.color,h=0;r.toneMapped&&(M===null||M.isXRRenderTarget===!0)&&(h=T.toneMapping);let g=n.morphAttributes.position||n.morphAttributes.normal||n.morphAttributes.color,_=g===void 0?0:g.length,v=z.get(r),b=x.state.lights;if(me===!0&&(he===!0||e!==P)){let t=e===P&&r.id===N;Pe.setState(r,e,t)}let S=!1,C=!1;r.version===v.__version?v.needsLights&&v.lightsStateVersion!==b.state.version||i.isBatchedMesh&&v.batching===!1||!i.isBatchedMesh&&v.batching===!0||i.isBatchedMesh&&v.batchingColor===!0&&i._colorsTexture===null||i.isBatchedMesh&&v.batchingColor===!1&&i._colorsTexture!==null||i.isInstancedMesh&&v.instancing===!1||!i.isInstancedMesh&&v.instancing===!0||i.isSkinnedMesh&&v.skinning===!1||!i.isSkinnedMesh&&v.skinning===!0||i.isInstancedMesh&&v.instancingColor===!0&&i.instanceColor===null||i.isInstancedMesh&&v.instancingColor===!1&&i.instanceColor!==null||i.isInstancedMesh&&v.instancingMorph===!0&&i.morphTexture===null||i.isInstancedMesh&&v.instancingMorph===!1&&i.morphTexture!==null?S=!0:v.envMap===l?r.fog===!0&&v.fog!==a||v.numClippingPlanes!==void 0&&(v.numClippingPlanes!==Pe.numPlanes||v.numIntersection!==Pe.numIntersection)?S=!0:v.vertexAlphas===u&&v.vertexTangents===d&&v.morphTargets===f&&v.morphNormals===p&&v.morphColors===m&&v.morphTargetsCount===_&&v.numLightProbeGrids===ct(x.state.lightProbeGridArray)?(v.outputColorSpace!==s||v.toneMapping!==h)&&(C=!0):S=!0:S=!0:(S=!0,v.__version=r.version);let w=v.currentProgram;(S===!0||C===!0)&&(w=C===!0?ut(r,t,i,s,h):lt(r,t,i),D&&r.isNodeMaterial&&D.onUpdateProgram(r,w,v));let E=!1,O=!1,k=!1,A=w.getUniforms(),j=v.uniforms;if(R.useProgram(w.program)&&(E=!0,O=!0,k=!0),r.id!==N&&(N=r.id,O=!0),E||P!==e){R.buffers.depth.getReversed()&&e.reversedDepth!==!0&&(e._reversedDepth=!0,e.updateProjectionMatrix()),A.setValue(L,`projectionMatrix`,e.projectionMatrix),A.setValue(L,`viewMatrix`,e.matrixWorldInverse);let t=A.map.cameraPosition;t!==void 0&&t.setValue(L,_e.setFromMatrixPosition(e.matrixWorld)),we.logarithmicDepthBuffer&&A.setValue(L,`logDepthBufFC`,2/(Math.log(e.far+1)/Math.LN2)),(r.isMeshPhongMaterial||r.isMeshToonMaterial||r.isMeshLambertMaterial||r.isMeshBasicMaterial||r.isMeshStandardMaterial||r.isShaderMaterial)&&A.setValue(L,`isOrthographic`,e.isOrthographicCamera===!0),P!==e&&(P=e,O=!0,k=!0)}if(v.needsLights&&(b.state.sunShadowMap.length>0&&A.setValue(L,`sunShadowMap`,b.state.sunShadowMap,B),b.state.directionalShadowMap.length>0&&A.setValue(L,`directionalShadowMap`,b.state.directionalShadowMap,B),b.state.spotShadowMap.length>0&&A.setValue(L,`spotShadowMap`,b.state.spotShadowMap,B),b.state.pointShadowMap.length>0&&A.setValue(L,`pointShadowMap`,b.state.pointShadowMap,B)),i.isSkinnedMesh){A.setOptional(L,i,`bindMatrix`),A.setOptional(L,i,`bindMatrixInverse`);let e=i.skeleton;e&&(e.boneTexture===null&&e.computeBoneTexture(),A.setValue(L,`boneTexture`,e.boneTexture,B))}i.isBatchedMesh&&(A.setOptional(L,i,`batchingTexture`),A.setValue(L,`batchingTexture`,i._matricesTexture,B),A.setOptional(L,i,`batchingIdTexture`),A.setValue(L,`batchingIdTexture`,i._indirectTexture,B),A.setOptional(L,i,`batchingColorTexture`),i._colorsTexture!==null&&A.setValue(L,`batchingColorTexture`,i._colorsTexture,B));let ee=n.morphAttributes;if((ee.position!==void 0||ee.normal!==void 0||ee.color!==void 0)&&Le.update(i,n,w),(O||v.receiveShadow!==i.receiveShadow)&&(v.receiveShadow=i.receiveShadow,A.setValue(L,`receiveShadow`,i.receiveShadow)),(r.isMeshStandardMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial)&&r.envMap===null&&t.environment!==null&&(j.envMapIntensity.value=t.environmentIntensity),j.dfgLUT!==void 0&&(j.dfgLUT.value=Gp()),O){if(A.setValue(L,`toneMappingExposure`,T.toneMappingExposure),v.needsLights&&mt(j,k),a&&r.fog===!0&&je.refreshFogUniforms(j,a),je.refreshMaterialUniforms(j,r,se,oe,x.state.transmissionRenderTarget[e.id]),v.needsLights&&v.numLightProbeGrids>0){let e=y,t=0;for(let n of x.state.lightProbeGridArray)n.texture!==null&&(e.textures[t]=n.texture,e.min[t]=n.boundingBox.min,e.max[t]=n.boundingBox.max,e.resolution[t]=n.resolution,t++);for(let n in e)e[n].length=t;j.probesSH.value=e.textures,j.probesMin.value=e.min,j.probesMax.value=e.max,j.probesResolution.value=e.resolution}Of.upload(L,dt(v),j,B)}if(r.isShaderMaterial&&r.uniformsNeedUpdate===!0&&(Of.upload(L,dt(v),j,B),r.uniformsNeedUpdate=!1),r.isSpriteMaterial&&A.setValue(L,`center`,i.center),A.setValue(L,`modelViewMatrix`,i.modelViewMatrix),A.setValue(L,`normalMatrix`,i.normalMatrix),A.setValue(L,`modelMatrix`,i.matrixWorld),r.uniformsGroups!==void 0){let e=r.uniformsGroups;for(let t=0,n=e.length;t<n;t++){let n=e[t];He.update(n,w),He.bind(n,w)}}return w}function mt(e,t){e.ambientLightColor.needsUpdate=t,e.lightProbe.needsUpdate=t,e.sunLights.needsUpdate=t,e.sunLightShadows.needsUpdate=t,e.directionalLights.needsUpdate=t,e.directionalLightShadows.needsUpdate=t,e.pointLights.needsUpdate=t,e.pointLightShadows.needsUpdate=t,e.spotLights.needsUpdate=t,e.spotLightShadows.needsUpdate=t,e.rectAreaLights.needsUpdate=t,e.hemisphereLights.needsUpdate=t}function ht(e){return e.isMeshLambertMaterial||e.isMeshToonMaterial||e.isMeshPhongMaterial||e.isMeshStandardMaterial||e.isShadowMaterial||e.isShaderMaterial&&e.lights===!0}this.getActiveCubeFace=function(){return j},this.getActiveMipmapLevel=function(){return ee},this.getRenderTarget=function(){return M},this.setRenderTargetTextures=function(e,t,n){let r=z.get(e);r.__autoAllocateDepthBuffer=e.resolveDepthBuffer===!1,r.__autoAllocateDepthBuffer===!1&&(r.__useRenderToTexture=!1),z.get(e.texture).__webglTexture=t,z.get(e.depthTexture).__webglTexture=r.__autoAllocateDepthBuffer?void 0:n,r.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(e,t){let n=z.get(e);n.__webglFramebuffer=t,n.__useDefaultFramebuffer=t===void 0},this.setRenderTarget=function(e,t=0,n=0){M=e,j=t,ee=n;let r=null,i=!1,a=!1;if(e){let o=z.get(e);if(o.__useDefaultFramebuffer!==void 0){R.bindFramebuffer(L.FRAMEBUFFER,o.__webglFramebuffer),F.copy(e.viewport),te.copy(e.scissor),ne=e.scissorTest,R.viewport(F),R.scissor(te),R.setScissorTest(ne),N=-1;return}if(o.__webglFramebuffer===void 0)B.setupRenderTarget(e);else if(o.__hasExternalTextures)B.rebindTextures(e,z.get(e.texture).__webglTexture,z.get(e.depthTexture).__webglTexture);else if(e.depthBuffer){let t=e.depthTexture;if(o.__boundDepthTexture!==t){if(t!==null&&z.has(t)&&(e.width!==t.image.width||e.height!==t.image.height))throw Error(`THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.`);B.setupDepthRenderbuffer(e)}}let s=e.texture;(s.isData3DTexture||s.isDataArrayTexture||s.isCompressedArrayTexture)&&(a=!0);let c=z.get(e).__webglFramebuffer;e.isWebGLCubeRenderTarget?(r=Array.isArray(c[t])?c[t][n]:c[t],i=!0):r=e.samples>0&&B.useMultisampledRTT(e)===!1?z.get(e).__webglMultisampledFramebuffer:Array.isArray(c)?c[n]:c,F.copy(e.viewport),te.copy(e.scissor),ne=e.scissorTest}else F.copy(ue).multiplyScalar(se).floor(),te.copy(I).multiplyScalar(se).floor(),ne=de;if(n!==0&&(r=O),R.bindFramebuffer(L.FRAMEBUFFER,r)&&R.drawBuffers(e,r),R.viewport(F),R.scissor(te),R.setScissorTest(ne),i){let r=z.get(e.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_CUBE_MAP_POSITIVE_X+t,r.__webglTexture,n)}else if(a){let r=t;for(let t=0;t<e.textures.length;t++){let i=z.get(e.textures[t]);L.framebufferTextureLayer(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0+t,i.__webglTexture,n,r)}}else if(e!==null&&n!==0){let t=z.get(e.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,t.__webglTexture,n)}N=-1};function gt(e){let t=z.get(e);return(t.__readFormat!==e.format||t.__readType!==e.type)&&(t.__readFormat=e.format,t.__readType=e.type,t.__formatReadable=we.textureFormatReadable(e.format),t.__typeReadable=we.textureTypeReadable(e.type)),t}this.readRenderTargetPixels=function(e,t,n,r,i,a,o,s=0){if(!(e&&e.isWebGLRenderTarget)){H(`WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.`);return}let c=z.get(e).__webglFramebuffer;if(e.isWebGLCubeRenderTarget&&o!==void 0&&(c=c[o],Array.isArray(c)&&(c=c[0])),c){R.bindFramebuffer(L.FRAMEBUFFER,c);try{let o=e.textures[s],c=o.format,l=o.type;e.textures.length>1&&L.readBuffer(L.COLOR_ATTACHMENT0+s);let u=gt(o);if(u.__formatReadable===!1){H(`WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.`);return}if(u.__typeReadable===!1){H(`WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.`);return}t>=0&&t<=e.width-r&&n>=0&&n<=e.height-i&&L.readPixels(t,n,r,i,Be.convert(c),Be.convert(l),a)}finally{let e=M===null?null:z.get(M).__webglFramebuffer;R.bindFramebuffer(L.FRAMEBUFFER,e)}}},this.readRenderTargetPixelsAsync=async function(e,t,n,r,i,a,o,s=0){if(!(e&&e.isWebGLRenderTarget))throw Error(`THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.`);let c=z.get(e).__webglFramebuffer;if(e.isWebGLCubeRenderTarget&&o!==void 0&&(c=c[o],Array.isArray(c)&&(c=c[0])),c){if(t>=0&&t<=e.width-r&&n>=0&&n<=e.height-i){R.bindFramebuffer(L.FRAMEBUFFER,c);let o=e.textures[s],l=o.format,u=o.type;e.textures.length>1&&L.readBuffer(L.COLOR_ATTACHMENT0+s);let d=gt(o);if(d.__formatReadable===!1)throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.`);if(d.__typeReadable===!1)throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.`);let f=L.createBuffer();L.bindBuffer(L.PIXEL_PACK_BUFFER,f),L.bufferData(L.PIXEL_PACK_BUFFER,a.byteLength,L.STREAM_READ),L.readPixels(t,n,r,i,Be.convert(l),Be.convert(u),0),L.bindBuffer(L.PIXEL_PACK_BUFFER,null);let p=M===null?null:z.get(M).__webglFramebuffer;R.bindFramebuffer(L.FRAMEBUFFER,p);let m=L.fenceSync(L.SYNC_GPU_COMMANDS_COMPLETE,0);return L.flush(),await Ei(L,m,4),L.bindBuffer(L.PIXEL_PACK_BUFFER,f),L.getBufferSubData(L.PIXEL_PACK_BUFFER,0,a),L.bindBuffer(L.PIXEL_PACK_BUFFER,null),L.deleteBuffer(f),L.deleteSync(m),a}throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.`)}},this.copyFramebufferToTexture=function(e,t=null,n=0){let r=2**-n,i=Math.floor(e.image.width*r),a=Math.floor(e.image.height*r),o=t===null?0:t.x,s=t===null?0:t.y;B.setTexture2D(e,0),L.copyTexSubImage2D(L.TEXTURE_2D,n,0,0,o,s,i,a),R.unbindTexture()},this.copyTextureToTexture=function(e,t,n=null,r=null,i=0,a=0){let o,s,c,l,u,d,f,p,m,h=e.isCompressedTexture?e.mipmaps[a]:e.image;if(n!==null)o=n.max.x-n.min.x,s=n.max.y-n.min.y,c=n.isBox3?n.max.z-n.min.z:1,l=n.min.x,u=n.min.y,d=n.isBox3?n.min.z:0;else{let t=2**-i;o=Math.floor(h.width*t),s=Math.floor(h.height*t),c=e.isDataArrayTexture?h.depth:e.isData3DTexture?Math.floor(h.depth*t):1,l=0,u=0,d=0}r===null?(f=0,p=0,m=0):(f=r.x,p=r.y,m=r.z);let g=Be.convert(t.format),_=Be.convert(t.type),v;t.isData3DTexture?(B.setTexture3D(t,0),v=L.TEXTURE_3D):t.isDataArrayTexture||t.isCompressedArrayTexture?(B.setTexture2DArray(t,0),v=L.TEXTURE_2D_ARRAY):(B.setTexture2D(t,0),v=L.TEXTURE_2D),R.activeTexture(L.TEXTURE0),R.pixelStorei(L.UNPACK_FLIP_Y_WEBGL,t.flipY),R.pixelStorei(L.UNPACK_PREMULTIPLY_ALPHA_WEBGL,t.premultiplyAlpha),R.pixelStorei(L.UNPACK_ALIGNMENT,t.unpackAlignment);let y=R.getParameter(L.UNPACK_ROW_LENGTH),b=R.getParameter(L.UNPACK_IMAGE_HEIGHT),x=R.getParameter(L.UNPACK_SKIP_PIXELS),S=R.getParameter(L.UNPACK_SKIP_ROWS),C=R.getParameter(L.UNPACK_SKIP_IMAGES);R.pixelStorei(L.UNPACK_ROW_LENGTH,h.width),R.pixelStorei(L.UNPACK_IMAGE_HEIGHT,h.height),R.pixelStorei(L.UNPACK_SKIP_PIXELS,l),R.pixelStorei(L.UNPACK_SKIP_ROWS,u),R.pixelStorei(L.UNPACK_SKIP_IMAGES,d);let w=e.isDataArrayTexture||e.isData3DTexture,T=t.isDataArrayTexture||t.isData3DTexture;if(e.isDepthTexture){let n=z.get(e),r=z.get(t),h=z.get(n.__renderTarget),g=z.get(r.__renderTarget);R.bindFramebuffer(L.READ_FRAMEBUFFER,h.__webglFramebuffer),R.bindFramebuffer(L.DRAW_FRAMEBUFFER,g.__webglFramebuffer);for(let n=0;n<c;n++)w&&(L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,z.get(e).__webglTexture,i,d+n),L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,z.get(t).__webglTexture,a,m+n)),L.blitFramebuffer(l,u,l+o,u+s,f,p,f+o,p+s,L.DEPTH_BUFFER_BIT,L.NEAREST);R.bindFramebuffer(L.READ_FRAMEBUFFER,null),R.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else if(i!==0||e.isRenderTargetTexture||z.has(e)){let n=z.get(e),r=z.get(t);R.bindFramebuffer(L.READ_FRAMEBUFFER,k),R.bindFramebuffer(L.DRAW_FRAMEBUFFER,A);for(let e=0;e<c;e++)w?L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,n.__webglTexture,i,d+e):L.framebufferTexture2D(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,n.__webglTexture,i),T?L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,r.__webglTexture,a,m+e):L.framebufferTexture2D(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,r.__webglTexture,a),i===0?T?L.copyTexSubImage3D(v,a,f,p,m+e,l,u,o,s):L.copyTexSubImage2D(v,a,f,p,l,u,o,s):L.blitFramebuffer(l,u,l+o,u+s,f,p,f+o,p+s,L.COLOR_BUFFER_BIT,L.NEAREST);R.bindFramebuffer(L.READ_FRAMEBUFFER,null),R.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else T?e.isDataTexture||e.isData3DTexture?L.texSubImage3D(v,a,f,p,m,o,s,c,g,_,h.data):t.isCompressedArrayTexture?L.compressedTexSubImage3D(v,a,f,p,m,o,s,c,g,h.data):L.texSubImage3D(v,a,f,p,m,o,s,c,g,_,h):e.isDataTexture?L.texSubImage2D(L.TEXTURE_2D,a,f,p,o,s,g,_,h.data):e.isCompressedTexture?L.compressedTexSubImage2D(L.TEXTURE_2D,a,f,p,h.width,h.height,g,h.data):L.texSubImage2D(L.TEXTURE_2D,a,f,p,o,s,g,_,h);R.pixelStorei(L.UNPACK_ROW_LENGTH,y),R.pixelStorei(L.UNPACK_IMAGE_HEIGHT,b),R.pixelStorei(L.UNPACK_SKIP_PIXELS,x),R.pixelStorei(L.UNPACK_SKIP_ROWS,S),R.pixelStorei(L.UNPACK_SKIP_IMAGES,C),a===0&&t.generateMipmaps===!0&&t.mipmapsAutoUpdate===!0&&L.generateMipmap(v),R.unbindTexture()},this.initRenderTarget=function(e){z.get(e).__webglFramebuffer===void 0&&B.setupRenderTarget(e)},this.initTexture=function(e){e.isCubeTexture?B.setTextureCube(e,0):e.isData3DTexture?B.setTexture3D(e,0):e.isDataArrayTexture||e.isCompressedArrayTexture?B.setTexture2DArray(e,0):B.setTexture2D(e,0),R.unbindTexture()},this.resetState=function(){j=0,ee=0,M=null,R.reset(),Ve.reset()},typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}get coordinateSystem(){return _i}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=Ki._getDrawingBufferColorSpace(e),t.unpackColorSpace=Ki._getUnpackColorSpace()}},qp=`
attribute float size;
attribute float alpha;
attribute vec3 tint;
uniform float scale;
varying float vAlpha;
varying vec3 vTint;
void main() {
  vTint = tint;
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`,Jp=`
varying float vAlpha;
varying vec3 vTint;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot(p, p);
  if (d > 1.0 || vAlpha < 0.02) discard;
  float rim = smoothstep(0.6, 0.78, d);
  gl_FragColor = vec4(mix(vTint, vTint * 0.3, rim), vAlpha);
  #include <colorspace_fragment>
}`,Yp=`
varying float vAlpha;
varying vec3 vTint;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot(p, p);
  if (d > 1.0) discard;
  float core = 1.0 - smoothstep(0.0, 0.55, d);
  gl_FragColor = vec4(mix(vTint, vec3(1.0), core * 0.7) * vAlpha, 1.0);
  #include <colorspace_fragment>
}`,Xp=class{constructor(e,t){T(this,`points`,void 0),T(this,`n`,void 0),T(this,`pos`,void 0),T(this,`tint`,void 0),T(this,`size`,void 0),T(this,`alpha`,void 0),T(this,`vel`,void 0),T(this,`life`,void 0),T(this,`maxLife`,void 0),T(this,`grow`,void 0),T(this,`grav`,void 0),T(this,`drag`,void 0),T(this,`baseAlpha`,void 0),T(this,`next`,0),T(this,`geo`,new Ro),T(this,`mat`,void 0),this.n=e,this.pos=new Float32Array(e*3),this.tint=new Float32Array(e*3),this.size=new Float32Array(e),this.alpha=new Float32Array(e),this.vel=new Float32Array(e*3),this.life=new Float32Array(e),this.maxLife=new Float32Array(e),this.grow=new Float32Array(e),this.grav=new Float32Array(e),this.drag=new Float32Array(e),this.baseAlpha=new Float32Array(e);for(let[e,t,n]of[[`position`,this.pos,3],[`tint`,this.tint,3],[`size`,this.size,1],[`alpha`,this.alpha,1]]){let r=new wo(t,n);r.setUsage(gi),this.geo.setAttribute(e,r)}this.mat=new Al({uniforms:{scale:{value:600}},vertexShader:qp,fragmentShader:t?Yp:Jp,transparent:!0,depthWrite:!1,blending:t?2:1}),this.points=new fc(this.geo,this.mat),this.points.frustumCulled=!1,this.points.renderOrder=t?6:5}setViewport(e,t){this.mat.uniforms.scale.value=e/(2*Math.tan(t*Math.PI/360))}emit(e,t,n,r,i,a,o,s,c,l=0,u=0,d=0,f=1){let p=this.next;this.next=(p+1)%this.n,this.pos[p*3]=e,this.pos[p*3+1]=t,this.pos[p*3+2]=n,this.vel[p*3]=r,this.vel[p*3+1]=i,this.vel[p*3+2]=a,this.tint[p*3]=c.r,this.tint[p*3+1]=c.g,this.tint[p*3+2]=c.b,this.life[p]=o,this.maxLife[p]=o,this.size[p]=s,this.grow[p]=l,this.grav[p]=u,this.drag[p]=d,this.baseAlpha[p]=f,this.alpha[p]=f}update(e){for(let t=0;t<this.n;t++){if(this.life[t]<=0)continue;if(this.life[t]-=e,this.life[t]<=0){this.alpha[t]=0,this.size[t]=0;continue}let n=Math.exp(-this.drag[t]*e),r=t*3;this.vel[r]*=n,this.vel[r+1]=this.vel[r+1]*n-this.grav[t]*e,this.vel[r+2]*=n,this.pos[r]+=this.vel[r]*e,this.pos[r+1]+=this.vel[r+1]*e,this.pos[r+2]+=this.vel[r+2]*e,this.size[t]+=this.grow[t]*e,this.alpha[t]=this.baseAlpha[t]*Math.min(1,this.life[t]/this.maxLife[t]*3)}for(let e of[`position`,`tint`,`size`,`alpha`])this.geo.getAttribute(e).needsUpdate=!0}clear(){this.life.fill(0),this.alpha.fill(0),this.size.fill(0)}dispose(){this.geo.dispose(),this.mat.dispose()}},Zp=class{constructor(e){T(this,`mesh`,void 0),T(this,`pos`,void 0),T(this,`quads`,void 0),T(this,`next`,0),T(this,`geo`,new Ro),this.quads=e,this.pos=new Float32Array(e*18);let t=new wo(this.pos,3);t.setUsage(gi),this.geo.setAttribute(`position`,t);let n=new gs({color:1446684,transparent:!0,opacity:.42,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-3,polygonOffsetUnits:-8});this.mesh=new Os(this.geo,n),this.mesh.frustumCulled=!1,this.mesh.renderOrder=1}add(e,t,n,r,i,a,o){let s=r-e,c=a-n,l=Math.hypot(s,c);if(l<.02||l>3)return;let u=-c/l*o*.5,d=s/l*o*.5,f=this.next*18;this.next=(this.next+1)%this.quads;let p=this.pos,m=t+.04,h=i+.04;p[f]=e-u,p[f+1]=m,p[f+2]=n-d,p[f+3]=r+u,p[f+4]=h,p[f+5]=a+d,p[f+6]=e+u,p[f+7]=m,p[f+8]=n+d,p[f+9]=e-u,p[f+10]=m,p[f+11]=n-d,p[f+12]=r-u,p[f+13]=h,p[f+14]=a-d,p[f+15]=r+u,p[f+16]=h,p[f+17]=a+d,this.geo.getAttribute(`position`).needsUpdate=!0}clear(){this.pos.fill(0),this.geo.getAttribute(`position`).needsUpdate=!0}dispose(){this.geo.dispose(),this.mesh.material.dispose()}},Qp={warm:[`#ffd23f`,`#16131c`],hot:[`#ff5a4e`,`#ffffff`],cool:[`#1fc8b6`,`#16131c`],white:[`#ffffff`,`#16131c`],violet:[`#9b87ff`,`#ffffff`]};function $p(e,t){let[n,r]=Qp[t]??Qp.warm,i=document.createElement(`canvas`);i.width=384,i.height=192;let a=i.getContext(`2d`);a.beginPath();for(let e=0;e<26;e++){let t=e/26*Math.PI*2+.2,n=.88+.12*Math.sin(e*2.7),r=(e%2==0?182:138)*n,i=(e%2==0?90:64)*n,o=192+Math.cos(t)*r,s=96+Math.sin(t)*i;e===0?a.moveTo(o,s):a.lineTo(o,s)}a.closePath(),a.fillStyle=n,a.fill(),a.lineJoin=`round`,a.lineWidth=9,a.strokeStyle=`#16131c`,a.stroke(),a.save(),a.clip(),a.fillStyle=`rgba(22,19,28,0.16)`;for(let e=100;e<192;e+=11)for(let t=e/11%2==0?0:5.5;t<384;t+=11)a.beginPath(),a.arc(t,e,1+(e-100)/92*3,0,Math.PI*2),a.fill();a.restore(),a.textAlign=`center`,a.textBaseline=`middle`;let o=84,s=e=>`italic 900 ${e}px "Arial Black", "Arial Narrow", Impact, Arial, sans-serif`;a.font=s(o);let c=a.measureText(e).width;c>250&&(o=Math.floor(o*250/c),a.font=s(o)),a.lineWidth=12,a.strokeStyle=r===`#ffffff`?`#16131c`:`#ffffff`,a.strokeText(e,192,100),a.fillStyle=r,a.fillText(e,192,100);let l=new hc(i);return l.colorSpace=ui,l}var em=class{prewarm(e,t){for(let[n,r]of t){let t=`${r}:${n}`;if(this.textures.has(t))continue;let i=$p(n,r);this.textures.set(t,i),e.initTexture(i)}}constructor(e=8){T(this,`group`,new Fa),T(this,`pops`,[]),T(this,`textures`,new Map),T(this,`blank`,void 0),T(this,`next`,0);let t=document.createElement(`canvas`);t.width=t.height=2,this.blank=new hc(t);for(let t=0;t<e;t++){let e=new ls(new Yo({map:this.blank,transparent:!0,depthTest:!1,depthWrite:!1,fog:!1}));e.visible=!1,e.renderOrder=20,this.group.add(e),this.pops.push({sprite:e,age:0,life:0,size:1,tilt:0})}}show(e,t,n,r,i=`warm`,a=3.4){let o=`${i}:${e}`,s=this.textures.get(o);s||(s=$p(e,i),this.textures.set(o,s));let c=this.pops[this.next];this.next=(this.next+1)%this.pops.length,c.sprite.material.map=s,c.sprite.position.set(t,n,r),c.sprite.visible=!0,c.age=0,c.life=.85,c.size=a,c.tilt=(Math.random()-.5)*.5}update(e){for(let t of this.pops){if(!t.sprite.visible)continue;if(t.age+=e,t.age>=t.life){t.sprite.visible=!1;continue}let n=t.age/.16,r=Math.max(0,(t.age-t.life+.18)/.18),i=(n<1?n*(1.9-.9*n)+Math.sin(n*Math.PI)*.25:1)*(1-r*r)*t.size;t.sprite.scale.set(i,i*.5,1),t.sprite.position.y+=e*.9,t.sprite.material.rotation=t.tilt*(1+Math.sin(t.age*30)*.06),t.sprite.material.opacity=1-r}}clear(){for(let e of this.pops)e.sprite.visible=!1}dispose(){for(let e of this.textures.values())e.dispose();this.blank.dispose();for(let e of this.pops)e.sprite.material.dispose()}},tm=`
uniform float time;
uniform float strength;
uniform float aspect;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  p.x *= aspect;
  float a = atan(p.y, p.x);
  float r = length(p);
  float cell = floor(a * 28.0);
  float n = fract(sin(cell * 91.7 + floor(time * 13.0) * 17.3) * 43758.5453);
  float inCell = abs(fract(a * 28.0) - 0.5) * 2.0;
  float start = 0.62 + n * 0.5;
  float streak = step(0.72, n) * smoothstep(start, start + 0.5, r) * (1.0 - smoothstep(0.2, 0.7, inCell));
  gl_FragColor = vec4(vec3(1.0), streak * strength * 0.5);
}`,nm=class{constructor(){T(this,`mesh`,void 0),T(this,`mat`,void 0),T(this,`level`,0),this.mat=new Al({uniforms:{time:{value:0},strength:{value:0},aspect:{value:1.6}},vertexShader:`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,fragmentShader:tm,transparent:!0,depthTest:!1,depthWrite:!1}),this.mesh=new Os(new yl(2,2),this.mat),this.mesh.frustumCulled=!1,this.mesh.renderOrder=30,this.mesh.visible=!1}update(e,t,n,r){this.level+=(n-this.level)*Math.min(1,e*(n>this.level?14:4)),this.mesh.visible=this.level>.02,this.mat.uniforms.time.value=t,this.mat.uniforms.strength.value=this.level,this.mat.uniforms.aspect.value=r}dispose(){this.mesh.geometry.dispose(),this.mat.dispose()}},rm=class{constructor(e){T(this,`mesh`,void 0),T(this,`m`,new q),T(this,`s`,new G),T(this,`p`,new G),T(this,`count`,0);let t=document.createElement(`canvas`);t.width=t.height=128;let n=t.getContext(`2d`),r=n.createRadialGradient(64,64,20,64,64,62);r.addColorStop(0,`rgba(22,19,28,0.62)`),r.addColorStop(.7,`rgba(22,19,28,0.5)`),r.addColorStop(1,`rgba(22,19,28,0)`),n.fillStyle=r,n.fillRect(0,0,128,128),n.globalCompositeOperation=`destination-out`;for(let e=0;e<128;e+=8)for(let t=e/8%2==0?0:4;t<128;t+=8){let r=Math.hypot(t-64,e-64)/64;r<.55||(n.beginPath(),n.arc(t,e,Math.min(4.2,(r-.5)*9),0,Math.PI*2),n.fill())}let i=new hc(t),a=new yl(1,1);a.rotateX(-Math.PI/2);let o=new gs({map:i,transparent:!0,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-4,polygonOffsetUnits:-10});this.mesh=new ec(a,o,e),this.mesh.frustumCulled=!1,this.mesh.renderOrder=2,this.mesh.count=0}begin(){this.count=0}add(e,t,n,r,i,a){if(this.count>=this.mesh.instanceMatrix.count)return;let o=Math.max(.35,1-a*.09);this.m.compose(this.p.set(e,t+.05,n),r,this.s.set(i*o,1,i*o*1.25)),this.mesh.setMatrixAt(this.count++,this.m)}end(){this.mesh.count=this.count,this.mesh.instanceMatrix.needsUpdate=!0}dispose(){this.mesh.geometry.dispose();let e=this.mesh.material;e.map?.dispose(),e.dispose(),this.mesh.dispose()}},im=1446684,am=null;function om(){if(!am){let e=new Uint8Array([118,118,190,190,255,255]);am=new Hs(e,e.length,1,hr),am.minFilter=Gn,am.magFilter=Gn,am.generateMipmaps=!1,am.needsUpdate=!0}return am}function sm(e={}){return new Ml({color:e.color??16777215,vertexColors:e.vertexColors??!1,emissive:e.emissive??0,emissiveIntensity:e.emissiveIntensity??1,transparent:e.transparent??!1,opacity:e.opacity??1,side:e.side??0,gradientMap:om()})}var cm=`
#include <common>
#include <skinning_pars_vertex>
#include <fog_pars_vertex>
attribute vec3 onormal;
uniform float thickness;
void main() {
  // "transformed"/"objectNormal" heißen so, damit die Skinning-Bausteine von
  // three.js greifen: die Kontur macht dann jede Knochenbewegung mit.
  vec3 transformed = position;
  vec3 objectNormal = onormal;
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
  #ifdef USE_INSTANCING
    mat4 m = modelMatrix * instanceMatrix;
  #else
    mat4 m = modelMatrix;
  #endif
  vec4 world = m * vec4(transformed, 1.0);
  // Richtung aus der (bewegten) Normalen, Länge aus dem Attribut: onormal mit
  // Länge 1 ergibt die volle Dicke, kürzere Normalen eine dünnere Linie, 0 gar
  // keine. Ohne Schutz würde normalize() bei Länge 0 (auf null skalierte Teile)
  // NaN liefern.
  vec3 wn = mat3(m) * objectNormal;
  float wl = length(wn);
  wn = wl > 1e-6 ? wn * (length(onormal) / wl) : vec3(0.0);
  // Mit der Entfernung etwas dicker, damit die Linie auch hinten sichtbar bleibt.
  float d = distance(cameraPosition, world.xyz);
  world.xyz += wn * thickness * clamp(d * 0.055, 0.75, 3.5);
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,lm=`
#include <common>
#include <fog_pars_fragment>
uniform vec3 ink;
void main() {
  gl_FragColor = vec4(ink, 1.0);
  // Wie bei den eingebauten Materialien: erst in den Ausgabefarbraum, dann
  // Nebel. Ohne die Umrechnung käme die Tusche fast rein schwarz heraus.
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,um=new Map;function dm(e=.045,t=im){let n=`${e}:${t}`,r=um.get(n);return r||(r=new Al({uniforms:Dl.merge([Z.fog,{thickness:{value:e},ink:{value:new J(t)}}]),vertexShader:cm,fragmentShader:lm,side:1,fog:!0}),um.set(n,r)),r}function fm(e){e.getAttribute(`normal`)||e.computeVertexNormals();let t=e.getAttribute(`position`),n=e.getAttribute(`normal`),r=new Map,i=[];for(let e=0;e<t.count;e++){let a=`${Math.round(t.getX(e)*1e3)},${Math.round(t.getY(e)*1e3)},${Math.round(t.getZ(e)*1e3)}`;i.push(a);let o=r.get(a);o?(o[0]+=n.getX(e),o[1]+=n.getY(e),o[2]+=n.getZ(e)):r.set(a,[n.getX(e),n.getY(e),n.getZ(e)])}let a=new Float32Array(t.count*3);for(let e=0;e<t.count;e++){let t=r.get(i[e]),n=Math.hypot(t[0],t[1],t[2])||1;a[e*3]=t[0]/n,a[e*3+1]=t[1]/n,a[e*3+2]=t[2]/n}return e.setAttribute(`onormal`,new wo(a,3)),e}function pm(e,t=e.geometry,n=.045,r=im){t.getAttribute(`onormal`)||fm(t);let i=new Bs(t,dm(n,r));return i.name=`outline`,i.matrixAutoUpdate=!1,e.add(i),i.bind(e.skeleton,e.bindMatrix),i}function mm(e,t){e.traverse(e=>{e.name===`outline`&&(e.visible=t)})}function Q(e){let t=new J(e);return[t.r,t.g,t.b]}var hm=Math.PI*2,gm=Math.PI/2;function _m(e,t,n){return e<t?t:e>n?n:e}function vm(e,t,n,r){return e+(t-e)*(1-Math.exp(-n*r))}function ym(e){let t=Math.sin(e*12.9898)*43758.5453;return t-Math.floor(t)}var $={spin:0,drift:1,chassis:2,wFL:3,wFR:4,wRL:5,wRR:6,steer:7,torso:8,head:9,earL:10,earR:11,armLU:12,armLF:13,handL:14,armRU:15,armRF:16,handR:17,c0:18,c1:19,c2:20,c3:21,aux0:22,aux1:23,flameL:24,flameR:25,guard:26,bolt0:27,bolt1:28,puff0:29,puff1:30},bm=31,xm=2959926,Sm=5923187,Cm=14937076,wm=16644592,Tm=`#16131c`;function Em(e,t,n,r){let i=new Ro;return i.setAttribute(`position`,new Y(e,3)),i.setAttribute(`normal`,new Y(t,3)),n&&i.setAttribute(`color`,new Y(n,3)),i.setIndex(r),i}function Dm(e,t={}){let n=e.length,r=e[0].p.length/2,i=new Float32Array(n*r*3);for(let t=0;t<n;t++)for(let n=0;n<r;n++){let a=(t*r+n)*3;i[a]=e[t].p[n*2],i[a+1]=e[t].p[n*2+1],i[a+2]=e[t].z}let a=new Float32Array(n*r*3);for(let e=0;e<n;e++)for(let t=0;t<r;t++){let o=(e*r+(t+1)%r)*3,s=(e*r+(t+r-1)%r)*3,c=(Math.min(e+1,n-1)*r+t)*3,l=(Math.max(e-1,0)*r+t)*3,u=i[o]-i[s],d=i[o+1]-i[s+1],f=i[o+2]-i[s+2],p=i[c]-i[l],m=i[c+1]-i[l+1],h=i[c+2]-i[l+2],g=d*h-f*m,_=f*p-u*h,v=u*m-d*p,y=Math.hypot(g,_,v);y<1e-9?(g=0,_=0,v=e*2<n?-1:1):(g/=y,_/=y,v/=y);let b=(e*r+t)*3;a[b]=g,a[b+1]=_,a[b+2]=v}let o=[],s=[],c=t.color?[]:null,l=[],u=[0,0,0,0];for(let e=0;e<n-1;e++)for(let n=0;n<r;n++){let d=(n+1)%r;u[0]=e*r+n,u[1]=e*r+d,u[2]=(e+1)*r+n,u[3]=(e+1)*r+d;let f=0,p=0,m=0;if(t.flat){let e=u[0]*3,t=u[1]*3,n=u[2]*3,r=u[3]*3,a=i[r]-i[e],o=i[r+1]-i[e+1],s=i[r+2]-i[e+2],c=i[n]-i[t],l=i[n+1]-i[t+1],d=i[n+2]-i[t+2];f=o*d-s*l,p=s*c-a*d,m=a*l-o*c;let h=Math.hypot(f,p,m)||1;f/=h,p/=h,m/=h}let h=o.length/3,g=c&&t.color?Q(t.color(e,n)):null;for(let e=0;e<4;e++){let n=u[e]*3;o.push(i[n],i[n+1],i[n+2]),t.flat?s.push(f,p,m):s.push(a[n],a[n+1],a[n+2]),c&&g&&c.push(g[0],g[1],g[2])}l.push(h,h+1,h+2,h+1,h+3,h+2)}let d=(a,u)=>{let d=0,f=0;for(let e=0;e<r;e++)d+=i[(a*r+e)*3],f+=i[(a*r+e)*3+1];let p=o.length/3,m=u<0?0:n-2,h=c?Q(t.capColor??(t.color?t.color(m,0):16777215)):null;o.push(d/r,f/r,e[a].z),s.push(0,0,u),c&&h&&c.push(h[0],h[1],h[2]);for(let e=0;e<r;e++){let t=(a*r+e)*3;o.push(i[t],i[t+1],i[t+2]),s.push(0,0,u),c&&h&&c.push(h[0],h[1],h[2])}for(let e=0;e<r;e++){let t=(e+1)%r;u<0?l.push(p,p+1+t,p+1+e):l.push(p,p+1+e,p+1+t)}};return t.capA!==!1&&d(0,-1),t.capB!==!1&&d(n-1,1),Em(o,s,c,l)}function Om(e,t,n,r,i,a,o,s=0){let c=[],l=2/a;for(let e=0;e<o;e++){let a=e/o*hm;if(s>0&&n>s*1.2){let t=Math.asin((s/n)**(1/l));e===o/4-1?a=gm-t:e===o/4+1&&(a=gm+t)}let u=Math.cos(a),d=Math.sin(a);c.push(Math.sign(u)*Math.abs(u)**+l*n,t+Math.sign(d)*Math.abs(d)**+l*(d>=0?r:i))}return{z:e,p:c}}function km(e,t,n){let r=e.length,i=[];for(let t=0;t<r-1;t++){let n=e[t+1][0]-e[t][0],r=e[t+1][1]-e[t][1],a=Math.hypot(n,r)||1;i.push(r/a,-n/a)}let a=[],o=[],s=[],c=[],l=16777215;for(let u=0;u<r-1;u++){l=e[u][2]??l;let d=i[u*2],f=i[u*2+1];u>0&&!e[u][3]?(d+=i[(u-1)*2],f+=i[(u-1)*2+1]):u===0&&e[0][0]===0&&!e[0][3]&&Math.abs(f)>1e-6&&(d=0);let p=Math.hypot(d,f)||1;d/=p,f/=p;let m=i[u*2],h=i[u*2+1];u<r-2&&!e[u+1][3]?(m+=i[(u+1)*2],h+=i[(u+1)*2+1]):u===r-2&&e[r-1][0]===0&&!e[r-1][3]&&Math.abs(h)>1e-6&&(m=0),p=Math.hypot(m,h)||1,m/=p,h/=p;let g=e[u][0],_=e[u][1],v=e[u+1][0],y=e[u+1][1];for(let e=0;e<t;e++){let r=Math.cos(e/t*hm),i=Math.sin(e/t*hm),p=Math.cos((e+1)/t*hm),b=Math.sin((e+1)/t*hm),[x,S,C]=Q(n?.(u,e)??l),w=a.length/3;a.push(g*r,_,g*i,v*r,y,v*i,g*p,_,g*b,v*p,y,v*b),o.push(d*r,f,d*i,m*r,h,m*i,d*p,f,d*b,m*p,h,m*b);for(let e=0;e<4;e++)s.push(x,S,C);g>1e-9&&c.push(w,w+1,w+2),v>1e-9&&c.push(w+1,w+3,w+2)}}return Em(a,o,s,c)}function Am(e,t,n,r=0){let i=e.map(e=>new G(e[0],e[1],e[2]));r>0&&(i=new Mc(i,!1,`centripetal`).getPoints(r));let a=i.length,o=[],s=[],c=[],l=new G,u=new G(0,1,0),d=new G,f=new G,p=new G;for(let e=0;e<a;e++){l.subVectors(i[Math.min(e+1,a-1)],i[Math.max(e-1,0)]).normalize(),e===0&&(Math.abs(l.y)>.9&&u.set(1,0,0),f.copy(l)),e===a-1&&p.copy(l),u.addScaledVector(l,-u.dot(l)).normalize(),d.crossVectors(l,u);let r=typeof t==`number`?t:t(e/(a-1));for(let t=0;t<n;t++){let a=t/n*hm,c=Math.cos(a)*u.x+Math.sin(a)*d.x,l=Math.cos(a)*u.y+Math.sin(a)*d.y,f=Math.cos(a)*u.z+Math.sin(a)*d.z;o.push(i[e].x+c*r,i[e].y+l*r,i[e].z+f*r),s.push(c,l,f)}}for(let e=0;e<a-1;e++)for(let t=0;t<n;t++){let r=(t+1)%n,i=e*n+t,a=e*n+r,o=(e+1)*n+t,s=(e+1)*n+r;c.push(i,a,o,a,s,o)}for(let e=0;e<2;e++){let t=e===0?0:a-1,r=e===0?f:p,l=e===0?-1:1,u=o.length/3;o.push(i[t].x,i[t].y,i[t].z),s.push(r.x*l,r.y*l,r.z*l);for(let e=0;e<n;e++){let i=(t*n+e)*3;o.push(o[i],o[i+1],o[i+2]),s.push(r.x*l,r.y*l,r.z*l)}for(let t=0;t<n;t++){let r=(t+1)%n;e===0?c.push(u,u+1+r,u+1+t):c.push(u,u+1+t,u+1+r)}}return Em(o,s,null,c)}function jm(e,t){let n=[];for(let t=0;t<e.length;t+=2)n.push(new W(e[t],e[t+1]));pl.isClockWise(n)&&(n=n.reverse());let r=pl.triangulateShape(n,[]),i=n.length,a=t/2,o=[],s=[],c=[];for(let e of n)o.push(e.x,e.y,a),s.push(0,0,1);for(let e of n)o.push(e.x,e.y,-a),s.push(0,0,-1);for(let e of r){let t=n[e[0]],r=n[e[1]],a=n[e[2]];(r.x-t.x)*(a.y-t.y)-(r.y-t.y)*(a.x-t.x)>0?c.push(e[0],e[1],e[2],i+e[0],i+e[2],i+e[1]):c.push(e[0],e[2],e[1],i+e[0],i+e[1],i+e[2])}for(let e=0;e<i;e++){let t=n[e],r=n[(e+1)%i],l=r.x-t.x,u=r.y-t.y,d=Math.hypot(l,u)||1,f=o.length/3;o.push(t.x,t.y,a,t.x,t.y,-a,r.x,r.y,-a,r.x,r.y,a);for(let e=0;e<4;e++)s.push(u/d,-l/d,0);c.push(f,f+1,f+2,f,f+2,f+3)}return Em(o,s,null,c)}function Mm(e,t,n,r,i){let a=new bl(1,r,i);return a.scale(e,t,n),a}function Nm(e,t,n){return new yc(e,t,n)}function Pm(e,t,n,r){return new Sc(e,t,n,r,1)}function Fm(e,t,n){let r=new Cc(e,t,n,1);return r.translate(0,t/2,0),r}function Im(e,t,n,r){let i=new bc(e,t,r,n,1);return i.translate(0,t/2,0),i}function Lm(e,t,n,r,i,a=4){let o=e/2,s=t/2,c=n/2;return Dm([Om(-c,0,o-r,s-r,s-r,a,i),Om(-c+r,0,o,s,s,a,i),Om(c-r,0,o,s,s,a,i),Om(c,0,o-r,s-r,s-r,a,i)])}var Rm=3815237,zm=4933719;function Bm(e,t,n,r,i,a,o){let s=t/2,c=km([[0,-s,Rm],[e,-s+t*.14,Rm],[e,s-t*.26,Rm],[e*.83,s,r],[e*.62,s-.012,i,!0],[e*.25,s-Math.min(.075,t*.3),o,!0],[0,s-Math.min(.03,t*.12)]],n,(e,t)=>t%2==1?e===4?a:e===1?zm:void 0:void 0);return c.rotateZ(-gm),c}function Vm(e,t,n){let r=t/2,i=km([[0,-r],[e,-r+t*.14],[e,r-t*.26],[e*.83,r],[0,r]],n);return i.rotateZ(-gm),i}var Hm=.8,Um=new q,Wm=new zi,Gm=new _a,Km=new G,qm=new G,Jm=new G(0,1,0),Ym=class{constructor(e,t,n,r=!1){T(this,`rest`,void 0),T(this,`detail`,void 0),T(this,`outlines`,void 0),T(this,`withUv`,void 0),T(this,`pos`,[]),T(this,`nor`,[]),T(this,`col`,[]),T(this,`uv`,[]),T(this,`si`,[]),T(this,`sw`,[]),T(this,`idx`,[]),T(this,`oPos`,[]),T(this,`oNor`,[]),T(this,`oSi`,[]),T(this,`oSw`,[]),T(this,`oIdx`,[]),T(this,`tmp`,[0,0,0,0]),this.rest=e,this.detail=t,this.outlines=n,this.withUv=r}s(e,t=4){let n=this.detail===2?1:this.detail===1?.8:.55;return Math.max(t,Math.round(e*n))}s4(e){return Math.max(8,Math.round(this.s(e)/4)*4)}get vertexCount(){return this.pos.length/3}get fine(){return this.detail>0}soft(e,t,n,r,i){return this.fine?Lm(e,t,n,r,i):Nm(e,t,n)}put(e,t){t.aim?(Km.set(t.aim[0],t.aim[1],t.aim[2]).normalize(),Wm.setFromUnitVectors(Jm,Km)):t.rot?Wm.setFromEuler(Gm.set(t.rot[0],t.rot[1],t.rot[2],t.order??`XYZ`)):Wm.identity(),t.pos?Km.set(t.pos[0],t.pos[1],t.pos[2]):Km.set(0,0,0),typeof t.scale==`number`?qm.setScalar(t.scale):t.scale?qm.set(t.scale[0],t.scale[1],t.scale[2]):qm.set(1,1,1),Um.compose(Km,Wm,qm).premultiply(this.rest[t.bone]);let n=t.hull??e,r=null;if(t.taper){let e=n.getAttribute(`position`);r=[];for(let n=0;n<e.count;n++)r.push(t.taper(e.getX(n),e.getY(n),e.getZ(n)))}e.applyMatrix4(Um),e.getAttribute(`normal`)||e.computeVertexNormals(),t.hull&&(t.hull.applyMatrix4(Um),t.hull.getAttribute(`normal`)||t.hull.computeVertexNormals());let i=this.outlines?(t.outline??1)*Hm:0;this.appendMain(e,t,t.bone,!1),i>0&&this.appendHull(n,t,t.bone,!1,i,r),t.mirror!==void 0&&(this.appendMain(e,t,t.mirror,!0),i>0&&this.appendHull(n,t,t.mirror,!0,i,r)),e.dispose(),t.hull?.dispose()}appendMain(e,t,n,r){let i=e.getAttribute(`position`),a=e.getAttribute(`normal`),o=e.getAttribute(`color`),s=e.getAttribute(`uv`),c=e.getIndex(),l=this.pos.length/3,u=r?-1:1,[d,f,p]=Q(t.color??16777215),m=this.tmp;for(let e=0;e<i.count;e++){let r=i.getX(e)*u,c=i.getY(e),l=i.getZ(e);this.pos.push(r,c,l),this.nor.push(a.getX(e)*u,a.getY(e),a.getZ(e)),o?this.col.push(o.getX(e),o.getY(e),o.getZ(e)):this.col.push(d,f,p),this.withUv&&this.uv.push(s?s.getX(e):0,s?s.getY(e):0),t.skin?(t.skin(r,c,l,m),this.si.push(m[0],m[2],0,0),this.sw.push(m[1],m[3],0,0)):(this.si.push(n,0,0,0),this.sw.push(1,0,0,0))}let h=c?c.count:i.count;for(let e=0;e<h;e+=3){let t=l+(c?c.getX(e):e),n=l+(c?c.getX(e+1):e+1),i=l+(c?c.getX(e+2):e+2);r?this.idx.push(t,i,n):this.idx.push(t,n,i)}}appendHull(e,t,n,r,i,a){let o=e.getAttribute(`position`),s=e.getAttribute(`normal`),c=e.getIndex(),l=r?-1:1,u=new Map,d=[];for(let e=0;e<o.count;e++){let t=`${Math.round(o.getX(e)*4e3)},${Math.round(o.getY(e)*4e3)},${Math.round(o.getZ(e)*4e3)}`;d.push(t);let n=s.getX(e),r=s.getY(e),i=s.getZ(e),a=u.get(t);if(!a){u.set(t,[n,r,i]);continue}let c=!1;for(let e=0;e<a.length;e+=3)if(a[e]*n+a[e+1]*r+a[e+2]*i>.995){c=!0;break}c||a.push(n,r,i)}let f=new Map;for(let[e,t]of u){let n=0,r=0,a=0;for(let e=0;e<t.length;e+=3)n+=t[e],r+=t[e+1],a+=t[e+2];let o=Math.hypot(n,r,a)||1;n/=o,r/=o,a/=o;let s=1;for(let e=0;e<t.length;e+=3)s=Math.min(s,n*t[e]+r*t[e+1]+a*t[e+2]);let c=i/_m(s,.6,1);f.set(e,[n*c,r*c,a*c])}let p=this.oPos.length/3,m=this.tmp;for(let e=0;e<o.count;e++){let r=f.get(d[e]),i=o.getX(e)*l,s=o.getY(e),c=o.getZ(e),u=a?a[e]:1;this.oPos.push(i,s,c),this.oNor.push(r[0]*l*u,r[1]*u,r[2]*u),t.skin?(t.skin(i,s,c,m),this.oSi.push(m[0],m[2],0,0),this.oSw.push(m[1],m[3],0,0)):(this.oSi.push(n,0,0,0),this.oSw.push(1,0,0,0))}let h=c?c.count:o.count;for(let e=0;e<h;e+=3){let t=p+(c?c.getX(e):e),n=p+(c?c.getX(e+1):e+1),i=p+(c?c.getX(e+2):e+2);r?this.oIdx.push(t,i,n):this.oIdx.push(t,n,i)}}finish(){let e=new Ro;e.setAttribute(`position`,new Y(this.pos,3)),e.setAttribute(`normal`,new Y(this.nor,3)),e.setAttribute(`color`,new Y(this.col,3)),this.withUv&&e.setAttribute(`uv`,new Y(this.uv,2)),e.setAttribute(`skinIndex`,new To(this.si,4)),e.setAttribute(`skinWeight`,new Y(this.sw,4)),e.setIndex(this.idx),e.boundingSphere=Zm.clone();let t=null;return this.oIdx.length>0&&(t=new Ro,t.setAttribute(`position`,new Y(this.oPos,3)),t.setAttribute(`onormal`,new Y(this.oNor,3)),t.setAttribute(`skinIndex`,new To(this.oSi,4)),t.setAttribute(`skinWeight`,new Y(this.oSw,4)),t.setIndex(this.oIdx),t.boundingSphere=Zm.clone()),{main:e,outline:t}}},Xm=.3,Zm=new Ao(new G(0,.7,0),2.6),Qm=[{color:16734798,wf:{x:.585,z:.7,r:.25,w:.22},wr:{x:.575,z:-.56,r:.37,w:.36},hip:[0,.47,-.3],torsoLen:.37,shoulder:[.26,.26,.02],armR:.07,upper:.25,fore:.25,hand:.072,steer:[0,.67,.13],steerTilt:.62,steerR:.15,exhaust:[.25,.335,-1.06],exhaustUp:.3,ear:[.285,.455,-.03],earTilt:.5,chainParent:$.chassis,chain:[0,.5,-.9],chainStep:[0,0,-.1],auxParent:$.chassis,aux:[0,.4,.58],aux1Parent:$.head,aux1:[0,.15,.08],smoke:[0,.85,.6]},{color:2082998,wf:{x:.625,z:.68,r:.29,w:.18},wr:{x:.63,z:-.58,r:.32,w:.21},hip:[0,.44,-.2],torsoLen:.35,shoulder:[.19,.25,.02],armR:.05,upper:.23,fore:.23,hand:.06,steer:[0,.63,.2],steerTilt:.6,steerR:.14,exhaust:[.33,.34,-1],exhaustUp:.06,ear:[.15,.49,-.02],earTilt:.28,chainParent:$.torso,chain:[.13,.36,-.13],chainStep:[0,0,-.21],auxParent:$.chassis,aux:[0,.5,0],aux1Parent:$.chassis,aux1:[0,.5,0],smoke:[0,.8,-.75]},{color:16765503,wf:{x:.6,z:.6,r:.27,w:.27},wr:{x:.6,z:-.62,r:.29,w:.29},hip:[0,.52,-.22],torsoLen:.33,shoulder:[.29,.22,.02],armR:.075,upper:.27,fore:.27,hand:.078,steer:[0,.69,.3],steerTilt:.72,steerR:.15,exhaust:[.2,.2,-1.03],exhaustUp:.1,ear:[.3,.3,0],earTilt:0,chainParent:$.chassis,chain:[0,.5,-.9],chainStep:[0,0,-.1],auxParent:$.head,aux:[.1,.19,.27],aux1Parent:$.head,aux1:[-.1,.19,.27],smoke:[0,.75,-.85]},{color:10192895,wf:{x:.6,z:.7,r:.26,w:.22},wr:{x:.6,z:-.58,r:.31,w:.28},hip:[0,.45,-.18],torsoLen:.34,shoulder:[.18,.25,.02],armR:.046,upper:.21,fore:.21,hand:.058,steer:[0,.63,.2],steerTilt:.6,steerR:.135,exhaust:[.22,.38,-1.04],exhaustUp:.1,ear:[.165,.5,-.02],earTilt:.34,chainParent:$.chassis,chain:[0,.62,-.6],chainStep:[0,.24,-.06],auxParent:$.chassis,aux:[.3,.648,-.86],aux1Parent:$.chassis,aux1:[-.3,.648,-.86],smoke:[0,.8,-.8]}],$m={OPEN:0,BLINK:1,DIZZY:2,STUN:3,HAPPY:4,SAD:5,FIERCE:6,WOW:7},eh=4,th=3,nh=192,rh=[{iris:`#8a4f22`,irisRim:`#4a2812`,rx:.4,ry:.4,lid:.16,lidSlope:.3,pupil:1,irisR:.25,lashes:0},{iris:`#35c46c`,irisRim:`#12733a`,rx:.43,ry:.37,lid:.12,lidSlope:.1,pupil:.9,irisR:.25,lashes:2},{iris:`#4a86d8`,irisRim:`#1f4a8c`,rx:.38,ry:.36,lid:.4,lidSlope:-.14,pupil:1,irisR:.24,lashes:0},{iris:`#c3f23c`,irisRim:`#5d9a10`,rx:.41,ry:.45,lid:.04,lidSlope:.06,pupil:.62,irisR:.3,lashes:3}];function ih(e,t,n,r,i,a,o,s,c,l){let u=i.rx*r,d=i.ry*r,f=r*.05,p=n-d+2*d*a,m=o*u*.55,h=u*1.5;e.save(),e.beginPath(),e.moveTo(t-h,p+m),e.lineTo(t+h,p-m),e.lineTo(t+h,n+d*2),e.lineTo(t-h,n+d*2),e.closePath(),e.clip(),e.beginPath(),e.ellipse(t,n,u,d,0,0,hm),e.fillStyle=`#ffffff`,e.fill(),e.save(),e.clip();let g=t-u*.1,_=n+d*.08+c*d,v=i.irisR*r*s;s>.3&&(e.beginPath(),e.arc(g,_,v,0,hm),e.fillStyle=i.iris,e.fill(),e.lineWidth=f*.7,e.strokeStyle=i.irisRim,e.stroke(),e.beginPath(),e.arc(g,_-v*.55,v,0,hm),e.fillStyle=`rgba(0,0,0,0.18)`,e.fill()),e.beginPath();let y=s>.3?v*.62:r*.045;if(e.ellipse(g,_,y*(s>.3?i.pupil:1),y,0,0,hm),e.fillStyle=Tm,e.fill(),s>.3&&(e.fillStyle=`#ffffff`,e.beginPath(),e.arc(g+v*.38,_-v*.42,v*(l?.4:.32),0,hm),e.fill(),e.beginPath(),e.arc(g-v*.4,_+v*.42,v*(l?.22:.15),0,hm),e.fill()),e.fillStyle=`rgba(70,60,110,0.22)`,e.beginPath(),e.moveTo(t-h,p+m),e.lineTo(t+h,p-m),e.lineTo(t+h,p-m+d*.28),e.lineTo(t-h,p+m+d*.28),e.closePath(),e.fill(),e.restore(),e.beginPath(),e.ellipse(t,n,u,d,0,0,hm),e.lineWidth=f,e.strokeStyle=Tm,e.stroke(),e.restore(),e.save(),e.beginPath(),e.ellipse(t,n,u+f*.5,d+f*.5,0,0,hm),e.clip(),e.strokeStyle=Tm,e.lineWidth=f*1.9,e.beginPath(),a>.06?(e.moveTo(t-h,p+m),e.lineTo(t+h,p-m)):e.ellipse(t,n,u,d,0,Math.PI*1.08,Math.PI*1.92),e.stroke(),e.restore(),i.lashes>0){e.strokeStyle=Tm,e.lineWidth=f*1.1,e.lineCap=`round`;for(let a=0;a<i.lashes;a++){let i=-.25-a*.33,o=t+Math.cos(i)*u,s=Math.max(n+Math.sin(i)*d,p-m*(o-t)/h);e.beginPath(),e.moveTo(o-r*.01,s),e.lineTo(o+r*.07,s-r*(.035+a*.022)),e.stroke()}}}function ah(e,t,n,r,i){let a=nh,o=t+a/2-(r.lashes>0?a*.035:0),s=n+a/2,c=r.rx*a,l=r.ry*a,u=a*.05;switch(e.save(),e.beginPath(),e.rect(t+3,n+3,186,186),e.clip(),e.lineCap=`round`,e.lineJoin=`round`,e.strokeStyle=Tm,i){case $m.BLINK:e.lineWidth=u*2,e.beginPath(),e.ellipse(o,s-l*.2,c*.9,l*.5,0,Math.PI*.1,Math.PI*.9),e.stroke(),e.lineWidth=u*1.1;for(let t=0;t<r.lashes;t++){let n=Math.PI*(.14+t*.1),r=o+Math.cos(n)*c*.9,i=s-l*.2+Math.sin(n)*l*.5;e.beginPath(),e.moveTo(r,i),e.lineTo(r+a*.05,i+a*.055),e.stroke()}break;case $m.HAPPY:e.lineWidth=u*2.2,e.beginPath(),e.ellipse(o,s+l*.4,c*.88,l*.8,0,Math.PI*1.1,Math.PI*1.9),e.stroke();break;case $m.DIZZY:e.beginPath(),e.ellipse(o,s,c,l,0,0,hm),e.fillStyle=`#ffffff`,e.fill(),e.lineWidth=u,e.stroke(),e.lineWidth=u*1.25,e.beginPath();for(let t=0;t<=80;t++){let n=t/80,r=n*2.4*hm,i=n*.74,a=o+Math.cos(r)*i*c,u=s+Math.sin(r)*i*l;t===0?e.moveTo(a,u):e.lineTo(a,u)}e.stroke();break;case $m.STUN:ih(e,o,s,a,r,0,0,.2,0,!1);break;case $m.SAD:ih(e,o,s,a,r,.44,-.42,.95,.22,!1);break;case $m.FIERCE:ih(e,o,s,a,r,Math.max(r.lid,.26)+.1,.42,.95,0,!1);break;case $m.WOW:ih(e,o,s,a,r,0,0,1.12,-.04,!0);break;default:ih(e,o,s,a,r,r.lid,r.lidSlope,1,0,!1)}e.restore()}function oh(e){if(typeof document>`u`)return null;let t=document.createElement(`canvas`);t.width=768,t.height=576;let n=t.getContext(`2d`);if(!n)return null;let r=rh[e];for(let e=0;e<8;e++)ah(n,e%eh*nh,Math.floor(e/eh)*nh,r,e);n.save(),n.translate(nh/2,nh*2.5),n.transform(1,0,-.14,1,0,0),n.font=`900 ${Math.round(nh*.74)}px "Arial Black", "Helvetica Neue", Impact, system-ui, sans-serif`,n.textAlign=`center`,n.textBaseline=`middle`,n.fillStyle=Tm,n.fillText(String(e+1),nh*.03,nh*.04),n.restore();let i=new hc(t);return i.colorSpace=ui,i.anisotropy=4,i}function sh(e,t,n,r,i,a,o,s,c){let l=[],u=[],d=[],f=Math.cos(o),p=Math.sin(o),m=1.02;for(let o=0;o<=s;o++)for(let d=0;d<=s;d++){let h=d/s,g=o/s,_=(h-.5)*2*i,v=(g-.5)*2*a,y=n+_*f-v*p,b=r+_*p+v*f;l.push(e[0]+t[0]*m*Math.sin(y)*Math.cos(b),e[1]+t[1]*m*Math.sin(b),e[2]+t[2]*m*Math.cos(y)*Math.cos(b)),u.push(c?1-h:h,g)}for(let e=0;e<s;e++)for(let t=0;t<s;t++){let n=e*(s+1)+t;d.push(n,n+1,n+s+1,n+1,n+s+2,n+s+1)}let h=new Ro;return h.setAttribute(`position`,new Y(l,3)),h.setAttribute(`uv`,new Y(u,2)),h.setIndex(d),h.computeVertexNormals(),h}function ch(e,t){let n=e.d.detail===0?2:4;e.eyeStart=e.d.vertexCount,e.d.put(sh(t.c,t.r,t.phi,t.psi,t.dphi,t.dpsi,t.tilt,n,!1),{bone:$.head}),e.d.put(sh(t.c,t.r,-t.phi,t.psi,t.dphi,t.dpsi,-t.tilt,n,!0),{bone:$.head})}function lh(e,t,n,r,i,a=!1){e.b.put(Pm(r,r,.016,e.b.s(12,8)),{bone:$.chassis,color:wm,pos:t,rot:n,outline:a?0:.55});let o=r*.86,s=Math.cos(i),c=Math.sin(i),l=1/eh,u=1/th,d=new Ro,f=(e,t)=>[e*s+t*c,.0135,-e*c+t*s];d.setAttribute(`position`,new Y([...f(-o,o),...f(o,o),...f(o,-o),...f(-o,-o)],3)),d.setAttribute(`uv`,new Y([0,0,l,0,l,u,0,u],2)),d.setIndex([0,1,2,0,2,3]),d.computeVertexNormals(),e.d.put(d,{bone:$.chassis,pos:t,rot:n})}function uh(e,t){let{b:n,sp:r}=e,i=n.s(12,8);n.put(Bm(r.wf.r,r.wf.w,i,t.wall,t.rim,t.rim2,t.hub),{bone:$.wFL,mirror:$.wFR,hull:Vm(r.wf.r,r.wf.w,i)}),n.put(Bm(r.wr.r,r.wr.w,i,t.wall,t.rim,t.rim2,t.hub),{bone:$.wRL,mirror:$.wRR,hull:Vm(r.wr.r,r.wr.w,i)})}function dh(e,t,n){e.b.put(Pm(n,n,t.x*2,5),{bone:$.chassis,color:xm,pos:[0,t.r,t.z],rot:[0,0,gm],outline:.6})}function fh(e,t,n){let{b:r,sp:i}=e,a=i.steerR;r.put(new xl(a,.02,4,r.s(10,8)),{bone:$.steer,color:t,outline:.6}),r.put(Nm(a*2,.03,.014),{bone:$.steer,color:n,outline:0}),r.fine&&(r.put(Nm(.03,a,.014),{bone:$.steer,color:n,pos:[0,a/2,0],outline:0}),r.put(Pm(.016,.016,.34,4),{bone:$.steer,color:xm,pos:[0,0,-.17],rot:[gm,0,0],outline:0}))}function ph(e,t){let{b:n,sp:r}=e,i=r.torsoLen,a=t.rx,o=[[0,-.14],[a*.85,-.12],[a,0],[a,i*.3],[a*.98,i*.55],[a*.88,i*.78],[a*.6,i*.95],[0,i+.02]],s=t.suit,c=km(o.map((e,t)=>[e[0],e[1],s[Math.min(t,s.length-1)]]),n.s(10,8));c.scale(1,1,t.rz/a),n.put(c,{bone:$.torso});let l=n.s(6,5),u=e=>(t,n)=>n<-1e-4||n>e+1e-4?0:1;n.put(Im(r.armR,r.upper,l,n.detail===0?1:2),{bone:$.armLU,color:t.sleeve,mirror:$.armRU,outline:.8,taper:u(r.upper)}),n.put(Im(r.armR*.88,r.fore,l,1),{bone:$.armLF,color:t.cuff,mirror:$.armRF,outline:.8,taper:u(r.fore)}),n.put(Mm(r.hand,r.hand*.9,r.hand,6,n.s(5,4)),{bone:$.handL,color:t.glove,pos:[0,r.hand*.3,0],mirror:$.handR,outline:.8})}function mh(e,t,n,r,i,a,o={}){let s=e.s(o.ws??14,8),c=e.s(5,3),l=[i,0,0];if(e.put(new bl(1,s,c,0,hm,0,r),{bone:$.head,color:a,pos:t,rot:l,scale:n}),o.rim!==void 0&&e.fine){let i=new xl(Math.sin(r),.055,3,s);i.rotateX(gm),i.translate(0,Math.cos(r),0),e.put(i,{bone:$.head,color:o.rim,pos:t,rot:l,scale:n,outline:0})}if(o.stripe!==void 0){let i=o.stripeHalf??.2,a=new bl(1.014,e.s(8,5),1,Math.PI-r,r*2,gm-i,i*2);a.rotateZ(gm),e.put(a,{bone:$.head,color:o.stripe,pos:t,rot:l,scale:n,outline:0})}if(o.gloss!==void 0&&e.fine){let r=new bl(1.016,3,2,gm+o.gloss-.3,.6,.42,.26);e.put(r,{bone:$.head,color:16777215,pos:t,rot:l,scale:n,outline:0})}}function hh(e,t,n,r,i,a){let o=e.s(6,5);if(e.put(Fm(t,n,o),{bone:$.earL,color:r,scale:[1,1,.5],mirror:$.earR,outline:.9}),e.fine&&e.put(Fm(t*.62,n*.66,4),{bone:$.earL,color:i,pos:[0,n*.04,t*.24],scale:[1,1,.3],mirror:$.earR,outline:0}),a!==null){let r=n*.4;e.put(Fm(t*r/n+.006,r+.006,o),{bone:$.earL,color:a,pos:[0,n-r,0],scale:[1,1,.56],mirror:$.earR,outline:0})}}function gh(e,t){let n=e.sp.exhaust;e.b.fine&&e.b.put(Mm(t,t,t*.35,6,3),{bone:$.chassis,color:1841440,pos:[n[0],n[1],n[2]+.004],rot:[-e.sp.exhaustUp,0,0],mirror:$.chassis,outline:0})}function _h(e,t,n){let r=e.b;r.put(Mm(n,n,n*.95,r.s(8,6),r.s(5,4)),{bone:$.chassis,color:Cm,pos:t,mirror:$.chassis,outline:.75}),r.fine&&r.put(Mm(n*.76,n*.76,n*.36,r.s(8,6),3),{bone:$.chassis,color:16774064,pos:[t[0],t[1],t[2]+n*.72],mirror:$.chassis,outline:0})}function vh(e){let{b:t,sp:n}=e,r=n.color,i=16773074,a=$.chassis,o=t.s4(16),s=(e,t,n,r,i=.4)=>Om(e,i,t,n,r,3.2,o,.07);t.put(Dm([s(-1,.31,.165,.175,.415),s(-.92,.365,.205,.215,.41),s(-.66,.385,.22,.24),s(-.3,.39,.22,.25),s(.08,.37,.21,.25),s(.3,.32,.18,.23)],{color:(e,t)=>t===o/4-1||t===o/4?i:r,capColor:13187893}),{bone:a}),t.put(Mm(.27,.035,.25,t.s(10,8),3),{bone:a,color:3811878,pos:[0,.612,-.27],outline:0}),t.put(t.soft(.5,.4,.12,.045,8),{bone:a,color:6963760,pos:[0,.77,-.6],rot:[-.2,0,0]});let c=t.s4(12);if(t.put(Dm([Om(.84,.42,.17,.2,.21,3,c),Om(.93,.42,.2,.235,.23,3,c),Om(.975,.42,.185,.22,.215,3,c)]),{bone:a,color:r}),t.put(Dm([Om(.97,.42,.14,.17,.165,3,c),Om(.99,.42,.125,.155,.15,3,c)],{capA:!1}),{bone:a,color:3882829,outline:0}),t.fine)for(let e=-1;e<=1;e++)t.put(Nm(.022,.3,.012),{bone:a,color:Cm,pos:[e*.065,.42,.992],outline:0});_h(e,[.295,.5,.9],.08),t.put(Nm(.06,.07,.72),{bone:a,color:xm,pos:[.19,.25,.62],mirror:a,outline:.6}),dh(e,n.wf,.03);let l=$.aux0;t.put(Nm(.3,.22,.44),{bone:l,color:Sm}),t.put(Nm(.11,.08,.4),{bone:l,color:Cm,pos:[.125,.13,0],rot:[0,0,-.6],mirror:l,outline:.7}),t.put(Nm(.2,.12,.3),{bone:l,color:Cm,pos:[0,.2,0],outline:.7});let u=(e,t,n)=>({z:e,p:[t,0,t,n*.7,t*.7,n,-t*.7,n,-t,n*.7,-t,0]});if(t.put(Dm([u(-.16,.06,.04),u(-.02,.095,.1),u(.15,.105,.12)],{flat:!0,color:(e,t)=>t===2?i:r,capColor:2367270}),{bone:l,pos:[0,.255,0]}),t.fine)for(let e=-1;e<=1;e++)t.put(Nm(.016,.085,.012),{bone:l,color:Cm,pos:[e*.05,.31,.152],outline:0});for(let e=0;e<3;e++)t.put(Nm(.055,.24,.055),{bone:l,color:Cm,pos:[.24,.02,-.17+e*.13],aim:[.75,-.4,-.55],mirror:l,outline:.6});t.put(Am([[.25,.3,-.8],[.25,.315,-.96],[n.exhaust[0],n.exhaust[1],n.exhaust[2]]],e=>.058+.03*e*e,t.s(8,6)),{bone:a,color:Cm,mirror:a}),gh(e,.07),lh(e,[0,.455,-1.01],[-(gm-.1),0,0],.115,Math.PI),uh(e,{wall:Rm,rim:Cm,rim2:12042962,hub:r}),fh(e,2827568,Cm),ph(e,{rx:.275,rz:.2,suit:[3360110],sleeve:3360110,cuff:10183224,glove:7620394});let d=$.head,f=10183224,p=15978396,m=[0,.3,0],h=[.33,.29,.3];t.put(Mm(h[0],h[1],h[2],t.s(14,8),t.s(9,6)),{bone:d,color:f,pos:m}),t.put(Mm(.165,.11,.13,t.s(8,6),t.s(6,4)),{bone:d,color:p,pos:[0,.225,.26],outline:.7}),t.put(Mm(.068,.048,.045,6,4),{bone:d,color:2825504,pos:[0,.285,.38],outline:0}),t.fine&&t.put(Mm(.14,.03,.11,6,3),{bone:d,color:3806232,pos:[0,.165,.25],outline:0});let g=$.aux1,_=t.s4(8);t.put(Dm([Om(-.02,-.035,.15,.05,.06,3,_),Om(.1,-.03,.185,.055,.075,3.4,_),Om(.25,-.02,.17,.05,.07,3.4,_),Om(.325,-.015,.11,.035,.05,3,_)],{capA:!1}),{bone:g,color:7620394,outline:.8}),t.put(Fm(.03,.075,4),{bone:g,color:wm,pos:[.095,.015,.265],mirror:g,outline:.4}),t.put(Mm(.115,.115,.055,t.s(8,6),t.s(5,4)),{bone:$.earL,color:f,pos:[0,.07,0],mirror:$.earR,outline:.9}),t.fine&&t.put(Mm(.068,.068,.03,6,3),{bone:$.earL,color:p,pos:[0,.07,.04],mirror:$.earR,outline:0}),t.put(Nm(.15,.042,.035),{bone:d,color:im,pos:[.135,.463,.24],rot:[-.35,.42,.33],mirror:d,outline:0}),mh(t,m,[.352,.312,.322],1.02,-.3,r,{stripe:i,stripeHalf:.17,rim:2827568}),t.fine&&t.put(Nm(.03,.2,.012),{bone:d,color:2827568,pos:[.305,.25,.085],rot:[.25,0,-.16],mirror:d,outline:0}),ch(e,{c:m,r:h,phi:.41,psi:.14,dphi:.27,dpsi:.3,tilt:0})}function yh(e){let{b:t,sp:n}=e,r=n.color,i=1283722,a=$.chassis,o=t.s4(16),s=(e,t,n,r,i)=>Om(e,t,n,r,i,2.3,o,.055),c=[s(-1.03,.47,.055,.05,.05),s(-.9,.46,.14,.13,.11),s(-.63,.44,.255,.27,.19),s(-.45,.42,.29,.24,.21),s(-.3,.41,.3,.19,.21),s(.1,.4,.29,.19,.2),s(.45,.385,.225,.155,.16),s(.78,.365,.135,.1,.1),s(.97,.355,.06,.05,.05),s(1.05,.352,.024,.02,.02)];t.put(Dm(c,{color:(e,t)=>e>=7||t===o/4-1||t===o/4?wm:r}),{bone:a}),t.put(Mm(.215,.03,.2,t.s(10,8),3),{bone:a,color:3024432,pos:[0,.598,-.2],outline:0}),t.put(t.soft(.34,.2,.08,.03,8),{bone:a,color:6963760,pos:[0,.71,-.46],rot:[-.25,0,0],outline:.8});let l=[];for(let e=0;e<=5;e++)l.push(Math.cos(e/5*Math.PI)*.19,Math.sin(e/5*Math.PI)*.13);t.fine&&t.put(jm(l,.02),{bone:a,color:13037567,pos:[0,.585,.13],rot:[-.5,0,0],outline:.6}),t.put(jm([-.46,.6,-1.02,.5,-1.04,.97,-.83,.97],.05),{bone:a,color:i,rot:[0,-gm,0]}),t.put(jm([-.83,.97,-1.04,.97,-1.045,1.07,-.885,1.07],.05),{bone:a,color:wm,rot:[0,-gm,0]}),lh(e,[.024,.8,-.88],[0,0,-gm],.115,gm,!0),lh(e,[-.024,.8,-.88],[0,0,gm],.115,-gm,!0),t.fine&&lh(e,[0,.527,.5],[.13,0,0],.105,0),lh(e,[-.135,.612,-.74],[-.42,0,.6],.088,Math.PI),dh(e,n.wf,.028),dh(e,n.wr,.028),t.put(Am([[.2,.33,.34],[.32,.335,-.2],[n.exhaust[0],n.exhaust[1],n.exhaust[2]]],e=>.034+.034*Math.max(0,(e-.65)/.35),t.s(6,5),3),{bone:a,color:Cm,mirror:a,outline:.8}),gh(e,.052),uh(e,{wall:Rm,rim:wm,rim2:r,hub:i}),fh(e,4862762,Cm),ph(e,{rx:.2,rz:.15,suit:[9066034],sleeve:9066034,cuff:9066034,glove:16048052});let u=16774884,d=new xl(.115,.052,4,t.s(9,8));d.rotateX(gm),t.put(d,{bone:$.torso,color:u,pos:[0,n.torsoLen-.005,.01],scale:[1.1,1,1]});let f=.84,p=[],m=t.fine?8:4;for(let e=m;e>=0;e--){let t=.06+.03*Math.sin(e/m*Math.PI)+(e===m?.012:0);p.push({z:-e/m*f,p:[t,-.016,t,.016,-t,.016,-t,-.016]})}let h=n.hip[2]+n.chain[2];t.put(Dm(p,{flat:!0,color:e=>e===0||t.fine&&e===2?r:u}),{bone:$.c0,outline:.8,skin:(e,t,n,r)=>{let i=_m((h-n)/f*4,0,3.999),a=Math.floor(i),o=i-a,s=o<.5?Math.max(a-1,0):Math.min(a+1,3),c=a===s?0:o<.5?.5-o:o-.5;r[0]=$.c0+a,r[1]=1-c,r[2]=$.c0+s,r[3]=c}});let g=$.head,_=16089642,v=16774112,y=[0,.28,0],b=[.29,.265,.28];t.put(Mm(b[0],b[1],b[2],t.s(14,8),t.s(9,6)),{bone:g,color:_,pos:y}),t.put(Mm(.255,.15,.235,t.s(9,8),t.s(5,4)),{bone:g,color:v,pos:[0,.165,.045],outline:.8}),t.put(Fm(.085,.21,t.s(6,5)),{bone:g,color:v,pos:[.2,.15,.03],aim:[1,-.3,-.2],scale:[1,1,.55],mirror:g,outline:.8});let x=t.s4(8),S=(e,t,n,r,i)=>Om(e,i,t,n,r,2,x);t.put(Dm([S(.14,.13,.095,.085,.215),S(.3,.095,.07,.06,.205),S(.42,.055,.042,.04,.2),S(.47,.03,.024,.024,.2)],{color:(e,t)=>t<x/2?_:v,capA:!1}),{bone:g,outline:.7}),t.put(Mm(.042,.036,.036,6,4),{bone:g,color:2825504,pos:[0,.213,.475],outline:0}),hh(t,.105,.3,_,v,3876900),t.put(Nm(.1,.02,.026),{bone:g,color:im,pos:[.125,.425,.228],rot:[-.4,.45,-.22],mirror:g,outline:0}),mh(t,y,[.306,.281,.296],1.15,-.38,r,{rim:i,gloss:2.4}),t.put(Mm(.055,.13,.1,6,4),{bone:g,color:r,pos:[.272,.21,-.03],mirror:g,outline:.8});let C=new xl(.247,.016,3,t.s(12,8));t.fine&&t.put(C,{bone:g,color:4862762,pos:[0,.4265,-.0525],rot:[-1.876,0,0],scale:[1.075,1,1],outline:0});let w=[.082,.508,.174],T=[.66,.38,0];t.put(Pm(.066,.074,.05,t.s(8,5)),{bone:g,color:v,pos:w,rot:T,order:`YXZ`,mirror:g,outline:.55}),t.put(Pm(.048,.048,.058,t.s(8,5)),{bone:g,color:2837107,pos:w,rot:T,order:`YXZ`,mirror:g,outline:0}),t.fine&&t.put(Mm(.018,.006,.012,4,2),{bone:g,color:wm,pos:[.1,.546,.19],rot:T,order:`YXZ`,mirror:g,outline:0}),ch(e,{c:y,r:b,phi:.43,psi:.17,dphi:.26,dpsi:.27,tilt:.2})}function bh(e){let{b:t,sp:n}=e,r=n.color,i=14722076,a=16774882,o=5917266,s=$.chassis,c=2.7,l=t.s4(20),u=-.02,d=(e,t,n,r)=>Om(e,.02,t,n,r,c,l),f=Dm([d(.16,.36,.68,.7),d(.23,.455,.83,.85),d(.38,.5,.9,.925),d(.53,.49,.9,.92),d(.585,.515,.93,.95),d(.635,.49,.905,.925),d(.6,.45,.865,.885),d(.5,.425,.84,.86)],{color:e=>e===0?i:e<3?r:e<6?a:o,capColor:o});t.put(f,{bone:s,rot:[-gm,0,0]}),t.put(t.soft(.56,.3,.1,.04,8),{bone:s,color:8018504,pos:[0,.66,-.56],rot:[-.22,0,0],outline:.8});for(let e of[1,-1]){let n=[],r=e>0?.925:.9;for(let t=-2;t<=2;t++){let i=t/2*.95,a=Math.sign(Math.sin(i))*Math.abs(Math.sin(i))**(2/c)*.58,o=Math.cos(i)**(2/c)*(r+.08);n.push([a,.3,u+e*o])}e<0&&n.reverse(),t.put(Am(n,.062,t.s(6,5),4),{bone:s,color:Cm}),t.put(Nm(.09,.19,.08),{bone:s,color:xm,pos:[.2,.3,u+e*(r+.085)],mirror:s,outline:.7})}_h(e,[.25,.7,.74],.09),t.fine&&t.put(Mm(.05,.05,.035,6,3),{bone:s,color:16742972,pos:[.3,.57,-.84],mirror:s,outline:.6}),t.put(Pm(.055,.048,.2,6),{bone:s,color:Cm,pos:[n.exhaust[0],n.exhaust[1],n.exhaust[2]+.1],rot:[gm-n.exhaustUp,0,0],mirror:s,outline:.8}),gh(e,.046),dh(e,n.wf,.035),dh(e,n.wr,.035),lh(e,[0,.455,-.927],[-(gm-.06),0,0],.12,Math.PI),lh(e,[0,.455,.912],[gm-.06,0,0],.12,0),uh(e,{wall:a,rim:r,rim2:i,hub:Cm}),fh(e,4862762,Cm);let p=3031922;ph(e,{rx:.31,rz:.24,suit:[p,p,wm,p,wm,p,wm],sleeve:9413570,cuff:9413570,glove:7571883});let m=$.head,h=[0,.29,0],g=[.35,.3,.31];t.put(Mm(g[0],g[1],g[2],t.s(14,8),t.s(9,6)),{bone:m,color:9413570,pos:h}),t.put(Mm(.28,.085,.15,t.s(8,6),4),{bone:m,color:7571883,pos:[0,.07,-.19],outline:.8}),t.put(Am([[.09,.14,.3],[.1,.01,.355],[.115,-.13,.375]],e=>.046-.03*e,t.s(6,5)),{bone:m,color:16776166,mirror:m,outline:.7}),t.put(Mm(.16,.12,.12,t.s(7,6),t.s(5,4)),{bone:$.aux0,color:a,pos:[.035,-.035,.035],rot:[0,.25,-.3],mirror:$.aux1,outline:.8}),t.put(Mm(.075,.05,.045,6,4),{bone:m,color:2825504,pos:[0,.262,.385],outline:0}),t.put(Mm(.075,.03,.035,6,3),{bone:m,color:a,pos:[.135,.468,.243],rot:[-.3,.4,-.3],mirror:m,outline:.45}),mh(t,h,[.372,.322,.332],.92,-.25,r,{stripe:wm,stripeHalf:.16,rim:i}),t.put(Mm(.215,.034,.17,t.s(8,6),4),{bone:m,color:i,pos:[0,.5,.295],rot:[.3,0,0],outline:.8}),ch(e,{c:h,r:g,phi:.33,psi:.27,dphi:.22,dpsi:.23,tilt:-.05})}var xh=[-.04,.5,.24,.5,.07,.08,.26,.08,-.16,-.5,-.03,-.04,-.22,-.04];function Sh(e){let{b:t,sp:n}=e,r=n.color,i=6968788,a=16774282,o=$.chassis,s=(e,t,n,r,i,a)=>({z:e,p:[t,r+i,t,n-i,t-i,n,a,n,-a,n,-t+i,n,-t,n-i,-t,r+i,-t+i,r,t-i,r]});t.put(Dm([s(-1.03,.39,.6,.27,.05,.1),s(-.95,.43,.66,.2,.06,.1),s(-.45,.43,.63,.16,.07,.1),s(-.05,.41,.57,.15,.07,.1),s(.55,.34,.41,.15,.06,.09),s(.95,.24,.275,.16,.04,.07),s(1.05,.18,.225,.17,.02,.05)],{flat:!0,color:(e,t)=>t===3?i:t===1||t===5?11773183:r,capColor:i}),{bone:o}),t.put(Nm(.6,.035,.22),{bone:o,color:xm,pos:[0,.145,.97],outline:.7}),t.put(Nm(.1,.16,.5),{bone:o,color:i,pos:[.43,.3,-.02],rot:[0,.06,0],mirror:o,outline:.8}),t.put(Mm(.24,.03,.22,t.s(10,8),3),{bone:o,color:2761792,pos:[0,.604,-.2],outline:0}),t.put(Nm(.36,.24,.09),{bone:o,color:3878758,pos:[0,.74,-.46],rot:[-.2,0,0],outline:.8}),t.put(jm(xh,.016),{bone:o,color:a,pos:[0,.502,.24],rot:[-(gm-.262),0,0],scale:[.5,.62,1],outline:0}),t.put(Nm(.17,.12,.1),{bone:o,color:Cm,pos:[n.exhaust[0],n.exhaust[1],n.exhaust[2]+.045],mirror:o,outline:.7}),t.fine&&t.put(Nm(.12,.075,.02),{bone:o,color:1841440,pos:[n.exhaust[0],n.exhaust[1],n.exhaust[2]-.008],mirror:o,outline:0}),dh(e,n.wf,.03),lh(e,[0,.666,-.875],[-.05,0,0],.125,Math.PI),lh(e,[0,.3,.985],[.86,0,0],.085,0);let c=[[0,0,Sm],[.068,0,Sm,!0],[.068,.07,wm,!0],[.042,.08,wm],[.056,.14,wm],[.042,.17,wm],[.034,.35,Sm,!0],[.02,.36,Sm],[.02,.44,Sm],[0,.45]];t.put(km(c,6),{bone:$.aux0,mirror:$.aux1,outline:.7}),t.put(Mm(.04,.04,.04,6,4),{bone:$.aux0,color:a,pos:[0,.475,0],mirror:$.aux1,outline:.55}),uh(e,{wall:Rm,rim:i,rim2:a,hub:wm}),fh(e,2761792,a),ph(e,{rx:.19,rz:.145,suit:[3878758],sleeve:3878758,cuff:3878758,glove:wm});let l=16447231,u=[0,0,.1,0,.16,.23,.035,.25,.15,.5,.007,.51,.11,.84,-.108,.46,.027,.445,-.1,.2,.032,.195],d=n.chain[1];t.put(jm(u,.07),{bone:$.c0,color:l,pos:[-.05,-.04,0],rot:[-.18,.75,0],order:`YXZ`,skin:(e,t,n,r)=>{let i=_m((t-d)/.24,0,2.999),a=Math.floor(i),o=i-a,s=o<.5?Math.max(a-1,0):Math.min(a+1,2),c=a===s?0:o<.5?.5-o:o-.5;r[0]=$.c0+a,r[1]=1-c,r[2]=$.c0+s,r[3]=c}});let f=$.head,p=16752324,m=[0,.28,0],h=[.31,.27,.28];if(t.put(Mm(h[0],h[1],h[2],t.s(14,8),t.s(9,6)),{bone:f,color:l,pos:m}),t.put(Fm(.075,.16,t.s(6,5)),{bone:f,color:l,pos:[.24,.17,.05],aim:[1,-.22,-.1],scale:[1,1,.55],mirror:f,outline:.8}),t.put(Mm(.062,.05,.05,6,4),{bone:f,color:wm,pos:[.047,.165,.262],mirror:f,outline:.5}),t.put(Mm(.028,.02,.02,5,3),{bone:f,color:p,pos:[0,.2,.305],outline:0}),t.fine&&t.put(Mm(.035,.022,.02,5,3),{bone:f,color:8009040,pos:[0,.133,.262],outline:0}),t.fine)for(let e of[.025,-.02])t.put(Nm(.17,.009,.009),{bone:f,color:im,pos:[.19,.165+e,.245],rot:[0,.5,e*9],mirror:f,outline:0});hh(t,.1,.24,l,p,null),mh(t,m,[.333,.292,.302],1.12,-.32,r,{rim:i,gloss:2.4}),t.put(jm(xh,.014),{bone:f,color:a,pos:[0,.37,-.287],rot:[.3,Math.PI,0],scale:[.4,.3,1],outline:0}),ch(e,{c:m,r:h,phi:.4,psi:.1,dphi:.3,dpsi:.36,tilt:.06})}var Ch=[vh,yh,bh,Sh];function wh(e,t){let n=new xl(1.2,.058,4,e.s(22,12));n.rotateX(gm),e.put(n,{bone:$.guard,color:Cm});for(let n=0;n<3;n++){let r=n/3*hm,i=[Math.sin(r)*1.2,0,Math.cos(r)*1.2];e.put(Mm(.24,.115,.1,6,4),{bone:$.guard,color:t,pos:i,rot:[0,r,0],hull:Nm(.36,.17,.14)}),e.fine&&e.put(Nm(.26,.045,.02),{bone:$.guard,color:wm,pos:[Math.sin(r)*1.292,0,Math.cos(r)*1.292],rot:[0,r,0],outline:0})}e.put(jm(xh,.035),{bone:$.bolt0,color:16773226,scale:.5,outline:.6}),e.put(jm(xh,.035),{bone:$.bolt1,color:16773226,scale:.42,outline:.6});for(let t of[$.puff0,$.puff1]){let n=t===$.puff1;e.put(Mm(.15,.13,.14,6,4),{bone:t,color:n?9406616:11907007,outline:.6}),e.put(Mm(.115,.1,.11,6,4),{bone:t,color:n?10393512:13025742,pos:[.13,.05,.02],outline:.6}),e.fine&&e.put(Mm(.1,.09,.1,5,3),{bone:t,color:n?9406616:11907007,pos:[-.12,.06,-.03],outline:.6})}}function Th(e){let t=[[0,0,16747036],[.1,.1,16738836],[.085,.3,15874060],[.04,.55,12065800],[0,.78]],n=[[0,.01,16773296],[.055,.1,16765024],[.04,.26,16751144],[0,.44]];for(let r of[$.flameL,$.flameR]){let i=km(t,e.s(8,6));i.rotateX(gm),e.put(i,{bone:r});let a=km(n,e.s(6,5));a.rotateX(gm),e.put(a,{bone:r})}}var Eh=new G,Dh=new G,Oh=new G,kh=new G,Ah=new G,jh=new G,Mh=class{constructor(e,t=2){T(this,`root`,new Fa),T(this,`anchors`,{wheelRearL:new G,wheelRearR:new G,wheelFrontL:new G,wheelFrontR:new G,exhaustL:new G,exhaustR:new G,head:new G}),T(this,`slot`,void 0),T(this,`spec`,void 0),T(this,`detail`,void 0),T(this,`bones`,[]),T(this,`rest`,[]),T(this,`restPos`,new Float32Array(93)),T(this,`restRot`,new Float32Array(93)),T(this,`skeleton`,void 0),T(this,`toon`,void 0),T(this,`flameMat`,void 0),T(this,`decalMat`,void 0),T(this,`atlas`,void 0),T(this,`body`,void 0),T(this,`fx`,void 0),T(this,`flames`,void 0),T(this,`decals`,void 0),T(this,`bodyOutline`,null),T(this,`fxOutline`,null),T(this,`geos`,[]),T(this,`eyeUv`,new Float32Array),T(this,`eyeStart`,0),T(this,`eyeState`,-1),T(this,`time`,0),T(this,`seed`,void 0),T(this,`lastSpeed`,0),T(this,`accel`,0),T(this,`wheelF`,0),T(this,`wheelR`,0),T(this,`driftS`,0),T(this,`roll`,0),T(this,`rollV`,0),T(this,`pitch`,0),T(this,`pitchV`,0),T(this,`lean`,0),T(this,`headX`,0),T(this,`headXV`,0),T(this,`headZ`,0),T(this,`headZV`,0),T(this,`headY`,0),T(this,`boostS`,0),T(this,`airS`,0),T(this,`winS`,0),T(this,`loseS`,0),T(this,`stallS`,0),T(this,`spinS`,0),T(this,`offS`,0),T(this,`armsUp`,0),T(this,`flameS`,0),T(this,`sq`,0),T(this,`sqV`,0),T(this,`guardS`,0),T(this,`guardV`,0),T(this,`blinkT`,2),T(this,`swayX`,0),T(this,`swayXV`,0),T(this,`swayZ`,0),T(this,`swayZV`,0),T(this,`flopX`,0),T(this,`flopXV`,0),T(this,`flopZ`,0),T(this,`flopZV`,0),T(this,`aCd`,1),T(this,`aSd`,0),T(this,`aCs`,1),T(this,`aSs`,0),T(this,`fDt`,0),T(this,`fSpeed`,0),T(this,`fSteer`,0),T(this,`fStage`,0),T(this,`fSpin`,0),T(this,`fV`,0),T(this,`fV1`,0),T(this,`fWind`,0),T(this,`fSpinYaw`,0),T(this,`fDriftYaw`,0),T(this,`fHop`,0),T(this,`fIdle`,1),T(this,`fCough`,0),this.slot=(Math.floor(e)%4+4)%4,this.spec=Qm[this.slot],this.detail=t,this.seed=(this.slot+1)*7919,this.root.name=`kart-${this.slot}`,this.makeBones(),this.skeleton=new Gs(this.bones),this.toon=sm({vertexColors:!0}),this.flameMat=new gs({vertexColors:!0,transparent:!0,blending:2,depthWrite:!1,fog:!1}),this.atlas=oh(this.slot),this.decalMat=new gs({map:this.atlas,alphaTest:.5});let n=new Ro,r=new q,i=(e,t)=>{let i=new Bs(n,e);return i.name=t,i.matrixAutoUpdate=!1,i.boundingSphere=Zm.clone(),i.bind(this.skeleton,r),this.root.add(i),i};this.body=i(this.toon,`kart`),this.decals=i(this.decalMat,`decals`),this.fx=i(this.toon,`fx`),this.flames=i(this.flameMat,`flames`),this.fx.visible=!1,this.flames.visible=!1,this.flames.renderOrder=2,n.dispose(),this.rebuild(),this.placeAnchors()}squash(e){e===e&&(this.sq=_m(e,-1,1),this.sqV=0)}setDetail(e){e!==this.detail&&(this.detail=e,this.rebuild())}dispose(){for(let e of this.geos)e.dispose();this.geos.length=0,this.toon.dispose(),this.flameMat.dispose(),this.decalMat.dispose(),this.atlas?.dispose(),this.skeleton.dispose(),this.root.removeFromParent()}makeBones(){let e=this.spec;for(let e=0;e<bm;e++)this.bones.push(new Vs);let t=(e,t,n,r)=>{let i=this.bones[e];i.position.set(n[0],n[1],n[2]),r&&i.rotation.set(r[0],r[1],r[2]),t<0?this.root.add(i):this.bones[t].add(i)},n=e.shoulder[0],r=e.hip[1]+e.shoulder[1],i=e.hip[2]+e.shoulder[2];t($.spin,-1,[0,0,0]),t($.drift,$.spin,[0,0,0]),t($.chassis,$.drift,[0,0,0]),t($.wFL,$.drift,[e.wf.x,e.wf.r,e.wf.z]),t($.wFR,$.drift,[-e.wf.x,e.wf.r,e.wf.z]),t($.wRL,$.drift,[e.wr.x,e.wr.r,e.wr.z]),t($.wRR,$.drift,[-e.wr.x,e.wr.r,e.wr.z]),t($.steer,$.chassis,e.steer,[Math.PI+e.steerTilt,0,0]),t($.torso,$.chassis,e.hip),t($.head,$.torso,[0,e.torsoLen,.015]),t($.earL,$.head,e.ear,[0,0,-e.earTilt]),t($.earR,$.head,[-e.ear[0],e.ear[1],e.ear[2]],[0,0,e.earTilt]),t($.armLU,$.chassis,[n,r,i]),t($.armLF,$.chassis,[n,r+e.upper,i]),t($.handL,$.chassis,[n,r+e.upper+e.fore,i]),t($.armRU,$.chassis,[-n,r,i]),t($.armRF,$.chassis,[-n,r+e.upper,i]),t($.handR,$.chassis,[-n,r+e.upper+e.fore,i]),t($.c0,e.chainParent,e.chain),t($.c1,$.c0,e.chainStep),t($.c2,$.c1,e.chainStep),t($.c3,$.c2,e.chainStep),t($.aux0,e.auxParent,e.aux),t($.aux1,e.aux1Parent,e.aux1);let a=e.exhaust;t($.flameL,$.chassis,a,[Math.PI+e.exhaustUp,0,0]),t($.flameR,$.chassis,[-a[0],a[1],a[2]],[Math.PI+e.exhaustUp,0,0]),t($.guard,$.spin,[0,.42,0]),t($.bolt0,$.spin,[.6,.8,0]),t($.bolt1,$.spin,[-.6,.8,0]),t($.puff0,$.spin,e.smoke),t($.puff1,$.spin,e.smoke),this.bones[$.wFL].rotation.order=`YXZ`,this.bones[$.wFR].rotation.order=`YXZ`,this.root.updateMatrixWorld(!0);for(let e=0;e<bm;e++){let t=this.bones[e];this.rest.push(t.matrixWorld.clone()),this.restPos[e*3]=t.position.x,this.restPos[e*3+1]=t.position.y,this.restPos[e*3+2]=t.position.z,this.restRot[e*3]=t.rotation.x,this.restRot[e*3+1]=t.rotation.y,this.restRot[e*3+2]=t.rotation.z}}rebuild(){for(let e of this.geos)e.dispose();this.geos.length=0;let e=this.detail>0,t=new Ym(this.rest,this.detail,e),n=new Ym(this.rest,this.detail,!1,!0),r={b:t,d:n,sp:this.spec,eyeStart:0};Ch[this.slot](r);let i=new Ym(this.rest,this.detail,e);wh(i,this.spec.color);let a=new Ym(this.rest,this.detail,!1);Th(a);let o=t.finish(),s=i.finish(),c=n.finish().main,l=a.finish().main;this.geos.push(o.main,s.main,c,l),this.body.geometry=o.main,this.fx.geometry=s.main,this.decals.geometry=c,this.flames.geometry=l,this.decals.visible=this.atlas!==null,this.bodyOutline=this.swapOutline(this.body,this.bodyOutline,o.outline),this.fxOutline=this.swapOutline(this.fx,this.fxOutline,s.outline);let u=this.detail===0?2:4,d=(u+1)*(u+1)*2,f=c.getAttribute(`uv`);this.eyeStart=r.eyeStart,this.eyeUv=new Float32Array(d*2);for(let e=0;e<d;e++)this.eyeUv[e*2]=f.getX(this.eyeStart+e),this.eyeUv[e*2+1]=f.getY(this.eyeStart+e);let p=this.eyeState<0?$m.OPEN:this.eyeState;this.eyeState=-1,this.setEyes(p)}swapOutline(e,t,n){if(!n)return t&&e.remove(t),null;if(this.geos.push(n),t)return t.geometry=n,t.parent!==e&&e.add(t),t;let r=pm(e,n);return r.boundingSphere=Zm.clone(),r}setEyes(e){if(e===this.eyeState)return;this.eyeState=e;let t=this.decals.geometry.getAttribute(`uv`);if(!t)return;let n=t.array,r=e%eh,i=Math.floor(e/eh),a=this.eyeUv,o=this.eyeStart*2;for(let e=0;e<a.length;e+=2)n[o+e]=(r+a[e])/eh,n[o+e+1]=1-(i+1-a[e+1])/th;t.needsUpdate=!0}update(e,t){let n=e>0?Math.min(e,.05):0;this.fDt=n,this.time+=n;let r=t.speed===t.speed?t.speed:0,i=_m(t.steer===t.steer?t.steer:0,-1,1),a=t.driftDir>0?1:t.driftDir<0?-1:0,o=_m(t.spin===t.spin?t.spin:0,0,1),s=Math.min(Math.abs(r)/26,1.35),c=Math.min(s,1);this.fSpeed=r,this.fSteer=i,this.fStage=_m(t.driftStage===t.driftStage?t.driftStage:0,0,3),this.fSpin=o,this.fV=s,this.fV1=c,this.fWind=c*c*(3-2*c),n>0&&(this.accel=vm(this.accel,_m((r-this.lastSpeed)/n,-45,45),7,n)),this.lastSpeed=r,this.boostS=vm(this.boostS,+!!t.boost,9,n),this.airS=vm(this.airS,+!!t.air,10,n),this.winS=vm(this.winS,+(t.emote===`win`),8,n),this.loseS=vm(this.loseS,+(t.emote===`lose`),5,n),this.stallS=vm(this.stallS,+!!t.stall,10,n),this.spinS=vm(this.spinS,+(o>0),12,n),this.offS=vm(this.offS,+!!t.offroad,8,n),this.driftS=vm(this.driftS,a,9,n),this.armsUp=vm(this.armsUp,t.air||t.emote===`win`?1:t.stall?.5:0,10,n),this.flameS=vm(this.flameS,+!!t.boost,t.boost?18:11,n),this.lean=vm(this.lean,i*.2*(.3+.7*c)+this.driftS*.22,8,n);let l=-(i*c+this.driftS*.5),u=_m(-this.accel*.02,-.5,.5);this.swayXV+=((l-this.swayX)*150-this.swayXV*9)*n,this.swayX+=this.swayXV*n,this.swayZV+=((u-this.swayZ)*150-this.swayZV*9)*n,this.swayZ+=this.swayZV*n,this.flopXV+=((l-this.flopX)*46-this.flopXV*4.5)*n,this.flopX+=this.flopXV*n,this.flopZV+=((u-this.flopZ)*46-this.flopZV*4.5)*n,this.flopZ+=this.flopZV*n,this.moveWheels(),this.moveBody(),this.moveDriver(),this.moveExtras(),this.moveEffects(t.guard),this.pickEyes(t),this.placeAnchors()}moveWheels(){let e=this.spec,t=this.bones,n=this.restPos,r=this.time,i=this.fDt;this.wheelF+=this.fSpeed*i/e.wf.r,this.wheelR+=this.fSpeed*i/e.wr.r,Math.abs(this.wheelF)>6e3&&(this.wheelF%=hm),Math.abs(this.wheelR)>6e3&&(this.wheelR%=hm);let a=-this.fSteer*.5+this.driftS*.26,o=1+Math.max(this.sq,0)*.3,s=this.airS*.035,c=this.offS*this.fV1;for(let e=0;e<4;e++){let i=t[$.wFL+e],l=e<2;i.rotation.set(l?this.wheelF:this.wheelR,l?a:0,c*.06*Math.sin(r*43+e*1.9)),i.position.y=n[($.wFL+e)*3+1]-s+c*.018*Math.abs(Math.sin(r*31+e*2.3)),i.scale.x=o}}moveBody(){let e=this.bones,t=this.time,n=this.fDt,{boostS:r,airS:i,winS:a,stallS:o,driftS:s}=this,c=this.fV1,l=this.fSpin,u=1-l,d=l>0?hm*2*(1-u*u*u):0;this.fSpinYaw=d,e[$.spin].rotation.y=d;let f=-s*(.31+.04*this.fStage);this.fDriftYaw=f;let p=e[$.drift];p.rotation.y=f,p.position.set(-.3*Math.sin(f),0,Xm-Xm*Math.cos(f));let m=t*8.5,h=a*Math.max(0,Math.sin(m)),g=(1-.7*c)*(1-o),_=this.offS*c,v=o*Math.max(0,Math.sin(t*13))**8;this.fHop=h,this.fIdle=g,this.fCough=v;let y=-this.fSteer*c*.075-s*.11+(l>0?Math.sin(d)*.1:0),b=_m(-this.accel*.0035,-.08,.09)-r*.07+i*.05+o*.03;this.rollV+=((y-this.roll)*140-this.rollV*13)*n,this.roll+=this.rollV*n,this.pitchV+=((b-this.pitch)*140-this.pitchV*13)*n,this.pitch+=this.pitchV*n,this.sqV+=(-this.sq*190-this.sqV*8.5)*n,this.sq+=this.sqV*n;let x=_m(this.sq+a*.1*Math.cos(m),-1,1),S=x>0?1-.36*x:1-.28*x,C=1/Math.sqrt(S),w=e[$.chassis];w.scale.set(C,S,C),w.position.y=Math.sin(t*61)*.0035*g+v*.012+h*.07+i*.03+_*.02*Math.sin(t*33)*Math.sin(t*21+1),w.rotation.set(this.pitch+_*.02*Math.sin(t*27),0,this.roll+Math.sin(t*47+2)*.006*g+v*.03*Math.sin(t*90)+_*.025*Math.sin(t*19+2))}moveDriver(){let e=this.spec,t=this.bones,n=this.restPos,r=this.time,i=this.fDt,{boostS:a,airS:o,winS:s,loseS:c,stallS:l,spinS:u,driftS:d,lean:f}=this,p=this.accel,m=this.fSteer,h=t[$.torso];h.rotation.set(-a*.16+_m(-p*.004,-.1,.12)+c*.26-s*.08-o*.06,0,f),h.position.y=n[$.torso*3+1]+this.fHop*.04,h.updateMatrix();let g=-a*.3+c*.55-s*.2-o*.14+_m(-p*.006,-.12,.15)+l*.08+Math.sin(r*2.1)*.02,_=f*.7+l*.1*Math.sin(r*7)+u*.22*Math.sin(r*14);this.headXV+=((g-this.headX)*110-this.headXV*9)*i,this.headX+=this.headXV*i,this.headZV+=((_-this.headZ)*110-this.headZV*9)*i,this.headZ+=this.headZV*i;let v=(-m*.32-d*.3)*(1-u)+l*.28*Math.sin(r*9.5)+c*.1*Math.sin(r*1.3);this.headY=vm(this.headY,v,10,i),t[$.head].rotation.set(this.headX,this.headY,this.headZ);let y=Math.max(0,Math.sin(r*1.7+this.slot*2))**24,b=-.32*this.fWind+this.swayZ*.5-o*.15,x=e.earTilt+c*.55+l*.3-s*.1;t[$.earL].rotation.set(b,0,-x+this.swayX*.25-y*.22),t[$.earR].rotation.set(b,0,x+this.swayX*.25);let S=t[$.steer];S.rotation.set(this.restRot[$.steer*3],0,-m*1.15+d*.35),S.updateMatrix(),this.solveArm(1),this.solveArm(-1)}moveExtras(){let e=this.bones,t=this.time,{airS:n,winS:r,loseS:i,stallS:a,spinS:o,swayX:s,swayZ:c,flopX:l,flopZ:u}=this,d=this.fWind;switch(this.slot){case 0:{let i=e[$.aux0],s=this.fCough,c=.35+this.fIdle*.65+this.boostS*.8;i.position.y=this.restPos[$.aux0*3+1]+Math.sin(t*58)*.006*c+s*.02,i.rotation.z=Math.sin(t*58+1)*.022*c+s*.06*Math.sin(t*80);let l=Math.max(r*(.55+.45*Math.sin(t*17)),a*.75,n*.6,o*.7);e[$.aux1].rotation.x=l*.42;break}case 1:for(let r=0;r<4;r++){let i=Math.sin(t*(8+10*d)-r*1.15),a=(r===0?-.5:-.2)*(1-d),o=(r===0?.14+n*.2:0)+a+i*(.05+.26*d)*(r===0?.5:1)+u*.12,s=(r===0?-.2:0)+l*(r===0?.3:.12)+Math.sin(t*(6+7*d)-r*.9+1.7)*.16*d;e[$.c0+r].rotation.set(o,s,i*.35*d)}break;case 2:for(let n=0;n<2;n++){let a=n===0?1:-1,o=Math.sin(t*21+n*2.1)*.07*d;e[$.aux0+n].rotation.set(o-i*.12,a*(.32*d-c*.5)+o,a*(-i*.3+r*.2)+s*.2)}break;default:for(let n=0;n<3;n++){let r=Math.sin(t*2.6-n*.8)*.13*(1-.5*d)+Math.sin(t*15-n)*.05*d;e[$.c0+n].rotation.set((n===0?-.22:-.1)*d+u*.2+i*(n===0?-.3:-.16)+o*.15*Math.sin(t*20+n),0,r+l*.14+a*.2*Math.sin(t*30+n*2))}for(let n=0;n<2;n++){let r=n===0?1:-1;e[$.aux0+n].rotation.set(-.2-.3*d+c*.9+a*.1*Math.sin(t*40+n),0,-r*.3+s*.6)}}}moveEffects(e){let t=this.spec,n=this.bones,r=this.time,i=this.fDt,a=this.stallS,o=this.flameS;this.flames.visible=o>.03;for(let e=0;e<2;e++){let t=.85+.22*Math.sin(r*71+e*2)+.12*Math.sin(r*173+e),i=o*(.92+.16*Math.sin(r*53+e*1.3));n[$.flameL+e].scale.set(i,i,o*t*(1+.25*this.fV))}e?(this.guardV+=((1-this.guardS)*260-this.guardV*15)*i,this.guardS+=this.guardV*i):(this.guardS=vm(this.guardS,0,30,i),this.guardV=0);let s=this.guardS>.004?this.guardS:0,c=n[$.guard];c.scale.setScalar(s),c.rotation.set(Math.sin(r*2.1)*.1,r*3.4,Math.cos(r*1.7)*.1),c.position.y=this.restPos[$.guard*3+1]+Math.sin(r*3)*.03;for(let e=0;e<2;e++){let i=r*11+e*.5,o=Math.floor(i),s=ym(o+e*37.1),c=ym(o*1.7+e*11.3+5),l=ym(o*2.3+e*3.7+9),u=+(i-o<.62),d=s*hm,f=.7+.35*c,p=n[$.bolt0+e];p.position.set(Math.cos(d)*f,.5+.7*l,Math.sin(d)*f),p.rotation.set(0,gm-d,(c-.5)*1.6),p.scale.setScalar(a>.02?a*u*(.75+.4*l):0);let m=r*.85+e*.5,h=m-Math.floor(m),g=n[$.puff0+e];g.position.set(t.smoke[0]+(e===0?.14:-.14)*h+Math.sin(r*3+e)*.03,t.smoke[1]+h*.8,t.smoke[2]-h*.3),g.rotation.y=h*2+e;let _=(.45+.8*h)*Math.min(1,(1-h)*5)*Math.min(1,h*8);g.scale.setScalar(a>.02?a*_:0)}this.fx.visible=s>0||a>.02}pickEyes(e){let t=$m.OPEN;this.fSpin>0?t=$m.DIZZY:e.stall?t=$m.STUN:e.emote===`win`?t=$m.HAPPY:e.emote===`lose`?t=$m.SAD:e.boost?t=$m.FIERCE:e.air?t=$m.WOW:(this.blinkT-=this.fDt,this.blinkT<.11&&(t=$m.BLINK),this.blinkT<0&&(this.seed=Math.imul(this.seed,1664525)+1013904223>>>0,this.blinkT=2+this.seed/4294967296*3.2)),this.setEyes(t)}solveArm(e){let t=this.spec,n=this.time,r=this.bones,i=r[$.torso],a=r[e>0?$.armLU:$.armRU],o=r[e>0?$.armLF:$.armRF],s=r[e>0?$.handL:$.handR];Eh.set(e*t.shoulder[0],t.shoulder[1],t.shoulder[2]).applyMatrix4(i.matrix),Dh.set(e*t.steerR*.82,-t.steerR*.5,.03).applyMatrix4(r[$.steer].matrix);let c=this.armsUp;if(c>.001){let r=this.winS*Math.sin(n*11+e);jh.set(e*(t.shoulder[0]+.16+.07*r),t.shoulder[1]+.36+.03*this.winS*Math.cos(n*11),t.shoulder[2]+.1).applyMatrix4(i.matrix),Dh.lerp(jh,c)}kh.subVectors(Dh,Eh);let l=kh.length();l<1e-4?(kh.set(0,0,1),l=1e-4):kh.multiplyScalar(1/l);let u=(t.upper+t.fore)*.995,d=l>u?l/u:1,f=t.upper*d,p=t.fore*d,m=(f*f-p*p+l*l)/(2*l),h=Math.sqrt(Math.max(f*f-m*m,0));Ah.set(e*.8,-.55,-.25),Ah.addScaledVector(kh,-Ah.dot(kh)),Ah.lengthSq()<1e-8&&Ah.set(e,0,0),Ah.normalize(),Oh.copy(Eh).addScaledVector(kh,m).addScaledVector(Ah,h),a.position.copy(Eh),jh.subVectors(Oh,Eh);let g=jh.length();g<1e-5?(jh.set(0,1,0),g=1e-5):jh.multiplyScalar(1/g),a.quaternion.setFromUnitVectors(Jm,jh),a.scale.set(1,g/t.upper,1),o.position.copy(Oh),jh.subVectors(Dh,Oh),g=jh.length(),g<1e-5?(jh.set(0,1,0),g=1e-5):jh.multiplyScalar(1/g),o.quaternion.setFromUnitVectors(Jm,jh),o.scale.set(1,g/t.fore,1),s.position.copy(Dh),s.quaternion.copy(o.quaternion)}placeAnchors(){let e=this.spec,t=this.anchors;this.aCd=Math.cos(this.fDriftYaw),this.aSd=Math.sin(this.fDriftYaw),this.aCs=Math.cos(this.fSpinYaw),this.aSs=Math.sin(this.fSpinYaw),this.anchor(t.wheelRearL,e.wr.x,0,e.wr.z),this.anchor(t.wheelRearR,-e.wr.x,0,e.wr.z),this.anchor(t.wheelFrontL,e.wf.x,0,e.wf.z),this.anchor(t.wheelFrontR,-e.wf.x,0,e.wf.z),this.anchor(t.exhaustL,e.exhaust[0],e.exhaust[1],e.exhaust[2]),this.anchor(t.exhaustR,-e.exhaust[0],e.exhaust[1],e.exhaust[2]),this.anchor(t.head,0,e.hip[1]+e.torsoLen+.3,e.hip[2])}anchor(e,t,n,r){let i=r-Xm,a=t*this.aCd+i*this.aSd,o=-t*this.aSd+i*this.aCd+Xm;e.set(a*this.aCs+o*this.aSs,n,-a*this.aSs+o*this.aCs)}},Nh=class{constructor(){T(this,`pos`,[]),T(this,`col`,[]),T(this,`uvs`,[]),T(this,`hasUv`,!1)}get triangles(){return this.pos.length/9}tri(e,t,n,r){this.pos.push(e[0],e[1],e[2],t[0],t[1],t[2],n[0],n[1],n[2]);for(let e=0;e<3;e++)this.col.push(r[0],r[1],r[2]);this.uvs.push(0,0,0,0,0,0)}quad(e,t,n,r,i){this.tri(e,t,n,i),this.tri(e,n,r,i)}quadUv(e,t,n,r,i,a,o,s,c){this.hasUv=!0,this.pos.push(e[0],e[1],e[2],t[0],t[1],t[2],n[0],n[1],n[2],e[0],e[1],e[2],n[0],n[1],n[2],r[0],r[1],r[2]);for(let e=0;e<6;e++)this.col.push(i[0],i[1],i[2]);this.uvs.push(a,o,s,o,s,c,a,o,s,c,a,c)}box(e,t,n,r,i,a,o,s=0,c){let l=Math.cos(s),u=Math.sin(s),d=r/2,f=i/2,p=a/2,m=(r,i,a)=>[e+r*l+a*u,t+i,n-r*u+a*l],h=[m(-d,-f,-p),m(d,-f,-p),m(d,f,-p),m(-d,f,-p),m(-d,-f,p),m(d,-f,p),m(d,f,p),m(-d,f,p)];this.quad(h[4],h[5],h[6],h[7],o),this.quad(h[1],h[0],h[3],h[2],o),this.quad(h[5],h[1],h[2],h[6],o),this.quad(h[0],h[4],h[7],h[3],o),this.quad(h[7],h[6],h[2],h[3],c??o),this.quad(h[0],h[1],h[5],h[4],o)}add(e,t,n){let r=e.index?e.toNonIndexed():e,i=r.getAttribute(`position`),a=new G;for(let e=0;e<i.count;e++)a.fromBufferAttribute(i,e),n&&a.applyMatrix4(n),this.pos.push(a.x,a.y,a.z),this.col.push(t[0],t[1],t[2]),this.uvs.push(0,0);r!==e&&r.dispose()}get empty(){return this.pos.length===0}build(){let e=new Ro;return e.setAttribute(`position`,new Y(this.pos,3)),e.setAttribute(`color`,new Y(this.col,3)),this.hasUv&&e.setAttribute(`uv`,new Y(this.uvs,2)),e.computeVertexNormals(),e.computeBoundingSphere(),e}};function Ph(e){let t=e%2147483646+1;return()=>(t=t*16807%2147483647,t/2147483647)}function Fh(e,t){let n=Math.sin(e*127.1+t*311.7)*43758.5453;return n-Math.floor(n)}function Ih(e,t){let n=Math.floor(e),r=Math.floor(t),i=e-n,a=t-r,o=i*i*(3-2*i),s=a*a*(3-2*a),c=Fh(n,r),l=Fh(n+1,r),u=Fh(n,r+1),d=Fh(n+1,r+1);return c+(l-c)*o+(u-c)*s+(c-l-u+d)*o*s}function Lh(e){let t=Math.max(0,Math.min(1,e));return t*t*(3-2*t)}function Rh(e,t,n){return[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n]}function zh(e,t){return[e[0]*t,e[1]*t,e[2]*t]}function Bh(e,t={}){let n=t.w??256,r=t.h??96,i=document.createElement(`canvas`);i.width=n,i.height=r;let a=i.getContext(`2d`);t.bg&&(a.fillStyle=t.bg,a.fillRect(0,0,n,r)),t.border&&(a.strokeStyle=t.border,a.lineWidth=Math.round(r*.1),a.strokeRect(a.lineWidth/2,a.lineWidth/2,n-a.lineWidth,r-a.lineWidth)),a.fillStyle=t.fg??`#fff`,a.textAlign=`center`,a.textBaseline=`middle`;let o=Math.round(r*.62),s=t.font??`900 SIZEpx "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;a.font=s.replace(`SIZE`,String(o));let c=n*.86,l=a.measureText(e).width;l>c&&(o=Math.floor(o*c/l),a.font=s.replace(`SIZE`,String(o))),a.fillText(e,n/2,r/2+o*.04);let u=new hc(i);return u.colorSpace=ui,u.anisotropy=4,u}var Vh=class{constructor(e,t){T(this,`track`,void 0),T(this,`outlines`,void 0),T(this,`group`,new Fa),T(this,`hazards`,[]),T(this,`live`,new Map),T(this,`geos`,[]),T(this,`toon`,sm({vertexColors:!0})),T(this,`oilMat`,new gs({vertexColors:!0,polygonOffset:!0,polygonOffsetFactor:-3,polygonOffsetUnits:-8})),T(this,`tireGeo`,void 0),T(this,`oilGeo`,void 0),T(this,`topGeo`,void 0),T(this,`smokeGeo`,void 0),T(this,`hazardGeo`,void 0),T(this,`theme`,void 0),this.track=e,this.outlines=t,this.theme=e.def.theme;let n=new q,r=new zi,i=(e,t,i,a=0,o=0,s=0,c=1,l=c,u=c,d=0,f=0,p=0)=>{r.setFromEuler(new _a(d,f,p)),n.compose(new G(a,o,s),r,new G(c,l,u)),e.add(t,Q(i),n),t.dispose()},a=new Nh;i(a,new xl(.56,.27,7,14),2762547,0,0,0,1,1,1,0,Math.PI/2,0),i(a,new Sc(.3,.3,.3,8),16765503,0,0,0,1,1,1,0,0,Math.PI/2),this.tireGeo=this.keep(fm(a.build())),a=new Nh;let o=(e,t,n,r,i,o)=>{let s=Q(r);for(let r=0;r<11;r++){let c=r/11*Math.PI*2,l=(r+1)/11*Math.PI*2,u=n*(.8+.25*Math.sin(r*2.3+o)),d=n*(.8+.25*Math.sin((r+1)*2.3+o));a.tri([e,i,t],[e+Math.sin(c)*u,i,t+Math.cos(c)*u],[e+Math.sin(l)*d,i,t+Math.cos(l)*d],s)}};o(0,0,1.75,1446684,.05,0),o(0,0,1.45,2892864,.06,1),o(-.45,.35,.34,9404352,.07,2),o(.5,-.4,.2,13616878,.07,3),this.oilGeo=this.keep(a.build()),a=new Nh;let s=(e,t)=>{i(a,new _l(e.map(([e,t])=>new W(e,t)),12),t)};if(s([[.001,0],[.5,.45],[.78,.72]],16734798),s([[.78,.72],[.8,.86],[.6,1.02]],16765503),s([[.6,1.02],[.14,1.1],[.11,1.5],[.2,1.56],[.001,1.62]],2082998),this.topGeo=this.keep(fm(a.build())),a=new Nh,[[0,2.2,0,3.4],[3.2,1.8,.6,2.7],[-3,1.7,-.5,2.8],[.8,1.6,3.1,2.6],[-.9,1.7,-3,2.6],[2.2,4,-1.6,2.3],[-2,4.2,1.4,2.4],[.2,5.3,.2,2]].forEach(([e,t,n,r],o)=>i(a,new gl(1,1),o%2==0?15329010:13223384,e,t,n,r)),this.smokeGeo=this.keep(fm(a.build())),a=new Nh,this.theme===`werkshof`){for(let e=0;e<5;e++)i(a,new Sc(1,1,.5,12),e%2==0?16765503:2762547,0,0,-1+e*.5,1,1,1,Math.PI/2);i(a,new xl(1,.09,5,12),2762547,0,0,-1.2),i(a,new xl(1,.09,5,12),2762547,0,0,1.2)}else if(this.theme===`klippe`){i(a,new gl(1,1),16734798,0,.75,0,1.25,.6,.95);for(let e of[-1,1]){i(a,new gl(.5,1),16743001,e*1.55,1.05,-.5,1,.8,.8),i(a,new Sc(.07,.07,.6,5),16734798,e*.4,1.4,-.6),i(a,new gl(.2,1),16777215,e*.4,1.75,-.62),i(a,new gl(.1,0),1446684,e*.4,1.77,-.8);for(let t=0;t<3;t++)i(a,new yc(.75,.12,.14),14239806,e*1.35,.42,-.2+t*.4,1,1,1,0,0,-e*.6)}}else if(this.theme===`glut`)i(a,new gl(1.45,0),2760752),i(a,new gl(1.2,0),16742943,0,0,0,1.08,1.08,1.08,.6,.4,.2);else{a.box(0,.75,0,2.3,1,1.9,Q(2086600),0,Q(1484700)),a.box(0,.3,0,2.6,.3,2.2,Q(1184810)),i(a,new Sc(.42,.42,2.5,8),16727450,0,.42,-1.15,1,1,1,0,0,Math.PI/2),i(a,new bl(.36,8,6),16765503,0,1.5,0);for(let e of[-1,1])i(a,new gl(.2,1),16777215,e*.55,.95,-.97)}this.hazardGeo=this.keep(fm(a.build()));for(let t=0;t<e.hazards.length;t++){let e=this.make(this.hazardGeo,this.toon,.06);this.hazards.push(e),this.group.add(e)}}keep(e){return this.geos.push(e),e}make(e,t,n){let r=new Fa,i=new Os(e,t);if(r.add(i),n>0&&this.outlines){let t=new Os(e,dm(n));t.name=`outline`,i.add(t)}return r}update(e,t,n){for(let e of this.live.values())e.seen=!1;for(let r of e){let e=r.kind*1e3+r.id,i=this.live.get(e);if(!i){let t;t=r.kind===1?this.make(this.tireGeo,this.toon,.05):r.kind===2?this.make(this.oilGeo,this.oilMat,0):r.kind===3?this.make(this.topGeo,this.toon,.05):this.make(this.smokeGeo,this.toon,.12),i={kind:r.kind,obj:t,seen:!0,age:0,spin:0},this.live.set(e,i),this.group.add(t)}i.seen=!0,i.age+=t;let a=i.obj,o=a.children[0],s=Math.min(1,i.age*7),c=s*(1+.3*Math.sin(s*Math.PI));if(r.kind===1)a.position.set(r.x,r.y,r.z),a.rotation.y=Math.atan2(r.vx,r.vz),i.spin+=Math.hypot(r.vx,r.vz)/.8*t,o.rotation.x=i.spin,a.scale.setScalar(c);else if(r.kind===2)a.position.set(r.x,r.y,r.z),a.rotation.y=r.id*1.3,a.scale.setScalar(c);else if(r.kind===3)a.position.set(r.x,r.y-.6+.08*Math.sin(n*9),r.z),i.spin+=t*38,o.rotation.y=i.spin,a.rotation.set(Math.sin(n*5)*.16,0,Math.cos(n*5)*.16),a.scale.setScalar(c*1.15);else if(r.kind===4){a.position.set(r.x,r.y,r.z),a.rotation.y=n*.25+r.id;let e=c*Math.min(1,r.ttl*1.4)*(1+.04*Math.sin(n*3+r.id));a.scale.set(e,e*(.95+.05*Math.sin(n*2.2)),e)}}for(let[e,t]of this.live)t.seen||(this.group.remove(t.obj),this.live.delete(e))}updateHazards(t,n){let r=this.track;for(let i=0;i<r.hazards.length;i++){let a=r.hazards[i],o=b(a,t),s=this.hazards[i];s.position.set(r.px[a.seg]+e(r,a.seg)*o,r.py[a.seg]+o*r.bank[a.seg],r.pz[a.seg]+k(r,a.seg)*o),s.rotation.y=Math.atan2(r.tx[a.seg],r.tz[a.seg]);let c=s.children[0];this.theme===`werkshof`?(c.position.y=1,c.rotation.z=-o):this.theme===`glut`?(c.position.y=1.35,c.rotation.set(n*1.1,0,-o*.7)):this.theme===`klippe`?(c.position.y=Math.abs(Math.sin(n*14))*.12,c.rotation.z=Math.sin(n*14)*.06):c.position.y=.04*Math.sin(n*20)}}clear(){for(let e of this.live.values())this.group.remove(e.obj);this.live.clear()}dispose(){this.clear();for(let e of this.geos)e.dispose();this.toon.dispose(),this.oilMat.dispose()}},Hh=new q,Uh=new zi,Wh=new _a,Gh=new G,Kh=new G;function qh(e,t,n,r=0,i=0,a=0,o=1,s=o,c=o){return Wh.set(r,i,a),Uh.setFromEuler(Wh),Hh.compose(Gh.set(e,t,n),Uh,Kh.set(o,s,c)).clone()}function Jh(t){let n=t.track,r=t.theme,i=new Fa,a=[],o=Ph(1e3+n.index*97),s=t.detail===0?.5:1,c=sm({vertexColors:!0}),l=new gs({vertexColors:!0});a.push(c,l);let u=(e,t)=>{let r=1/0;for(let i=0;i<n.n;i+=2){let a=Math.hypot(e-n.px[i],t-n.pz[i])-n.wh[i];a<r&&(r=a)}return r},d=(i,a,c,l,d)=>{let f=[],p=Math.round(i*s);for(let i=0;f.length<p&&i<p*12;i++){let i=Math.floor(o()*n.n);if(n.edge[i]&8&&r.liquidY!==null)continue;let s=(o()<.5?-1:1)*(n.wh[i]+.5+a+o()*(c-a)),p=n.px[i]+e(n,i)*s,m=n.pz[i]+k(n,i)*s;if(u(p,m)<l)continue;let h=t.heightAt(p,m);if(r.liquidY!==null&&h<r.liquidY+.5||d&&!d(h,p,m))continue;let g=.8+o()*.5;f.push({x:p,y:h,z:m,rot:o()*Math.PI*2,sx:g,sy:g,sz:g})}return f},f=(e,n,r=c,o=!1)=>{if(n.length===0){e.dispose();return}let s=new ec(e,r,n.length),l=new J;if(n.forEach((e,t)=>{s.setMatrixAt(t,qh(e.x,e.y,e.z,0,e.rot,0,e.sx,e.sy,e.sz)),e.color!==void 0&&s.setColorAt(t,l.set(e.color))}),s.instanceMatrix.needsUpdate=!0,s.instanceColor&&(s.instanceColor.needsUpdate=!0),s.computeBoundingSphere(),i.add(s),a.push(e,s),o&&t.detail===2){fm(e);let t=new ec(e,dm(.06),n.length);t.instanceMatrix=s.instanceMatrix,t.boundingSphere=s.boundingSphere,t.name=`outline`,i.add(t),a.push(t)}},p=(e,t,n,r=7)=>new Sc(e,t,n,r,1),m=(e,t=0)=>new gl(e,t),h=(e,t,n,r)=>{e.add(t,n,r),t.dispose()};{let t=document.createElement(`canvas`);t.width=192,t.height=96;let i=t.getContext(`2d`);i.fillStyle=`#ffd23f`,i.fillRect(0,0,192,96),i.strokeStyle=`#16131c`,i.lineWidth=10,i.strokeRect(5,5,182,86),i.fillStyle=`#16131c`;for(let e=0;e<3;e++){let t=30+e*48;i.beginPath(),i.moveTo(t,20),i.lineTo(t+22,20),i.lineTo(t+46,48),i.lineTo(t+22,76),i.lineTo(t,76),i.lineTo(t+24,48),i.closePath(),i.fill()}let o=new hc(t);o.colorSpace=ui;let s=o.clone();s.wrapS=Hn,s.repeat.x=-1,s.needsUpdate=!0;let c=[],l=[];for(let t=0;t<n.n;t+=5){let r=n.curv[t];if(Math.abs(r)<1/30)continue;let i=r>0?-1:1;if(n.edge[t]&(i<0?1:2))continue;let a=i*(n.wh[t]+.9),o={x:n.px[t]+e(n,t)*a,y:n.py[t]+a*n.bank[t]+1.75,z:n.pz[t]+k(n,t)*a,rot:Math.atan2(-n.tx[t],-n.tz[t]),sx:1,sy:1,sz:1};(r>0?c:l).push(o)}let u=()=>new yl(2.5,1.25),d=new gs({map:o,side:2}),p=new gs({map:s,side:2});r.stars&&(d.color.setScalar(.85),p.color.setScalar(.85)),f(u(),c,d),f(u(),l,p),a.push(o,s,d,p)}{let e=new Nh,o=1700,s=Rh(Q(r.fog),Q(r.sky[0]),.45);for(let r=0;r<96;r++){let i=r/96*Math.PI*2,a=(r+1)/96*Math.PI*2,c=(i+a)/2,l=(e,n)=>[t.center.x+Math.cos(e)*o,n,t.center.z+Math.sin(e)*o],u=Ih(r*.37,n.index*3.1),d=Ih(r*1.3+5,n.index),f=zh(s,.85+d*.3);if(n.def.theme===`nacht`||n.def.theme===`werkshof`){let t=n.def.theme===`nacht`?90+u*330+(d>.75?160:0):40+u*90;if(e.quad(l(a,-40),l(i,-40),l(i,t),l(a,t),f),n.def.theme===`werkshof`&&d>.72){let n=(a-i)*.16;e.quad(l(c+n,-40),l(c-n,-40),l(c-n,t+150),l(c+n,t+150),zh(f,.9))}}else{let t=n.def.theme===`glut`?120+u*300:20+u*90*(d>.45?1:.1);e.quad(l(a,-40),l(i,-40),l(i,t*.45),l(a,t*.55),f),e.tri(l(a,t*.55),l(i,t*.45),l(c,t),f)}}n.def.theme===`glut`&&h(e,new Sc(120,520,620,9,1,!0),zh(s,.8),qh(t.center.x+o*.72,250,t.center.z+o*.5));let c=new gs({vertexColors:!0,fog:!1,side:2}),l=new Os(e.build(),c);if(l.renderOrder=-8,i.add(l),a.push(l.geometry,c),n.def.theme===`glut`){let e=new gs({color:16747050,fog:!1}),n=new Os(new Sc(124,124,14,9),e);n.position.set(t.center.x+o*.72,556,t.center.z+o*.5),i.add(n),a.push(n.geometry,e)}}let g=n.def.theme;if(g===`werkshof`){let e=[16734798,2082998,16765503,5209048,15921126,16751164],t=new Nh;t.box(0,1.3,0,6.1,2.6,2.44,[1,1,1]);for(let e of[-2.95,2.95])t.box(e,1.3,0,.22,2.7,2.54,[.55,.55,.6]);for(let e=-2;e<=2;e++)t.box(e*1.05,1.3,0,.12,2.3,2.5,[.86,.86,.9]);let r=[];for(let t of d(30,2.2,38,4.5,e=>e<3)){let i=Math.floor(o()*n.n);t.rot=Math.round(o()*3)*(Math.PI/2)+Math.atan2(n.tx[i],n.tz[i])*0,t.sx=t.sy=t.sz=1,t.color=e[Math.floor(o()*e.length)],r.push(t),o()<.45&&r.push({...t,y:t.y+2.6,color:e[Math.floor(o()*e.length)]})}f(t.build(),r,c,!0);let i=new Nh,a=Q(14272424);i.box(0,4.5,0,28,9,17,a),i.box(0,5.2,8.56,26,1.6,.1,Q(7327974)),i.box(0,5.2,-8.56,26,1.6,.1,Q(7327974));for(let e=0;e<4;e++){let t=-10.5+e*7,n=-8.5,r=8.5,o=Q(11883580);i.tri([t-3.5,9,r],[t+3.5,9,r],[t+3.5,12,r],a),i.tri([t+3.5,9,n],[t-3.5,9,n],[t+3.5,12,n],a),i.quad([t-3.5,9,r],[t+3.5,12,r],[t+3.5,12,n],[t-3.5,9,n],o),i.quad([t+3.5,9,r],[t+3.5,9,n],[t+3.5,12,n],[t+3.5,12,r],Q(10478578))}f(i.build(),d(7,34,110,26).map(e=>({...e,sx:1,sy:.9+o()*.5,sz:1,rot:Math.round(o()*3)*(Math.PI/2)})),c,!0);let s=new Nh;for(let e=0;e<6;e++){let t=2.1-e*.14;h(s,p(t-.14,t,6,8),e>=4?e%2==0?Q(16734798):Q(16249572):Q(12159594),qh(0,3+e*6,0))}f(s.build(),d(5,50,130,30),c,!0);let l=new Nh,u=Q(16762670);for(let e of[-9,9])l.box(e,7,-3,.9,14,.9,u),l.box(e,7,3,.9,14,.9,u),l.box(e,.4,0,1.4,.8,8,Q(3091513));l.box(0,14.6,0,26,1.6,2.2,u),l.box(3,12.8,0,3,2.2,2.6,Q(3091513)),l.box(3,9.5,0,.2,5,.2,Q(3091513)),f(l.build(),d(3,16,50,14).map(e=>({...e,sx:1,sy:1,sz:1})),c,!0);let g=new Nh;for(let e=0;e<3;e++)h(g,new xl(.55,.26,5,10),Q(2762547),qh(0,.28+e*.5,0,Math.PI/2));f(g.build(),d(26,.6,1.4,.9),c);let _=new Nh;h(_,p(.25,.35,2.4,6),Q(6965812),qh(0,1.2,0)),h(_,m(1,1),Q(6265413),qh(0,5.4,0,0,0,0,1.7,3.6,1.7)),f(_.build(),d(34,5,70,5),c,!0)}if(g===`klippe`){let i=new Nh,a=Q(11106634),s=Q(4173402),l=Q(3115594);[[0,.8,0],[.22,2.3,.1],[.6,3.7,.2],[1.15,5,.3]].forEach((e,t)=>h(i,p(.2-t*.02,.27-t*.02,1.7,6),a,qh(e[0],e[1],0,0,0,-e[2])));for(let e=0;e<7;e++){let t=e/7*Math.PI*2,n=Math.cos(t),r=Math.sin(t),a=[1.4,5.9,0],o=[1.4+n*1.7,6.3,r*1.7],c=[1.4+n*3.3,4.9,r*3.3],u=.55,d=[o[0]-r*u,o[1]-.1,o[2]+n*u],f=[o[0]+r*u,o[1]-.1,o[2]-n*u];for(let[e,t]of[[s,!1],[l,!0]])t?(i.tri(a,f,d,e),i.tri(d,f,c,e)):(i.tri(a,d,f,e),i.tri(d,c,f,e))}f(i.build(),d(26,1.5,34,2.2,e=>e<5),c);let g=new Nh;h(g,p(.22,.34,2.2,6),Q(8016432),qh(0,1.1,0)),h(g,m(1.5,1),Q(4168274),qh(0,3.3,0,0,0,0,1.25,1,1.25)),h(g,m(1.1,1),Q(5616998),qh(.3,4.6,.1)),f(g.build(),d(40,2,60,3,e=>e>6),c,!0);let _=new Nh;h(_,m(1.2,0),Q(14275266),qh(0,.5,0,.3,0,.2,1.3,.8,1)),f(_.build(),d(46,1.2,70,2).map(e=>({...e,sx:e.sx*(.7+o()*1.8),sy:e.sy*(.7+o()*1.4),sz:e.sz*(.7+o()*1.8)})),c,!0);let v=new Nh;h(v,p(.05,.05,2.4,5),Q(15921126),qh(0,1.2,0));let y=new Cc(1.6,.7,8,1,!0).toNonIndexed(),b=y.getAttribute(`position`),x=new G;for(let e=0;e<b.count;e+=3){let t=[];for(let n=0;n<3;n++)x.fromBufferAttribute(b,e+n),t.push([x.x,x.y+2.5,x.z]);v.tri(t[0],t[1],t[2],Math.floor(e/6)%2==0?Q(16743001):Q(16777215))}y.dispose(),f(v.build(),d(14,2,22,2.5,e=>e<1.6),c);let S=new Nh;for(let e=0;e<5;e++)h(S,p(2.3-e*.3,2.6-e*.3,4.4,10),e%2==0?Q(16777215):Q(16734798),qh(0,2.2+e*4.4,0));h(S,p(1.9,1.9,.4,10),Q(3159626),qh(0,22.2,0)),h(S,p(1,1,2.2,8),Q(16773226),qh(0,23.5,0)),h(S,new Cc(1.7,1.8,8),Q(16734798),qh(0,25.5,0));let C=Math.round(n.n*.845),w=n.wh[C]+13,T=n.px[C]+e(n,C)*w,E=n.pz[C]+k(n,C)*w;f(S.build(),[{x:T,y:t.heightAt(T,E)-.5,z:E,rot:0,sx:1,sy:1,sz:1}],c,!0);let D=new Nh;D.box(0,.35,0,1.5,.9,4.4,Q(16777215),0,Q(12618322)),h(D,p(.06,.06,5,5),Q(3159626),qh(0,3,.2));for(let[e,t]of[[Q(16743001),!1],[Q(16743001),!0]]){let n=[0,.9,0],r=[0,5.4,.2],i=[0,.9,-2.3];t?D.tri(n,i,r,e):D.tri(n,r,i,e)}let O=[];for(let e=0;O.length<9&&e<200;e++){let e=o()*Math.PI*2,n=t.radius*(.55+o()*1.1),i=t.center.x+Math.cos(e)*n,a=t.center.z+Math.sin(e)*n;u(i,a)<14||t.heightAt(i,a)>r.liquidY-1.5||O.push({x:i,y:r.liquidY-.1,z:a,rot:o()*6.3,sx:1.6,sy:1.6,sz:1.6})}f(D.build(),O,c,!0)}if(g===`glut`){let e=Q(3812416),t=Q(7034213),n=new Nh;h(n,new Cc(1.4,6,5),e,qh(0,2.6,0,.12,0,.1)),h(n,new Cc(.8,3.2,5),t,qh(1.1,1.2,.4,-.2,0,-.35)),f(n.build(),d(70,1.4,70,2.4).map(e=>({...e,sy:e.sy*(.8+o()*2.2),sx:e.sx*(.8+o()*1.2),sz:e.sz*(.8+o()*1.2)})),c,!0);let r=new Nh;h(r,m(1.3,0),t,qh(0,.6,0,.4,.2,.1,1.2,.85,1)),f(r.build(),d(44,1.2,60,2).map(e=>({...e,sx:e.sx*(.6+o()*1.6),sy:e.sy*(.6+o()*1.2),sz:e.sz*(.6+o()*1.6)})),c,!0);let i=new Nh,a=Q(2037798);h(i,p(.12,.3,4.4,5),a,qh(0,2.2,0,0,0,.06)),h(i,p(.05,.12,2.2,4),a,qh(.7,3.4,0,0,0,-.9)),h(i,p(.05,.11,1.8,4),a,qh(-.6,3.9,.2,.3,0,.8)),h(i,p(.04,.09,1.3,4),a,qh(.1,4.8,-.4,-.7,0,.1)),f(i.build(),d(22,2,40,2.5),c);let s=new Nh;h(s,new vl(.7),Q(16751135),qh(0,.9,0,0,0,.2,.7,1.6,.7)),h(s,new vl(.45),Q(16769658),qh(.6,.5,.2,.2,0,-.5,.7,1.4,.7)),f(s.build(),d(34,.9,16,1.4),l)}if(g===`nacht`){let r=document.createElement(`canvas`);r.width=r.height=128;let s=r.getContext(`2d`);s.fillStyle=`#181a33`,s.fillRect(0,0,128,128);let d=[`#ffd86a`,`#ffd86a`,`#fff1b8`,`#58e6dc`,`#ff6ab0`],f=Ph(4711);for(let e=0;e<8;e++)for(let t=0;t<8;t++)s.fillStyle=f()<.42?d[Math.floor(f()*d.length)]:`#262a4a`,s.fillRect(t*16+4,e*16+4,9,9);let p=new hc(r);p.colorSpace=ui,p.wrapS=p.wrapT=Hn,p.magFilter=Gn;let m=new Nh,h=new Nh,g=[1,1,1],_=t.radius+230,v=[];for(let e=-_;e<=_;e+=40)for(let n=-_;n<=_;n+=40){if(o()<.22)continue;let r=16+o()*14,i=16+o()*14,a=t.center.x+e+(o()-.5)*8,s=t.center.z+n+(o()-.5)*8,c=u(a,s)-Math.max(r,i)*.72;if(c<5)continue;let l=Math.min(18+o()*70,14+c*1.6)*(t.detail===0&&o()<.4?0:1);if(l<6)continue;let d=Math.floor(o()*8)/8,f=[[a-r/2,s+i/2,a+r/2,s+i/2,r],[a+r/2,s+i/2,a+r/2,s-i/2,i],[a+r/2,s-i/2,a-r/2,s-i/2,r],[a-r/2,s-i/2,a-r/2,s+i/2,i]];for(let[e,t,n,r,i]of f)m.quadUv([e,0,t],[n,0,r],[n,l,r],[e,l,t],g,d,0,d+Math.round(i/4)/8,Math.round(l/3.6)/8);h.quad([a-r/2,l,s+i/2],[a+r/2,l,s+i/2],[a+r/2,l,s-i/2],[a-r/2,l,s-i/2],Q(2303551)),o()<.5&&h.box(a+(o()-.5)*r*.4,l+1.2,s+(o()-.5)*i*.4,4,2.4,4,Q(2961488)),l>44&&(h.box(a,l+5,s,.3,10,.3,Q(2961488)),v.push(a,l+10.4,s))}let y=new gs({map:p}),b=new Os(m.build(),y),x=new Os(h.build(),c);if(i.add(b,x),a.push(b.geometry,x.geometry,y,p),v.length>0){let e=new Ro;e.setAttribute(`position`,new Y(v,3));let t=new sc({color:16727386,size:5,sizeAttenuation:!1,fog:!1});i.add(new fc(e,t)),a.push(e,t)}let S=new Nh,C=Q(1184810);for(let t=4;t<n.n;t+=13){if(n.edge[t]&7)continue;let r=Math.floor(t/13)%2==0?-1:1,i=r*(n.wh[t]+.25),a=n.px[t]+e(n,t)*i,o=n.pz[t]+k(n,t)*i,s=n.py[t]+i*n.bank[t]+.9,c=Math.atan2(n.tx[t],n.tz[t]);S.box(a,s+2.2,o,.16,4.4,.16,C,c);let l=a-e(n,t)*r*1.1,u=o-k(n,t)*r*1.1;S.box((a+l)/2,s+4.4,(o+u)/2,1.3,.14,.14,C,c),S.box(l,s+4.25,u,.5,.22,.5,Q(r<0?16773544:9435118),c)}let w=new Os(S.build(),l);i.add(w),a.push(w.geometry);let T=[[`KINO`,`#ff3d9a`,`#1a0a22`],[`IMBISS`,`#ffd23f`,`#1a1408`],[`24 h`,`#1fd6c8`,`#06201e`],[`HOTEL`,`#ff6a3d`,`#200d06`],[`SPÄTI`,`#8ff7ee`,`#06201e`],[`TAXI`,`#ffd23f`,`#1a1408`],[`DISCO`,`#c58bff`,`#150a22`],[`BAR`,`#ff3d9a`,`#1a0a22`]],E=new Nh;if(T.forEach(([t,r,o],s)=>{let c=Math.floor((s+.5)/T.length*n.n),l=s%2==0?1:-1,d=l*(n.wh[c]+5),f=n.px[c]+e(n,c)*d,p=n.pz[c]+k(n,c)*d;if(u(f,p)<3)return;let m=n.py[c]+6.5,h=Bh(t,{w:256,h:112,bg:o,fg:r,border:r}),g=new gs({map:h,side:2,fog:!1}),_=new Os(new yl(7.4,3.2),g);_.position.set(f,m,p),_.rotation.y=Math.atan2(-n.tx[c],-n.tz[c])+l*.5,i.add(_),E.box(f,m/2-1,p,.5,m,.5,C),a.push(_.geometry,g,h)}),!E.empty){let e=new Os(E.build(),c);i.add(e),a.push(e.geometry)}}return{group:i,dispose(){for(let e of a)e.dispose()}}}var Yh={werkshof:{sky:[4157380,15902565,16769704],fog:16172434,fogNear:140,fogFar:520,sunDir:[-.55,.62,.35],sunColor:16773332,sunIntensity:2.3,hemiSky:12572415,hemiGround:9067068,hemiIntensity:1.25,disc:16774084,discSize:46,clouds:16773596,cloudShade:15772040,stars:!1,road:4868181,roadAlt:5394526,line:16249572,kerbA:16734798,kerbB:16249572,shoulder:8362581,wallA:16765503,wallB:3091513,wallCap:2762547,deck:9276054,deckDark:6183785,pillar:7104886,ground:[9416280,8100428,10127978,12035460],liquidY:null,liquid:[0,0,0],liquidGlow:!1,farY:0,rough:1.4},klippe:{sky:[2064352,7324661,14677247],fog:13496063,fogNear:170,fogFar:640,sunDir:[.4,.82,-.3],sunColor:16777215,sunIntensity:2.6,hemiSky:13625855,hemiGround:13482378,hemiIntensity:1.3,disc:16776160,discSize:34,clouds:16777215,cloudShade:12180210,stars:!1,road:5658472,roadAlt:6184817,line:16777215,kerbA:2074592,kerbB:16777215,shoulder:15126415,wallA:16777215,wallB:16743001,wallCap:3159626,deck:12618322,deckDark:9067571,pillar:8016432,ground:[15324566,8175706,14275266,15921126],liquidY:-2.2,liquid:[2005976,3523048,13235455],liquidGlow:!1,farY:-9,rough:2.2},glut:{sky:[1905464,8007514,16747068],fog:7023690,fogNear:120,fogFar:480,sunDir:[.5,.45,.55],sunColor:16758663,sunIntensity:1.9,hemiSky:9071305,hemiGround:16734751,hemiIntensity:1.35,disc:16767392,discSize:30,clouds:5648463,cloudShade:2890291,stars:!0,road:3814466,roadAlt:4340555,line:16767392,kerbA:16742943,kerbB:2761521,shoulder:5916244,wallA:2761521,wallB:16742943,wallCap:1511965,deck:7034213,deckDark:4207167,pillar:4864584,ground:[5192780,6244183,3483706,8018530],liquidY:-3.5,liquid:[16731407,16751135,16769658],liquidGlow:!0,farY:-10,rough:5},nacht:{sky:[461599,1711954,4861818],fog:1710660,fogNear:110,fogFar:460,sunDir:[-.35,.75,.5],sunColor:12175615,sunIntensity:1.5,hemiSky:8359167,hemiGround:16734888,hemiIntensity:1.5,disc:15922687,discSize:26,clouds:2764650,cloudShade:1382980,stars:!0,road:3356237,roadAlt:3816790,line:16773544,kerbA:16727450,kerbB:2086600,shoulder:4869740,wallA:2303548,wallB:2086600,wallCap:1184810,deck:5527672,deckDark:2961488,pillar:4014176,ground:[2106172,2501190,1711155,2895952],liquidY:null,liquid:[0,0,0],liquidGlow:!1,farY:0,rough:0}},Xh=.95,Zh=.5,Qh=1.1,$h=`
#include <common>
#include <fog_pars_vertex>
varying vec3 vWorld;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,eg=`
#include <common>
#include <fog_pars_fragment>
uniform float time;
uniform vec3 c0;
uniform vec3 c1;
uniform vec3 c2;
varying vec3 vWorld;
void main() {
  float a = sin(vWorld.x * 0.085 + time * 0.7 + sin(vWorld.z * 0.06 + time * 0.4) * 1.8);
  float b = sin(vWorld.z * 0.12 - time * 0.55 + sin(vWorld.x * 0.045 - time * 0.2) * 2.2);
  float v = a * 0.3 + b * 0.2 + 0.5;
  vec3 col = v < 0.52 ? c0 : (v < 0.83 ? c1 : c2);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,tg=`
#include <common>
#include <fog_pars_fragment>
uniform float time;
uniform vec3 c0;
uniform vec3 c1;
varying vec2 vUv;
void main() {
  float k = fract(vUv.y * 1.6 - abs(vUv.x - 0.5) * 1.5 - time * 2.4);
  float edge = step(0.06, vUv.x) * step(vUv.x, 0.94);
  vec3 col = mix(c0, k < 0.5 ? c1 : c0, edge);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;function ng(e,t){return new Al({uniforms:Dl.merge([Z.fog,t]),vertexShader:$h,fragmentShader:e,fog:!0})}var rg=class{constructor(e,t){T(this,`track`,void 0),T(this,`detail`,void 0),T(this,`group`,new Fa),T(this,`theme`,void 0),T(this,`sun`,void 0),T(this,`hemi`,void 0),T(this,`fog`,void 0),T(this,`center`,new G),T(this,`radius`,100),T(this,`skyGroup`,new Fa),T(this,`clouds`,new Fa),T(this,`timed`,[]),T(this,`boxMesh`,null),T(this,`boxOutline`,null),T(this,`m4`,new q),T(this,`q`,new zi),T(this,`v`,new G),T(this,`s`,new G),T(this,`euler`,new _a),T(this,`disposables`,[]),T(this,`boxScale`,void 0),T(this,`nonDeck`,[]),T(this,`idwSegs`,[]),this.track=e,this.detail=t,this.theme=Yh[e.def.theme];let n=this.theme,r=e;this.boxScale=new Float32Array(r.boxes.length).fill(1);let i=1/0,a=-1/0,o=1/0,s=-1/0;for(let e=0;e<r.n;e++)i=Math.min(i,r.px[e]),a=Math.max(a,r.px[e]),o=Math.min(o,r.pz[e]),s=Math.max(s,r.pz[e]),r.edge[e]&8||(this.nonDeck.push(e),e%8==0&&this.idwSegs.push(e));this.center.set((i+a)/2,0,(o+s)/2),this.radius=Math.hypot(a-i,s-o)/2,this.fog=new Ua(n.fog,n.fogNear,n.fogFar),this.sun=new _u(n.sunColor,n.sunIntensity),this.sun.position.set(n.sunDir[0],n.sunDir[1],n.sunDir[2]).multiplyScalar(100),this.hemi=new nu(n.hemiSky,n.hemiGround,n.hemiIntensity),this.group.add(this.sun,this.hemi),this.buildRoad(),this.buildTerrain(i,a,o,s),this.buildSky(),this.buildBoxes();let c=Jh(this);this.group.add(c.group),this.disposables.push(c)}P(t,n,r,i=0){let a=this.track,o=(t%a.n+a.n)%a.n,s=a.px[o]+e(a,o)*r,c=a.py[o]+r*a.bank[o]+i,l=a.pz[o]+k(a,o)*r;if(n===0)return[s,c,l];let u=(o+1)%a.n,d=a.px[u]+e(a,u)*r,f=a.py[u]+r*a.bank[u]+i,p=a.pz[u]+k(a,u)*r;return[s+(d-s)*n,c+(f-c)*n,l+(p-l)*n]}buildRoad(){let e=this.track,t=this.theme,n=new Nh,r=new Nh,i=Q(t.road),a=Q(t.roadAlt),o=Q(t.shoulder),s=Q(t.line),c=Q(t.wallA),l=Q(t.wallB),u=Q(t.wallCap),d=Q(t.deck),f=Q(t.deckDark),p=Q(t.pillar),m=Q(t.kerbA),h=Q(t.kerbB),g=Q(16765503),_=Q(im),v=(e,t,n,r,i,a,o,s)=>{e.quad(this.P(t,n,i,o),this.P(t,n,a,o),this.P(t,r,a,o),this.P(t,r,i,o),s)},y=(e,t,r,i,a,o,s,c)=>{let l=this.P(e,t,i,a),u=this.P(e,r,i,a),d=this.P(e,r,i,o),f=this.P(e,t,i,o);s?n.quad(l,u,d,f,c):n.quad(u,l,f,d,c)},b=(e,t,r,i,a,o,s,c)=>{let l=this.P(e,t,r,a),u=this.P(e,t,i,a),d=this.P(e,t,i,o),f=this.P(e,t,r,o);s?n.quad(u,l,f,d,c):n.quad(l,u,d,f,c)};for(let x=0;x<e.n;x++){let S=(x+1)%e.n,C=!!(e.edge[x]&4),w=!!(e.edge[S]&4);if(C&&w)continue;let T=C?.5:0,E=w?.5:1,D=C?S:x,O=e.edge[D],k=e.rh[D],A=e.wh[D],j=!!(O&1),ee=!!(O&2),M=!!(O&8),N=!!(O&16),P=N?x%2==0?g:_:Math.floor(x/4)%2==0?i:a;v(n,x,T,E,-k,k,0,M&&!N?Rh(P,d,.35):P);let F=M?f:o;if(v(n,x,T,E,-A,-k,0,F),v(n,x,T,E,k,A,0,F),!N&&(v(r,x,T,E,-k+.25,-k+.5,.03,s),v(r,x,T,E,k-.5,k-.25,.03,s),x%8<3&&v(r,x,T,E,-.14,.14,.03,s),Math.abs(e.curv[D])>1/46)){let e=Math.floor(x/2)%2==0?m:h;v(r,x,T,E,-k-.75,-k+.1,.05,e),v(r,x,T,E,k-.1,k+.75,.05,e)}let te=Math.floor(x/3)%2==0?c:l;for(let t of[-1,1]){let i=t<0?j:ee,a=t*A,o=t*(A+Zh);if(!i)y(x,T,E,a,0,Xh,t<0,te),y(x,T,E,o,M?-1.1:-.7-(e.py[D]-e.base[D]),Xh,t>0,zh(te,.8)),t<0?v(n,x,T,E,o,a,Xh,u):v(n,x,T,E,a,o,Xh,u);else{let e=t<0?a:a-.45;v(r,x,T,E,e,e+.45,.04,x%2==0?g:_),y(x,T,E,a,-1.1,0,t>0,f)}}if(M){let e=j?-A:-A-Zh,t=ee?A:A+Zh;n.quad(this.P(x,T,t,-1.1),this.P(x,T,e,-1.1),this.P(x,E,e,-1.1),this.P(x,E,t,-1.1),f)}if(w&&b(x,.5,-A,A,-1.1-.6,0,!0,f),C&&b(x,.5,-A,A,-1.1-.6,0,!1,f),M&&!C&&!w&&x%14==7&&!(O&16)){let r=A+Zh+.5,i=!0,a=[];for(let t of[-1,1]){let n=this.P(x,0,t*r);a.push(n);for(let t=0;t<e.n;t+=2)Math.abs(ue(e,x,t))<24||e.py[t]<n[1]-2&&Math.hypot(e.px[t]-n[0],e.pz[t]-n[2])<e.wh[t]+1&&(i=!1)}if(i){let i=Math.atan2(e.tx[x],e.tz[x]),o=this.P(x,0,0);n.box(o[0],o[1]-Qh-.35,o[2],r*2+1.1,.7,1.1,p,i);for(let e of a){let r=Math.min(this.heightAt(e[0],e[2]),t.liquidY??1/0)-1.5,a=e[1]-Qh-.7;a>r&&n.box(e[0],(a+r)/2,e[2],1.1,a-r,1.1,p,i)}}}}let x=e.rh[0];for(let e=0;e<2;e++)for(let t=0;t<10;t++){let n=-x+2*x/10*t;v(r,e,0,1,n,n+2*x/10,.035,(e+t)%2==0?Q(16777215):_)}let S=new Os(n.build(),sm({vertexColors:!0})),C=new gs({vertexColors:!0,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-4});t.stars&&C.color.setScalar(.82);let w=new Os(r.build(),C);this.group.add(S,w),this.disposables.push(S.geometry,S.material,w.geometry,C),this.buildPads(),this.buildGantry()}buildPads(){let e=this.track;if(e.pads.length===0)return;let t=new Nh,n=[1,1,1];for(let r of e.pads)for(let e=0;e<r.length;e++){let i=r.seg+e;t.quadUv(this.P(i,0,r.lat-r.halfWidth,.05),this.P(i,0,r.lat+r.halfWidth,.05),this.P(i,1,r.lat+r.halfWidth,.05),this.P(i,1,r.lat-r.halfWidth,.05),n,0,e/2,1,(e+1)/2)}let r=ng(tg,{time:{value:0},c0:{value:new J(1095880)},c1:{value:new J(16773226)}});r.polygonOffset=!0,r.polygonOffsetFactor=-3,r.polygonOffsetUnits=-6,this.timed.push(r);let i=new Os(t.build(),r);this.group.add(i),this.disposables.push(i.geometry,r)}buildGantry(){let e=this.track,t=new Nh,n=e.wh[0]+Zh+1.6,r=Math.atan2(e.tx[0],e.tz[0]),i=Q(this.theme.wallCap),a=7.4;for(let e of[-1,1]){let o=this.P(0,0,e*n);t.box(o[0],o[1]+a/2,o[2],.7,a,.7,i,r)}let o=this.P(0,0,0);t.box(o[0],o[1]+a+.25,o[2],n*2+.7,.5,.9,i,r);let s=new Os(t.build(),sm({vertexColors:!0}));this.group.add(s),this.disposables.push(s.geometry,s.material);let c=Bh(e.def.name.toUpperCase(),{w:1024,h:128,bg:`#16131c`,fg:`#ffd23f`}),l=new Os(new yl(n*2,1.7),new gs({map:c,side:2}));l.position.set(o[0],o[1]+a-.9,o[2]),l.rotation.y=Math.atan2(-e.tx[0],-e.tz[0]),this.group.add(l),this.disposables.push(l.geometry,l.material,c)}insideLoop(e,t){let n=this.track,r=!1;for(let i=0,a=n.n-3;i<n.n;a=i,i+=3){let o=n.pz[i],s=n.pz[a];o>t!=s>t&&e<(n.px[a]-n.px[i])*(t-o)/(s-o)+n.px[i]&&(r=!r)}return r}heightAt(t,n){let r=this.track,i=this.theme;if(i.rough===0&&i.liquidY===null&&r.def.theme===`nacht`)return i.farY;let a=-1,o=1/0;for(let e of this.nonDeck){let i=t-r.px[e],s=n-r.pz[e],c=i*i+s*s;c<o&&(o=c,a=e)}let s=Math.sqrt(o),c=a<0?0:(t-r.px[a])*e(r,a)+(n-r.pz[a])*k(r,a),l=a<0?0:r.wh[a],u=a<0?i.farY:r.base[a]+Math.max(-l,Math.min(l,c))*r.bank[a]-.3,d;if(i.liquidY===null)d=i.farY;else{let e=0,a=0;for(let i of this.idwSegs){let o=t-r.px[i],s=n-r.pz[i],c=1/(o*o+s*s+60)**1.5;e+=c*r.py[i],a+=c}let o=a>0?e/a:i.farY;this.insideLoop(t,n)?(d=o-.6,r.def.theme===`glut`&&o>7&&(d-=Math.min(o-i.liquidY+3,Math.max(0,s-16)*.9))):d=o+(i.farY-o)*Lh((s-22)/46);let c=d,l=0;for(let e=0;e<r.n;e+=2){if(!(r.edge[e]&8)||!(r.edge[e]&3))continue;let a=Math.hypot(t-r.px[e],n-r.pz[e]);if(a>36)continue;let o=1-Lh((a-11)/25);o>l&&(l=o,c=Math.max(i.farY,r.py[e]-10))}l>0&&c<d&&(d+=(c-d)*l)}let f=Lh((s-l-1.2)/24),p=(Ih(t*.045,n*.045)-.5)*2*i.rough+(Ih(t*.13+9,n*.13)-.5)*i.rough*.5;return u+(d+p-u)*f}buildTerrain(e,t,n,r){let i=this.theme,a=this.track,o=a.def.theme===`nacht`,s=o?0:150,c=this.detail===0?11:7.5,l=e-s,u=n-s,d=Math.max(1,Math.ceil((t-e+2*s)/c)),f=Math.max(1,Math.ceil((r-n+2*s)/c));if(!o){let e=new Float32Array((d+1)*(f+1));for(let t=0;t<=f;t++)for(let n=0;n<=d;n++){let r=Math.min(n,d-n,t,f-t)/5,a=this.heightAt(l+n*c,u+t*c);e[t*(d+1)+n]=i.farY+(a-i.farY)*Lh(r)}let t=new Nh,n=i.ground.map(e=>Q(e)),r=Ph(77+a.index),o=(t,n)=>[l+t*c,e[n*(d+1)+t],u+n*c],s=i.liquidY??-1/0,p=(e,a,o)=>{if(Math.max(e[1],a[1],o[1])<s-2.5)return;let c=a[0]-e[0],l=a[1]-e[1],u=a[2]-e[2],d=o[0]-e[0],f=o[1]-e[1],p=o[2]-e[2],m=l*p-u*f,h=u*d-c*p,g=c*f-l*d,_=h/Math.hypot(m,h,g),v=(e[1]+a[1]+o[1])/3,y;y=_<.8?n[2]:i.liquidY!==null&&v<s+1.6?n[0]:v>12?Rh(n[1],n[3],Lh((v-12)/6)):i.liquidY===null?Rh(n[0],n[1],Ih(e[0]*.03,e[2]*.03)):n[1],t.tri(e,a,o,zh(y,.94+r()*.12))};for(let e=0;e<f;e++)for(let t=0;t<d;t++){let n=o(t,e),r=o(t+1,e),i=o(t+1,e+1),a=o(t,e+1);(t+e)%2==0?(p(n,a,i),p(n,i,r)):(p(n,a,r),p(r,a,i))}let m=new Os(t.build(),sm({vertexColors:!0}));this.group.add(m),this.disposables.push(m.geometry,m.material)}let p=new yl(9e3,9e3);p.rotateX(-Math.PI/2);let m;if(i.liquidY!==null){let e=ng(eg,{time:{value:0},c0:{value:new J(i.liquid[0])},c1:{value:new J(i.liquid[1])},c2:{value:new J(i.liquid[2])}});this.timed.push(e),m=e}else m=new gs({color:i.ground[0]}),m.color.multiplyScalar(o?1:.86);let h=new Os(p,m);h.position.set(this.center.x,i.liquidY??i.farY-.08,this.center.z),this.group.add(h),this.disposables.push(p,m)}buildSky(){let e=this.theme,t=2600,n=new bl(t,24,14),r=n.getAttribute(`position`),i=new Float32Array(r.count*3),a=Q(e.sky[0]),o=Q(e.sky[1]),s=Q(e.sky[2]);for(let e=0;e<r.count;e++){let n=r.getY(e)/t,c=n>.12?Rh(o,a,Lh((n-.12)/.55)):Rh(s,o,Lh((n+.04)/.16));i.set(c,e*3)}n.setAttribute(`color`,new wo(i,3));let c=new gs({vertexColors:!0,side:1,fog:!1,depthWrite:!1}),l=new Os(n,c);l.renderOrder=-10,this.skyGroup.add(l),this.disposables.push(n,c);let u=new G(e.sunDir[0],e.sunDir[1],e.sunDir[2]).normalize(),d=new gs({color:e.disc,fog:!1,depthWrite:!1}),f=new Os(new xc(e.discSize*3.2,28),d);if(f.position.copy(u).multiplyScalar(t*.92),f.lookAt(0,0,0),f.renderOrder=-9,this.skyGroup.add(f),this.disposables.push(f.geometry,d),e.stars){let e=Ph(5),n=new Float32Array(1080);for(let r=0;r<360;r++){let i=e()*Math.PI*2,a=.08+e()*.9,o=Math.sqrt(1-a*a);n.set([Math.cos(i)*o*t*.95,a*t*.95,Math.sin(i)*o*t*.95],r*3)}let r=new Ro;r.setAttribute(`position`,new wo(n,3));let i=new sc({color:16777215,size:2.2,sizeAttenuation:!1,fog:!1,depthWrite:!1,transparent:!0,opacity:.85}),a=new fc(r,i);a.renderOrder=-9,this.skyGroup.add(a),this.disposables.push(r,i)}else{let t=new Nh;for(let n=0;n<14;n++){let r=n/14*Math.PI*2,i=e.discSize*3.9,a=e.discSize*(n%2==0?6.4:5.2),o=.09;t.tri([Math.cos(r-o)*i,Math.sin(r-o)*i,0],[Math.cos(r+o)*i,Math.sin(r+o)*i,0],[Math.cos(r)*a,Math.sin(r)*a,0],[1,1,1])}let n=new gs({color:e.disc,fog:!1,depthWrite:!1,side:2,transparent:!0,opacity:.7}),r=new Os(t.build(),n);r.position.copy(f.position),r.quaternion.copy(f.quaternion),r.renderOrder=-9,r.name=`rays`,this.skyGroup.add(r),this.disposables.push(r.geometry,n)}let p=Ph(31+this.track.index),m=this.detail===0?7:12,h=new gl(1,1),g=new Nh,_=Q(e.clouds),v=Q(e.cloudShade),y=new q;for(let e=0;e<m;e++){let t=e/m*Math.PI*2+p()*.4,n=900+p()*700,r=190+p()*300,i=55+p()*60,a=3+Math.floor(p()*3);for(let e=0;e<a;e++){let o=i*(.6+p()*.5),s=(e-(a-1)/2)*i*.8;y.compose(new G(Math.cos(t)*n-Math.sin(t)*s,r+(p()-.5)*i*.25,Math.sin(t)*n+Math.cos(t)*s),new zi,new G(o,o*.55,o)),g.add(h,e%2==0?_:Rh(_,v,.35),y)}}h.dispose();let b=fm(g.build()),x=new gs({vertexColors:!0,fog:!1}),S=new Os(b,x);if(this.clouds.add(S),this.detail>0){let e=new Os(b,dm(1.1));e.material.fog=!1,e.name=`outline`,this.clouds.add(e)}this.skyGroup.add(this.clouds),this.disposables.push(b,x),this.group.add(this.skyGroup)}buildBoxes(){let e=this.track.boxes.length;if(e===0)return;let t=document.createElement(`canvas`);t.width=t.height=128;let n=t.getContext(`2d`);n.fillStyle=`#ffd23f`,n.fillRect(0,0,128,128),n.strokeStyle=`#16131c`,n.lineWidth=12,n.strokeRect(6,6,116,116),n.fillStyle=`#16131c`,n.beginPath(),n.moveTo(74,18),n.lineTo(34,70),n.lineTo(58,70),n.lineTo(48,110),n.lineTo(94,54),n.lineTo(68,54),n.closePath(),n.fill();let r=new hc(t);r.colorSpace=ui;let i=fm(new yc(1.25,1.25,1.25)),a=new gs({map:r});this.boxMesh=new ec(i,a,e),this.boxMesh.frustumCulled=!1,this.group.add(this.boxMesh),this.detail>0&&(this.boxOutline=new ec(i,dm(.07),e),this.boxOutline.frustumCulled=!1,this.boxOutline.name=`outline`,this.group.add(this.boxOutline)),this.disposables.push(i,a,r)}update(e,t,n,r){for(let t of this.timed)t.uniforms.time.value=e;this.skyGroup.position.set(n.x,0,n.z),this.clouds.rotation.y=e*.004;let i=this.skyGroup.getObjectByName(`rays`);if(i&&i.rotateZ(t*.05),this.boxMesh){let n=this.track.boxes;for(let i=0;i<n.length;i++){let a=r>>>i&1?1:0,o=this.boxScale[i];this.boxScale[i]=a===0?0:Math.min(1,o+t*3.2);let s=this.boxScale[i],c=s<1?s*(1+.35*Math.sin(s*Math.PI)):1,l=n[i];this.v.set(l.x,l.y+1.15+Math.sin(e*2.2+i*1.7)*.14,l.z),this.euler.set(.5,e*1.4+i,.35),this.q.setFromEuler(this.euler),this.s.setScalar(c),this.m4.compose(this.v,this.q,this.s),this.boxMesh.setMatrixAt(i,this.m4),this.boxOutline?.setMatrixAt(i,this.m4)}this.boxMesh.instanceMatrix.needsUpdate=!0,this.boxOutline&&(this.boxOutline.instanceMatrix.needsUpdate=!0)}}dispose(){for(let e of this.disposables)e.dispose();this.boxMesh?.dispose(),this.boxOutline?.dispose()}},ig=[{ratio:1,kart:0,world:0,particles:220,skid:!1},{ratio:1.5,kart:1,world:1,particles:420,skid:!0},{ratio:2,kart:2,world:2,particles:640,skid:!0}],ag=[13620198,4190946,16769098,16734930];function og(e){for(;e>Math.PI;)e-=2*Math.PI;for(;e<-Math.PI;)e+=2*Math.PI;return e}function sg(e,t){let n=document.createElement(`canvas`);n.width=256,n.height=64;let r=n.getContext(`2d`);r.font=`900 34px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`,r.textAlign=`center`,r.textBaseline=`middle`,r.lineJoin=`round`,r.lineWidth=9,r.strokeStyle=`#16131c`;let i=e.length>13?`${e.slice(0,12)}…`:e;r.strokeText(i,128,34),r.fillStyle=t,r.fillText(i,128,34);let a=new hc(n);a.colorSpace=ui;let o=new ls(new Yo({map:a,transparent:!0,depthWrite:!1,fog:!1}));return o.scale.set(3.6,.9,1),o.renderOrder=15,o}var cg=class{constructor(e,t=`auto`){T(this,`canvas`,void 0),T(this,`cameraMode`,`chase`),T(this,`smoke`,0),T(this,`onEvent`,null),T(this,`stats`,{fps:60,calls:0,triangles:0,level:1,scale:1,ratio:1}),T(this,`renderer`,void 0),T(this,`scene`,new Wa),T(this,`camera`,new mu(62,1.6,.3,4200)),T(this,`world`,null),T(this,`things`,null),T(this,`track`,s),T(this,`karts`,new Map),T(this,`drivers`,[]),T(this,`puffs`,void 0),T(this,`sparks`,void 0),T(this,`skids`,void 0),T(this,`pops`,new em),T(this,`speedLines`,new nm),T(this,`shadows`,new rm(24)),T(this,`quality`,void 0),T(this,`level`,1),T(this,`scale`,1),T(this,`frameTimes`,0),T(this,`frameCount`,0),T(this,`lastDrop`,0),T(this,`smoothSeconds`,0),T(this,`triedHigh`,!1),T(this,`highFailed`,!1),T(this,`time`,0),T(this,`camYaw`,0),T(this,`camPos`,new G),T(this,`camLook`,new G),T(this,`camFov`,62),T(this,`camReady`,!1),T(this,`shake`,0),T(this,`hitstop`,0),T(this,`orbit`,0),T(this,`raceId`,-1),T(this,`needsCompile`,!0),T(this,`color`,new J),T(this,`v1`,new G),T(this,`v2`,new G),T(this,`q1`,new zi),T(this,`e1`,new _a(0,0,0,`YXZ`)),T(this,`flat`,new zi),this.canvas=e,this.renderer=new Kp({canvas:e,antialias:window.devicePixelRatio<1.5,powerPreference:`high-performance`}),this.renderer.outputColorSpace=ui,this.quality=t,this.level=t===`low`?0:t===`high`?2:1;let n=ig[2].particles;this.puffs=new Xp(n,!1),this.sparks=new Xp(Math.round(n*.7),!0),this.skids=new Zp(520),this.scene.add(this.camera,this.puffs.points,this.sparks.points,this.skids.mesh,this.pops.group,this.shadows.mesh),this.camera.add(this.speedLines.mesh),window.addEventListener(`resize`,()=>this.resize()),this.resize()}setTrack(){if(this.world&&this.track===s)return;this.disposeWorld(),this.track=s;let e=ig[this.level];this.world=new rg(s,e.world),this.things=new Vh(s,this.level>0),this.scene.add(this.world.group,this.things.group),this.scene.fog=this.world.fog,this.scene.background=new J(this.world.theme.sky[2]),this.camReady=!1,this.needsCompile=!0,this.pops.prewarm(this.renderer,[[`ZISCH!`,`warm`],[`WUSCH!`,`cool`],[`WUSCH!`,`violet`],[`KRACH!`,`hot`],[`RUMMS!`,`white`],[`PLUMPS!`,`white`],[`BOING!`,`cool`],[`KLONK!`,`white`],[`BZZZT!`,`violet`],[`ZIEL!`,`warm`]]),this.applyLevel()}disposeWorld(){this.world&&(this.scene.remove(this.world.group),this.world.dispose(),this.world=null),this.things&&(this.scene.remove(this.things.group),this.things.dispose(),this.things=null),this.skids.clear(),this.puffs.clear(),this.sparks.clear(),this.pops.clear()}reset(){this.raceId=-1,this.camReady=!1,this.cameraMode=`chase`,this.shake=0,this.hitstop=0,this.smoke=0,this.skids.clear(),this.puffs.clear(),this.sparks.clear(),this.pops.clear(),this.things?.clear();for(let e of this.karts.values())e.fresh=!0}setRoster(e){this.drivers=e;for(let[t,n]of this.karts){let r=e.find(e=>e.slot===t);r?n.label&&n.label.name!==r.name&&(this.scene.remove(n.label),n.label.material.map?.dispose(),n.label.material.dispose(),n.label=null):(this.scene.remove(n.visual.root),n.label&&this.scene.remove(n.label),n.visual.dispose(),this.karts.delete(t))}}setQuality(e){this.quality=e,e!==`auto`&&(this.level=e===`low`?0:e===`high`?2:1,this.scale=1),this.applyLevel()}applyLevel(){let e=ig[this.level];this.stats.level=this.level;for(let t of this.karts.values())t.visual.setDetail(e.kart);this.needsCompile=!0,this.things&&mm(this.things.group,this.level>0),this.skids.mesh.visible=e.skid,this.resize()}resize(){let e=this.canvas.clientWidth||window.innerWidth,t=this.canvas.clientHeight||window.innerHeight,n=Math.min(window.devicePixelRatio||1,ig[this.level].ratio)*this.scale;this.stats.ratio=n,this.stats.scale=this.scale,this.renderer.setPixelRatio(n),this.renderer.setSize(e,t,!1),this.camera.aspect=e/Math.max(1,t),this.camera.updateProjectionMatrix(),this.puffs.setViewport(t*n,this.camera.fov),this.sparks.setViewport(t*n,this.camera.fov)}kartView(e){let t=this.karts.get(e);if(t)return t;let n=new Mh(e,ig[this.level].kart);return n.root.rotation.order=`YXZ`,this.scene.add(n.root),this.needsCompile=!0,t={slot:e,visual:n,label:null,pose:{speed:0,steer:0,driftDir:0,driftStage:0,boost:!1,air:!1,spin:0,guard:!1,stall:!1,offroad:!1,emote:`none`},seen:!0,fresh:!0,steer:0,pitch:0,roll:0,lastHeading:0,airTime:0,spin:0,boost:0,stall:0,guard:0,respawn:0,roulette:0,item:0,flags:0,driftDir:0,driftStage:0,finished:!1,wallCooldown:0,bumpCooldown:0,rl:new G,rr:new G,hasTrail:!1,audio:{slot:e,local:!1,speed:0,throttle:!1,boost:!1,drift:0,offroad:!1,air:!1,stall:!1,distance:0,pan:0}},this.karts.set(e,t),t}emit(e,t,n){if(!this.onEvent)return;let r=n?1:Math.max(0,1-t.audio.distance/70);r<=.02||this.onEvent({kind:e,slot:t.slot,local:n,pan:n?0:t.audio.pan,gain:r})}pop(e,t,n,r=3.4){this.pops.show(e,t.x,t.y+2.6,t.z,n,r)}burst(e,t,n,r,i,a,o,s=.5,c=.6,l=3){this.color.set(a);let u=o?this.sparks:this.puffs;for(let a=0;a<r;a++){let r=Math.random()*Math.PI*2,a=i*(.4+Math.random()*.6);u.emit(e,t,n,Math.cos(r)*a,l*(.3+Math.random()),Math.sin(r)*a,c*(.6+Math.random()*.6),s*(.7+Math.random()*.6),this.color,o?-s:s*1.2,o?9:4,1.5)}}detect(e,t,n,r){let i=!!(t.flags&8),a=!!(e.flags&8),o=t.driftDir===0?0:v(t.driftCharge);if(!e.fresh){if(t.spin>0&&e.spin===0&&(this.pop(`KRACH!`,t,`hot`,4.2),this.burst(t.x,t.y+1,t.z,16,9,16765503,!0,.7,.7,6),this.burst(t.x,t.y+.6,t.z,8,5,15329010,!1,.9,.7),e.visual.squash(1),this.emit(`hit`,e,n),n&&(this.hitstop=.085,this.shake=Math.max(this.shake,.6))),t.boost>0&&t.boost>e.boost+20){let r=e.driftDir===0?0:Math.max(1,e.driftStage);this.pop(r?`WUSCH!`:`ZISCH!`,t,r===3?`violet`:r?`cool`:`warm`,2.6+r*.35),e.visual.squash(-.8),this.emit(r===3?`turbo3`:r===2?`turbo2`:r===1?`turbo1`:`boost`,e,n),n&&(this.shake=Math.max(this.shake,.18))}if(t.driftDir!==0&&e.driftDir===0&&this.emit(`drift-start`,e,n),!i&&a&&t.respawn===0&&e.respawn===0&&(e.airTime>.28&&(this.burst(t.x,t.y+.2,t.z,9,6,14274496,!1,.5,.45,1.5),e.visual.squash(Math.min(1.2,.4+e.airTime)),this.emit(`land`,e,n),n&&(this.shake=Math.max(this.shake,Math.min(.45,e.airTime*.4)))),e.airTime>.75&&this.pop(`PLUMPS!`,t,`white`,3)),t.respawn>0&&e.respawn===0){let t=this.track.def.theme,r=e.visual.root.position;this.pops.show(t===`klippe`?`PLATSCH!`:t===`glut`?`ZSSSCH!`:`HUCH!`,r.x,r.y+5,r.z,t===`glut`?`hot`:`cool`,4.4),this.burst(r.x,r.y+1.5,r.z,18,7,t===`glut`?16751135:13235455,t===`glut`,.9,.9,9),this.emit(`fall`,e,n),e.hasTrail=!1}if(t.respawn===0&&e.respawn>0&&this.emit(`respawn`,e,n),t.stall>0&&e.stall===0&&(this.pop(`BZZZT!`,t,`violet`,3.6),this.burst(t.x,t.y+1,t.z,12,6,12167423,!0,.5,.5,4),this.emit(`stall`,e,n),n&&(this.shake=Math.max(this.shake,.3))),t.guard===0&&e.guard>30&&(this.pop(`KLONK!`,t,`white`,3.6),this.burst(t.x,t.y+1,t.z,10,8,14673650,!0,.6,.5,4),this.emit(`guard-block`,e,n)),t.guard>e.guard+60&&this.emit(`use-guard`,e,n),t.roulette>0&&e.roulette===0&&(this.burst(t.x,t.y+1.2,t.z,12,8,16769098,!0,.3,.45,5),this.emit(`pickup`,e,n)),t.roulette===0&&e.roulette>0&&t.item!==0&&this.emit(`item-ready`,e,n),t.item===0&&e.item!==0&&e.roulette===0&&(e.item===2?(this.pop(`HUI!`,t,`white`,2.6),this.emit(`use-tire`,e,n)):e.item===3?(this.pop(`PLATSCH!`,t,`violet`,2.8),this.emit(`use-oil`,e,n)):e.item===4?(this.pop(`BRRRM!`,t,`hot`,2.8),this.emit(`use-top`,e,n)):e.item===7?(this.pop(`PUFF!`,t,`white`,3),this.emit(`use-smoke`,e,n)):e.item===6?(this.pop(`KLACK!`,t,`violet`,2.6),this.emit(`use-emp`,e,n)):e.item===8&&(this.pop(`BOING!`,t,`cool`,3.2),e.visual.squash(-1),this.emit(`use-spring`,e,n))),t.flags&4&&!(e.flags&4)&&e.wallCooldown<=0&&Math.hypot(t.vx,t.vz)>9&&(e.wallCooldown=.5,this.burst(t.x,t.y+.6,t.z,6,5,16771496,!0,.4,.3,2),this.emit(`wall`,e,n),n&&(this.shake=Math.max(this.shake,.2))),t.finished&&!e.finished){this.pop(`ZIEL!`,t,`warm`,4.6);for(let e of re)this.burst(t.x,t.y+2,t.z,9,8,parseInt(e.slice(1),16),!1,.4,1.4,9);this.emit(`finish`,e,n)}}e.airTime=i?e.airTime+r:0,e.spin=t.spin,e.boost=t.boost,e.stall=t.stall,e.guard=t.guard,e.respawn=t.respawn,e.roulette=t.roulette,e.item=t.item,e.flags=t.flags,e.driftDir=t.driftDir,e.driftStage=o,e.finished=t.finished,e.fresh=!1,e.wallCooldown>0&&(e.wallCooldown-=r),e.bumpCooldown>0&&(e.bumpCooldown-=r)}frame(t,n,r,i,a){if(!this.world||!this.things)return;let o=this.track;if(this.measure(r),this.hitstop>0){this.hitstop-=r,this.applyShake(r),this.renderer.render(this.scene,this.camera);return}if(this.time+=r,i.raceId!==this.raceId){this.raceId=i.raceId,this.skids.clear(),this.pops.clear(),this.camReady=!1;for(let e of this.karts.values())e.fresh=!0}for(let e of this.karts.values())e.seen=!1;this.shadows.begin();let s=null,c=null;for(let a of t){let l=a.slot===n,u=this.kartView(a.slot);u.seen=!0;let d=Math.hypot(a.vx,a.vz),f=Math.sin(a.heading),p=Math.cos(a.heading),h=a.vx*f+a.vz*p,g=!!(a.flags&8);m(o,a.x,a.z,a.seg);let _=S.seg,y=x(o,_,S.along,S.lat),b=(_-1+o.n)%o.n,C=(_+1)%o.n,w=(o.py[C]-o.py[b])/(2*o.step),T=w*o.tx[_]+o.bank[_]*e(o,_),E=w*o.tz[_]+o.bank[_]*k(o,_),D=-Math.atan(T*f+E*p),O=-Math.atan(T*-p+E*f),A=D,j=O;g&&(A=a.respawn>0?0:-Math.atan2(a.vy,Math.max(8,d))*.55,j=0);let ee=Math.min(1,r*(g?5:14));u.fresh&&(u.pitch=A,u.roll=j,u.lastHeading=a.heading),u.pitch+=(A-u.pitch)*ee,u.roll+=(j-u.roll)*ee;let M=r>0?og(a.heading-u.lastHeading)/r:0;u.lastHeading=a.heading;let N=Math.max(-1,Math.min(1,-M/1.6*(h<0?-1:1)));u.steer+=(N-u.steer)*Math.min(1,r*12);let P=u.pose;P.speed=h,P.steer=u.steer,P.driftDir=a.driftDir,P.driftStage=a.driftDir===0?0:v(a.driftCharge),P.boost=a.boost>0,P.air=g,P.spin=a.spin>0?1-a.spin/75:0,P.guard=a.guard>0&&(a.guard>90||Math.floor(this.time*10)%2==0),P.stall=a.stall>0,P.offroad=!!(a.flags&2),P.emote=a.finished?a.place<=1||t.length>2&&a.place<=2?`win`:`lose`:`none`,this.v1.set(a.x,a.y,a.z).sub(this.camera.position);let F=this.v1.length();this.v2.set(1,0,0).applyQuaternion(this.camera.quaternion),u.audio.local=l,u.audio.speed=Math.abs(h)/26,u.audio.throttle=!a.finished&&i.phase!==0&&a.spin===0,u.audio.boost=a.boost>0,u.audio.drift=a.driftDir===0?0:Math.max(.5,P.driftStage),u.audio.offroad=P.offroad,u.audio.air=g,u.audio.stall=a.stall>0,u.audio.distance=F,u.audio.pan=F>.5?Math.max(-1,Math.min(1,this.v1.dot(this.v2)/F)):0,this.detect(u,a,l,r);let te=u.visual.root;if(te.position.set(a.x,a.y,a.z),te.rotation.set(u.pitch,a.heading,u.roll),te.visible=!(a.shield>0&&a.spin===0&&a.respawn===0&&Math.floor(this.time*14)%2==0),u.visual.update(r,P),y!==-1e6&&a.respawn===0&&(this.e1.set(D,a.heading,O),this.q1.setFromEuler(this.e1),this.shadows.add(a.x,y,a.z,this.q1,2.5,a.y-y)),this.trail(u,a,d,g,P.driftStage,r),l)s=a,c=u;else{if(!u.label){let e=this.drivers.find(e=>e.slot===a.slot);u.label=sg(e?.name??`Fahrer ${a.slot+1}`,re[a.slot%re.length]),u.label.name=e?.name??``,this.scene.add(u.label)}let e=Math.max(.5,Math.min(1.7,F/20));u.label.scale.set(3.6*e,.9*e,1),u.label.position.set(a.x,a.y+2.5+e*.4,a.z),u.label.visible=F<90&&F>8}}for(let e of this.karts.values())e.seen||(e.visual.root.visible=!1,e.label&&(e.label.visible=!1),e.fresh=!0);this.bumps(t,n),this.things.update(a,r,this.time),this.things.updateHazards(i.hostTick,this.time);let l=0;this.flat.identity();for(let e of a)if(e.kind===1||e.kind===3)this.shadows.add(e.x,e.y-(e.kind===3?.6:.8),e.z,this.flat,1.6,0),e.kind===3&&Math.random()<r*40&&(this.color.set(16769098),this.sparks.emit(e.x,e.y,e.z,(Math.random()-.5)*3,1+Math.random()*2,(Math.random()-.5)*3,.35,.35,this.color,-.6,2,1));else if(e.kind===4&&s){let t=Math.hypot(e.x-s.x,e.z-s.z);Math.abs(e.y-s.y)<5&&(l=Math.max(l,Math.min(1,(9.5-t)/3.5)*Math.min(1,e.ttl)))}for(let e of this.things.hazards)this.shadows.add(e.position.x,e.position.y,e.position.z,this.flat,3.4,0);this.shadows.end(),this.smoke+=(Math.max(0,l)-this.smoke)*Math.min(1,r*8),this.puffs.update(r),this.sparks.update(r),this.pops.update(r),this.updateCamera(s,c,i,r);let u=s?s.boost>0?1:Math.hypot(s.vx,s.vz)>26*1.08?.45:0:0;this.speedLines.update(r,this.time,u,this.camera.aspect),this.world.update(this.time,r,this.camera.position,i.boxes),this.needsCompile&&(this.needsCompile=!1,this.renderer.compile(this.scene,this.camera)),this.renderer.render(this.scene,this.camera),this.stats.calls=this.renderer.info.render.calls,this.stats.triangles=this.renderer.info.render.triangles}trail(e,t,n,r,i,a){let o=e.visual.root;o.updateMatrixWorld();let s=e.visual.anchors,c=this.v1.copy(s.wheelRearL).applyMatrix4(o.matrixWorld),l=this.v2.copy(s.wheelRearR).applyMatrix4(o.matrixWorld),u=t.driftDir!==0&&!r,d=ig[this.level],f=d.particles/ig[2].particles;if(u){let n=(i===0?30:55+i*25)*f*a;this.color.set(ag[i]);for(let e of[c,l])Math.random()<n&&this.sparks.emit(e.x,e.y+.05,e.z,-t.vx*.25+(Math.random()-.5)*4,1.5+Math.random()*3.5,-t.vz*.25+(Math.random()-.5)*4,.22+Math.random()*.2,.28+i*.07,this.color,-.5,12,1);if(d.skid&&e.hasTrail&&(this.skids.add(e.rl.x,e.rl.y,e.rl.z,c.x,c.y,c.z,.3),this.skids.add(e.rr.x,e.rr.y,e.rr.z,l.x,l.y,l.z,.3)),Math.random()<16*f*a){this.color.set(15329010);let e=Math.random()<.5?c:l;this.puffs.emit(e.x,e.y+.15,e.z,t.vx*.5+(Math.random()-.5)*2,.8+Math.random(),t.vz*.5+(Math.random()-.5)*2,.32,.26,this.color,.9,-.5,3,.7)}}if(e.rl.copy(c),e.rr.copy(l),e.hasTrail=u,!r&&t.flags&2&&n>6&&Math.random()<26*f*a){this.color.set(this.world.theme.shoulder).multiplyScalar(.9);let e=Math.random()<.5?c:l;this.puffs.emit(e.x,e.y+.15,e.z,t.vx*.4+(Math.random()-.5)*3,1.5+Math.random()*2,t.vz*.4+(Math.random()-.5)*3,.4,.3,this.color,1,4,2,.9)}if(t.boost>0&&Math.random()<90*f*a){let e=(Math.random()<.5?this.v1.copy(s.exhaustL):this.v1.copy(s.exhaustR)).applyMatrix4(o.matrixWorld);this.color.set(Math.random()<.5?16747050:16765503),this.sparks.emit(e.x,e.y,e.z,t.vx*.55+(Math.random()-.5)*1.5,Math.random()*1.2,t.vz*.55+(Math.random()-.5)*1.5,.16,.3,this.color,-1.2,0,1)}t.stall>0&&Math.random()<14*a&&(this.color.set(4867668),this.puffs.emit(t.x,t.y+1.1,t.z,(Math.random()-.5)*1.5,2.2,(Math.random()-.5)*1.5,.8,.4,this.color,1.2,-1,1,.85))}bumps(e,t){for(let n=0;n<e.length;n++)for(let r=n+1;r<e.length;r++){let i=e[n],a=e[r];if(Math.abs(i.y-a.y)>1.6||i.respawn>0||a.respawn>0)continue;let o=a.x-i.x,s=a.z-i.z,c=Math.hypot(o,s);if(c>2.2||c<.001)continue;let l=((i.vx-a.vx)*o+(i.vz-a.vz)*s)/c,u=this.karts.get(i.slot),d=this.karts.get(a.slot);if(!u||!d||l<2.2||u.bumpCooldown>0||d.bumpCooldown>0)continue;u.bumpCooldown=d.bumpCooldown=.45;let f=i.slot===t||a.slot===t;this.burst((i.x+a.x)/2,(i.y+a.y)/2+.7,(i.z+a.z)/2,9,6,16771496,!0,.45,.35,3),l>6&&this.pops.show(`RUMMS!`,(i.x+a.x)/2,i.y+2.4,(i.z+a.z)/2,`white`,2.8),u.visual.squash(.4),d.visual.squash(.4),this.emit(`bump`,i.slot===t?u:d,f),f&&(this.shake=Math.max(this.shake,.25))}}updateCamera(e,t,n,r){let i=this.camera,a=this.world,o=this.track;if(this.cameraMode===`top`||!e||!t){let e=a.radius*1.5;i.position.set(a.center.x,e,a.center.z-e*.55),i.lookAt(a.center.x,0,a.center.z),i.fov=55,i.updateProjectionMatrix(),this.camReady=!1;return}let s=Math.hypot(e.vx,e.vz),c=Math.min(1.4,s/26),l=s>4?Math.atan2(e.vx,e.vz):e.heading;(e.spin>0||e.respawn>0)&&(l=this.camYaw),this.camReady||(this.camYaw=e.heading),this.camYaw+=og(l-this.camYaw)*Math.min(1,r*(e.driftDir===0?5.5:3.2));let u=n.phase===0?Math.max(0,Math.min(1,(n.untilGo-3.1)/2.3)):0,d=e.finished||n.phase===2,f=this.camYaw,p=5.3+c*1.1,h=2.45+c*.25,g=3.2;if(u>0){let t=u*u*(3-2*u);m(o,e.x,e.z,e.seg),f+=t*2.5*(S.lat<0?1:-1),p+=t*5,h+=t*2.2,g*=1-t}else d?(this.orbit+=r*.5,f=e.heading+Math.PI+Math.sin(this.orbit)*1.1,p=8.4,h=2.7,g=0):this.orbit=0;let _=Math.sin(f),v=Math.cos(f),y=e.seg%o.n,b=(y+6)%o.n,C=Math.max(-2.5,Math.min(2.5,o.py[b]-o.py[y])),w=!!(e.flags&8),T=e.x-_*p,E=e.z-v*p,D=e.y+h-C*.25;m(o,T,E,e.seg);let O=x(o,S.seg,S.along,S.lat);O!==-1e6&&D<O+1.3&&(D=O+1.3),this.camReady||(this.camPos.set(T,D,E),this.camLook.set(e.x,e.y+1.1,e.z),this.camReady=!0);let k=Math.min(1,r*(u>0||d?4:13));this.camPos.x+=(T-this.camPos.x)*k,this.camPos.z+=(E-this.camPos.z)*k,this.camPos.y+=(D-this.camPos.y)*Math.min(1,r*(w?3.2:7)),this.camLook.x+=(e.x+_*g-this.camLook.x)*Math.min(1,r*14),this.camLook.z+=(e.z+v*g-this.camLook.z)*Math.min(1,r*14),this.camLook.y+=(e.y+1.15+C*.4-this.camLook.y)*Math.min(1,r*9),i.position.copy(this.camPos),i.lookAt(this.camLook),i.rotateZ(-t.steer*.035*Math.min(1,c)-e.driftDir*.03),this.applyShake(r);let A=60+c*7+(e.boost>0?9:0);this.camFov+=(A-this.camFov)*Math.min(1,r*5),Math.abs(i.fov-this.camFov)>.05&&(i.fov=this.camFov,i.updateProjectionMatrix())}applyShake(e){if(this.shake<=.002)return;let t=this.shake;this.camera.position.x+=(Math.random()-.5)*t,this.camera.position.y+=(Math.random()-.5)*t*.8,this.camera.rotateZ((Math.random()-.5)*t*.06),this.shake*=Math.exp(-e*9)}measure(e){if(this.frameTimes+=e,this.frameCount++,this.frameTimes<1)return;let t=this.frameCount/this.frameTimes;if(this.stats.fps=t,this.frameTimes=0,this.frameCount=0,this.quality!==`auto`)return;let n=this.time;t<50?(this.scale>.62?this.scale=Math.max(.6,this.scale-(t<38?.2:.1)):this.level>0&&(this.level--,this.scale=.85,this.applyLevel()),this.lastDrop=n,this.resize(),this.triedHigh&&(this.highFailed=!0)):t>57.5&&n-this.lastDrop>8&&this.scale<1?(this.scale=Math.min(1,this.scale+.05),this.resize()):t>58.5&&this.scale>=1&&this.level===1&&!this.highFailed&&n-this.lastDrop>12&&++this.smoothSeconds>12&&(this.level=2,this.triedHigh=!0,this.smoothSeconds=0,this.applyLevel()),t<=58.5&&(this.smoothSeconds=0)}kartAudio(e){e.length=0;for(let t of this.karts.values())t.seen&&e.push(t.audio);return e}},lg=8e3,ug=class{constructor(e){T(this,`getInfo`,void 0),T(this,`input`,new gn),T(this,`link`,null),T(this,`info`,{tilt:!1,sensorHz:0,sendHz:0}),T(this,`path`,null),T(this,`buildMismatch`,!1),T(this,`onChange`,null),T(this,`cid`,null),T(this,`lastInfoJson`,``),this.getInfo=e}get connected(){return this.link!==null&&this.link.state===`open`}get rtt(){return this.link?this.link.rtt:-1}accept(e){let t=window.setTimeout(()=>e.close(),lg);e.onClose=()=>window.clearTimeout(t),e.onMessage=n=>{let r=n;r.t===`hello`&&(window.clearTimeout(t),r.v===3?(this.buildMismatch=typeof r.build==`string`&&r.build!==`261110-1052`,this.adopt(e,String(r.cid??``))):(this.sendTo(e,{t:`reject`,reason:`version`}),window.setTimeout(()=>e.close(),400)))}}pushInfo(e=!1){if(!this.link||this.link.state!==`open`)return;let t=this.getInfo(),n=JSON.stringify(t);(e||n!==this.lastInfoJson)&&(this.lastInfoJson=n,this.sendTo(this.link,{t:`paired`,...t,build:N}))}sendHud(e){this.link&&this.link.state===`open`&&this.sendTo(this.link,{t:`hud`,...e})}sendFx(e){this.link&&this.link.state===`open`&&this.sendTo(this.link,{t:`fx`,k:e})}async refreshPath(){this.path=this.link?await this.link.getPath():null}sendTo(e,t){e.send(t)}adopt(e,t){let n=this.link;n&&n!==e&&(n.onClose=null,n.onMessage=null,n.onFast=null,t!==this.cid&&this.sendTo(n,{t:`replaced`}),window.setTimeout(()=>n.close(),400)),this.link=e,this.cid=t,this.path=null,this.input.reset(),this.info={tilt:!1,sensorHz:0,sendHz:0},e.onFast=e=>{e.getUint8(0)===16&&this.input.onPacket(e)},e.onMessage=t=>{let n=t;n.t===`press`?this.input.onItemPress(Number(n.n)||0):n.t===`info`?this.info={tilt:!!n.tilt,sensorHz:Number(n.sensorHz)||0,sendHz:Number(n.sendHz)||0}:n.t===`bye`&&e.close()},e.onClose=()=>{this.link===e&&(this.link=null,this.path=null,this.input.reset(),this.onChange?.())},this.pushInfo(!0),this.onChange?.()}},dg=new Set([`hit`,`bump`,`boost`,`turbo2`,`turbo3`,`fall`,`land`,`guard-block`,`stall`,`use-tire`,`use-oil`,`use-top`,`use-emp`,`use-smoke`,`use-spring`]),fg=class{constructor(e,t){T(this,`engine`,void 0),T(this,`none`,[]),T(this,`lastCount`,null),T(this,`rouletteAt`,0),T(this,`wantMusic`,null),this.engine=e,t&&e?.setMuted(!0),document.addEventListener(`visibilitychange`,()=>{document.hidden?e?.suspend():e?.resume()})}unlock(){this.engine?.unlock()}music(e){e!==this.wantMusic&&(this.wantMusic=e,e?this.engine?.playMusic(e):this.engine?.stopMusic(.6),this.engine?.setFinalLap(!1))}ui(e){this.engine?.sfx(e===`click`?`ui-click`:e===`back`?`ui-back`:e)}sceneEvent(e){this.engine&&(e.local?this.engine.sfx(e.kind):dg.has(e.kind)&&this.engine.sfx(e.kind,{pan:e.pan,gain:e.gain*.55}))}fx(e){this.engine&&(e===`lap`?this.engine.sfx(`lap`):e===`finallap`&&(this.engine.duck(.6,1.4),this.engine.sfx(`final-lap`),this.engine.setFinalLap(!0)))}countdown(e){e!==this.lastCount&&(this.lastCount=e,e&&this.engine&&(this.engine.duck(.5,.5),this.engine.sfx(e===`Los!`?`go`:`count`)))}roulette(e,t){!e||t-this.rouletteAt<85||(this.rouletteAt=t,this.engine?.sfx(`roulette-tick`))}results(e,t){this.engine?.setFinalLap(!1),this.engine?.sfx(e===1||t>=4&&e===2?`win`:`lose`)}update(e,t){this.engine?.update(e,t??this.none)}volumes(){return this.engine?.getVolumes()??{music:.5,sfx:.8}}setVolumes(e,t){this.engine?.setVolumes(e,t)}get muted(){return this.engine?.isMuted()??!1}setMuted(e){this.engine?.setMuted(e)}debug(){let e=this.engine?.debug;return e?{...e,music:this.wantMusic}:null}get available(){return this.engine!==null}get running(){return this.engine?.running??!1}},pg=`kart.screen`,mg=`kart.session`,hg=`kart.name`,gg=108e5;function _g(e,t){try{let n=e.getItem(t);return n?JSON.parse(n):null}catch{return null}}function vg(e,t,n){try{e.setItem(t,JSON.stringify(n))}catch{}}function yg(){let e=_g(sessionStorage,pg);return e?.screenId&&e.peerToken?e:bg()}function bg(){let e={screenId:me(8),peerToken:E()};return vg(sessionStorage,pg,e),e}function xg(){let e=_g(sessionStorage,mg);return!e||!e.code||!e.playerToken||Date.now()-e.savedAt>gg?null:e}function Sg(e){vg(sessionStorage,mg,{...e,savedAt:Date.now()})}function Cg(){try{sessionStorage.removeItem(mg)}catch{}}function wg(){try{return localStorage.getItem(hg)??``}catch{return``}}function Tg(e){try{localStorage.setItem(hg,e)}catch{}}var Eg=`#16131c`;function Dg(e,t,n,r){let i=1/0,a=-1/0,o=1/0,s=-1/0;for(let t=0;t<e.n;t++)i=Math.min(i,e.px[t]),a=Math.max(a,e.px[t]),o=Math.min(o,e.pz[t]),s=Math.max(s,e.pz[t]);let c=Math.min((t-2*r)/(a-i),(n-2*r)/(s-o)),l=(t-(a-i)*c)/2,u=(n-(s-o)*c)/2;return(e,t)=>[l+(a-e)*c,u+(s-t)*c]}function Og(e,t,n,r){let i=Dg(e,t,n,r),a=``;for(let t=0;t<e.n;t+=3){let[n,r]=i(e.px[t],e.pz[t]);a+=`${t===0?`M`:`L`}${n.toFixed(1)} ${r.toFixed(1)}`}return`${a}Z`}var kg=class{constructor(e){T(this,`canvas`,void 0),T(this,`g`,void 0),T(this,`base`,null),T(this,`f`,()=>[0,0]),T(this,`track`,null),this.canvas=e,this.g=e.getContext(`2d`)}setTrack(e){if(this.track===e)return;this.track=e;let t=this.canvas.width,n=this.canvas.height;this.f=Dg(e,t,n,26);let r=document.createElement(`canvas`);r.width=t,r.height=n;let i=r.getContext(`2d`);i.lineJoin=`round`,i.lineCap=`round`;let a=(t,n)=>{i.lineWidth=t,i.strokeStyle=n,i.beginPath();let r=!1;for(let t=0;t<=e.n;t+=2){let n=t%e.n;if(e.edge[n]&4){r=!1;continue}let[a,o]=this.f(e.px[n],e.pz[n]);r?i.lineTo(a,o):i.moveTo(a,o),r=!0}i.stroke()};a(20,Eg),a(11,`#fff8e7`);let[o,s]=this.f(e.px[0],e.pz[0]),[c,l]=this.f(e.px[0]-e.tz[0]*12,e.pz[0]+e.tx[0]*12),[u,d]=this.f(e.px[0]+e.tz[0]*12,e.pz[0]-e.tx[0]*12);i.lineWidth=6,i.strokeStyle=Eg,i.beginPath(),i.moveTo(c,l),i.lineTo(o,s),i.lineTo(u,d),i.stroke(),this.base=r}draw(e,t){if(!this.base)return;let n=this.g;n.clearRect(0,0,this.canvas.width,this.canvas.height),n.drawImage(this.base,0,0);for(let r=0;r<2;r++)for(let i of e){let e=i.slot===t;if(e!==(r===1))continue;let[a,o]=this.f(i.x,i.z);n.beginPath(),n.arc(a,o,e?13:9,0,Math.PI*2),n.fillStyle=D(i.slot),n.fill(),n.lineWidth=e?5:4,n.strokeStyle=e?`#ffffff`:Eg,n.stroke(),e&&(n.lineWidth=2.5,n.strokeStyle=Eg,n.beginPath(),n.arc(a,o,16,0,Math.PI*2),n.stroke())}}},Ag=function(e,t){let n=e,r=Mg[t],i=null,a=0,o=null,s=[],c={},l=function(e,t){a=n*4+17,i=function(e){let t=Array(e);for(let n=0;n<e;n+=1){t[n]=Array(e);for(let r=0;r<e;r+=1)t[n][r]=null}return t}(a),u(0,0),u(a-7,0),u(0,a-7),p(),f(),h(e,t),n>=7&&m(e),o??(o=v(n,r,s)),g(o,t)},u=function(e,t){for(let n=-1;n<=7;n+=1)if(!(e+n<=-1||a<=e+n))for(let r=-1;r<=7;r+=1)t+r<=-1||a<=t+r||(0<=n&&n<=6&&(r==0||r==6)||0<=r&&r<=6&&(n==0||n==6)||2<=n&&n<=4&&2<=r&&r<=4?i[e+n][t+r]=!0:i[e+n][t+r]=!1)},d=function(){let e=0,t=0;for(let n=0;n<8;n+=1){l(!0,n);let r=Pg.getLostPoint(c);(n==0||e>r)&&(e=r,t=n)}return t},f=function(){for(let e=8;e<a-8;e+=1)i[e][6]??(i[e][6]=e%2==0);for(let e=8;e<a-8;e+=1)i[6][e]??(i[6][e]=e%2==0)},p=function(){let e=Pg.getPatternPosition(n);for(let t=0;t<e.length;t+=1)for(let n=0;n<e.length;n+=1){let r=e[t],a=e[n];if(i[r][a]==null)for(let e=-2;e<=2;e+=1)for(let t=-2;t<=2;t+=1)e==-2||e==2||t==-2||t==2||e==0&&t==0?i[r+e][a+t]=!0:i[r+e][a+t]=!1}},m=function(e){let t=Pg.getBCHTypeNumber(n);for(let n=0;n<18;n+=1){let r=!e&&(t>>n&1)==1;i[Math.floor(n/3)][n%3+a-8-3]=r}for(let n=0;n<18;n+=1){let r=!e&&(t>>n&1)==1;i[n%3+a-8-3][Math.floor(n/3)]=r}},h=function(e,t){let n=r<<3|t,o=Pg.getBCHTypeInfo(n);for(let t=0;t<15;t+=1){let n=!e&&(o>>t&1)==1;t<6?i[t][8]=n:t<8?i[t+1][8]=n:i[a-15+t][8]=n}for(let t=0;t<15;t+=1){let n=!e&&(o>>t&1)==1;t<8?i[8][a-t-1]=n:t<9?i[8][15-t-1+1]=n:i[8][15-t-1]=n}i[a-8][8]=!e},g=function(e,t){let n=-1,r=a-1,o=7,s=0,c=Pg.getMaskFunction(t);for(let t=a-1;t>0;t-=2)for(t==6&&--t;;){for(let n=0;n<2;n+=1)if(i[r][t-n]==null){let a=!1;s<e.length&&(a=(e[s]>>>o&1)==1),c(r,t-n)&&(a=!a),i[r][t-n]=a,--o,o==-1&&(s+=1,o=7)}if(r+=n,r<0||a<=r){r-=n,n=-n;break}}},_=function(e,t){let n=0,r=0,i=0,a=Array(t.length),o=Array(t.length);for(let s=0;s<t.length;s+=1){let c=t[s].dataCount,l=t[s].totalCount-c;r=Math.max(r,c),i=Math.max(i,l),a[s]=Array(c);for(let t=0;t<a[s].length;t+=1)a[s][t]=255&e.getBuffer()[t+n];n+=c;let u=Pg.getErrorCorrectPolynomial(l),d=Ig(a[s],u.getLength()-1).mod(u);o[s]=Array(u.getLength()-1);for(let e=0;e<o[s].length;e+=1){let t=e+d.getLength()-o[s].length;o[s][e]=t>=0?d.getAt(t):0}}let s=0;for(let e=0;e<t.length;e+=1)s+=t[e].totalCount;let c=Array(s),l=0;for(let e=0;e<r;e+=1)for(let n=0;n<t.length;n+=1)e<a[n].length&&(c[l]=a[n][e],l+=1);for(let e=0;e<i;e+=1)for(let n=0;n<t.length;n+=1)e<o[n].length&&(c[l]=o[n][e],l+=1);return c},v=function(e,t,n){let r=Lg.getRSBlocks(e,t),i=Rg();for(let t=0;t<n.length;t+=1){let r=n[t];i.put(r.getMode(),4),i.put(r.getLength(),Pg.getLengthInBits(r.getMode(),e)),r.write(i)}let a=0;for(let e=0;e<r.length;e+=1)a+=r[e].dataCount;if(i.getLengthInBits()>a*8)throw`code length overflow. (`+i.getLengthInBits()+`>`+a*8+`)`;for(i.getLengthInBits()+4<=a*8&&i.put(0,4);i.getLengthInBits()%8!=0;)i.putBit(!1);for(;!(i.getLengthInBits()>=a*8||(i.put(236,8),i.getLengthInBits()>=a*8));)i.put(17,8);return _(i,r)};c.addData=function(e,t){t=t||`Byte`;let n=null;switch(t){case`Numeric`:n=zg(e);break;case`Alphanumeric`:n=Bg(e);break;case`Byte`:n=Vg(e);break;case`Kanji`:n=Hg(e);break;default:throw`mode:`+t}s.push(n),o=null},c.isDark=function(e,t){if(e<0||a<=e||t<0||a<=t)throw e+`,`+t;return i[e][t]},c.getModuleCount=function(){return a},c.make=function(){if(n<1){let e=1;for(;e<40;e++){let t=Lg.getRSBlocks(e,r),n=Rg();for(let t=0;t<s.length;t++){let r=s[t];n.put(r.getMode(),4),n.put(r.getLength(),Pg.getLengthInBits(r.getMode(),e)),r.write(n)}let i=0;for(let e=0;e<t.length;e++)i+=t[e].dataCount;if(n.getLengthInBits()<=i*8)break}n=e}l(!1,d())},c.createTableTag=function(e,t){e=e||2,t=t===void 0?e*4:t;let n=``;n+=`<table style="`,n+=` border-width: 0px; border-style: none;`,n+=` border-collapse: collapse;`,n+=` padding: 0px; margin: `+t+`px;`,n+=`">`,n+=`<tbody>`;for(let t=0;t<c.getModuleCount();t+=1){n+=`<tr>`;for(let r=0;r<c.getModuleCount();r+=1)n+=`<td style="`,n+=` border-width: 0px; border-style: none;`,n+=` border-collapse: collapse;`,n+=` padding: 0px; margin: 0px;`,n+=` width: `+e+`px;`,n+=` height: `+e+`px;`,n+=` background-color: `,n+=c.isDark(t,r)?`#000000`:`#ffffff`,n+=`;`,n+=`"/>`;n+=`</tr>`}return n+=`</tbody>`,n+=`</table>`,n},c.createSvgTag=function(e,t,n,r){let i={};typeof arguments[0]==`object`&&(i=arguments[0],e=i.cellSize,t=i.margin,n=i.alt,r=i.title),e=e||2,t=t===void 0?e*4:t,n=typeof n==`string`?{text:n}:n||{},n.text=n.text||null,n.id=n.text?n.id||`qrcode-description`:null,r=typeof r==`string`?{text:r}:r||{},r.text=r.text||null,r.id=r.text?r.id||`qrcode-title`:null;let a=c.getModuleCount()*e+t*2,o,s,l,u,d=``,f;for(f=`l`+e+`,0 0,`+e+` -`+e+`,0 0,-`+e+`z `,d+=`<svg version="1.1" xmlns="http://www.w3.org/2000/svg"`,d+=i.scalable?``:` width="`+a+`px" height="`+a+`px"`,d+=` viewBox="0 0 `+a+` `+a+`" `,d+=` preserveAspectRatio="xMinYMin meet"`,d+=r.text||n.text?` role="img" aria-labelledby="`+y([r.id,n.id].join(` `).trim())+`"`:``,d+=`>`,d+=r.text?`<title id="`+y(r.id)+`">`+y(r.text)+`</title>`:``,d+=n.text?`<description id="`+y(n.id)+`">`+y(n.text)+`</description>`:``,d+=`<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>`,d+=`<path d="`,l=0;l<c.getModuleCount();l+=1)for(u=l*e+t,o=0;o<c.getModuleCount();o+=1)c.isDark(l,o)&&(s=o*e+t,d+=`M`+s+`,`+u+f);return d+=`" stroke="transparent" fill="black"/>`,d+=`</svg>`,d},c.createDataURL=function(e,t){e=e||2,t=t===void 0?e*4:t;let n=c.getModuleCount()*e+t*2,r=t,i=n-t;return qg(n,n,function(t,n){if(r<=t&&t<i&&r<=n&&n<i){let i=Math.floor((t-r)/e),a=Math.floor((n-r)/e);return+!c.isDark(a,i)}return 1})},c.createImgTag=function(e,t,n){e=e||2,t=t===void 0?e*4:t;let r=c.getModuleCount()*e+t*2,i=``;return i+=`<img`,i+=` src="`,i+=c.createDataURL(e,t),i+=`"`,i+=` width="`,i+=r,i+=`"`,i+=` height="`,i+=r,i+=`"`,n&&(i+=` alt="`,i+=y(n),i+=`"`),i+=`/>`,i};let y=function(e){let t=``;for(let n=0;n<e.length;n+=1){let r=e.charAt(n);switch(r){case`<`:t+=`&lt;`;break;case`>`:t+=`&gt;`;break;case`&`:t+=`&amp;`;break;case`"`:t+=`&quot;`;break;default:t+=r}}return t},b=function(e){e=e===void 0?2:e;let t=c.getModuleCount()*1+e*2,n=e,r=t-e,i,a,o,s,l,u={"██":`█`,"█ ":`▀`," █":`▄`,"  ":` `},d={"██":`▀`,"█ ":`▀`," █":` `,"  ":` `},f=``;for(i=0;i<t;i+=2){for(o=Math.floor((i-n)/1),s=Math.floor((i+1-n)/1),a=0;a<t;a+=1)l=`█`,n<=a&&a<r&&n<=i&&i<r&&c.isDark(o,Math.floor((a-n)/1))&&(l=` `),n<=a&&a<r&&n<=i+1&&i+1<r&&c.isDark(s,Math.floor((a-n)/1))?l+=` `:l+=`█`,f+=e<1&&i+1>=r?d[l]:u[l];f+=`
`}return t%2&&e>0?f.substring(0,f.length-t-1)+Array(t+1).join(`▀`):f.substring(0,f.length-1)};return c.createASCII=function(e,t){if(e=e||1,e<2)return b(t);--e,t=t===void 0?e*2:t;let n=c.getModuleCount()*e+t*2,r=t,i=n-t,a,o,s,l,u=Array(e+1).join(`██`),d=Array(e+1).join(`  `),f=``,p=``;for(a=0;a<n;a+=1){for(s=Math.floor((a-r)/e),p=``,o=0;o<n;o+=1)l=1,r<=o&&o<i&&r<=a&&a<i&&c.isDark(s,Math.floor((o-r)/e))&&(l=0),p+=l?u:d;for(s=0;s<e;s+=1)f+=p+`
`}return f.substring(0,f.length-1)},c.renderTo2dContext=function(e,t){t=t||2;let n=c.getModuleCount();for(let r=0;r<n;r++)for(let i=0;i<n;i++)e.fillStyle=c.isDark(r,i)?`black`:`white`,e.fillRect(i*t,r*t,t,t)},c};Ag.stringToBytes=function(e){let t=[];for(let n=0;n<e.length;n+=1){let r=e.charCodeAt(n);t.push(r&255)}return t},Ag.createStringToBytes=function(e,t){let n=function(){let n=Gg(e),r=function(){let e=n.read();if(e==-1)throw`eof`;return e},i=0,a={};for(;;){let e=n.read();if(e==-1)break;let t=r(),o=r(),s=r(),c=String.fromCharCode(e<<8|t);a[c]=o<<8|s,i+=1}if(i!=t)throw i+` != `+t;return a}();return function(e){let t=[];for(let r=0;r<e.length;r+=1){let i=e.charCodeAt(r);if(i<128)t.push(i);else{let i=n[e.charAt(r)];typeof i==`number`?(i&255)==i?t.push(i):(t.push(i>>>8),t.push(i&255)):t.push(63)}}return t}};var jg={MODE_NUMBER:1,MODE_ALPHA_NUM:2,MODE_8BIT_BYTE:4,MODE_KANJI:8},Mg={L:1,M:0,Q:3,H:2},Ng={PATTERN000:0,PATTERN001:1,PATTERN010:2,PATTERN011:3,PATTERN100:4,PATTERN101:5,PATTERN110:6,PATTERN111:7},Pg=function(){let e=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],t=1335,n=7973,r={},i=function(e){let t=0;for(;e!=0;)t+=1,e>>>=1;return t};return r.getBCHTypeInfo=function(e){let n=e<<10;for(;i(n)-i(t)>=0;)n^=t<<i(n)-i(t);return(e<<10|n)^21522},r.getBCHTypeNumber=function(e){let t=e<<12;for(;i(t)-i(n)>=0;)t^=n<<i(t)-i(n);return e<<12|t},r.getPatternPosition=function(t){return e[t-1]},r.getMaskFunction=function(e){switch(e){case Ng.PATTERN000:return function(e,t){return(e+t)%2==0};case Ng.PATTERN001:return function(e,t){return e%2==0};case Ng.PATTERN010:return function(e,t){return t%3==0};case Ng.PATTERN011:return function(e,t){return(e+t)%3==0};case Ng.PATTERN100:return function(e,t){return(Math.floor(e/2)+Math.floor(t/3))%2==0};case Ng.PATTERN101:return function(e,t){return e*t%2+e*t%3==0};case Ng.PATTERN110:return function(e,t){return(e*t%2+e*t%3)%2==0};case Ng.PATTERN111:return function(e,t){return(e*t%3+(e+t)%2)%2==0};default:throw`bad maskPattern:`+e}},r.getErrorCorrectPolynomial=function(e){let t=Ig([1],0);for(let n=0;n<e;n+=1)t=t.multiply(Ig([1,Fg.gexp(n)],0));return t},r.getLengthInBits=function(e,t){if(1<=t&&t<10)switch(e){case jg.MODE_NUMBER:return 10;case jg.MODE_ALPHA_NUM:return 9;case jg.MODE_8BIT_BYTE:return 8;case jg.MODE_KANJI:return 8;default:throw`mode:`+e}else if(t<27)switch(e){case jg.MODE_NUMBER:return 12;case jg.MODE_ALPHA_NUM:return 11;case jg.MODE_8BIT_BYTE:return 16;case jg.MODE_KANJI:return 10;default:throw`mode:`+e}else if(t<41)switch(e){case jg.MODE_NUMBER:return 14;case jg.MODE_ALPHA_NUM:return 13;case jg.MODE_8BIT_BYTE:return 16;case jg.MODE_KANJI:return 12;default:throw`mode:`+e}else throw`type:`+t},r.getLostPoint=function(e){let t=e.getModuleCount(),n=0;for(let r=0;r<t;r+=1)for(let i=0;i<t;i+=1){let a=0,o=e.isDark(r,i);for(let n=-1;n<=1;n+=1)if(!(r+n<0||t<=r+n))for(let s=-1;s<=1;s+=1)i+s<0||t<=i+s||(n!=0||s!=0)&&o==e.isDark(r+n,i+s)&&(a+=1);a>5&&(n+=3+a-5)}for(let r=0;r<t-1;r+=1)for(let i=0;i<t-1;i+=1){let t=0;e.isDark(r,i)&&(t+=1),e.isDark(r+1,i)&&(t+=1),e.isDark(r,i+1)&&(t+=1),e.isDark(r+1,i+1)&&(t+=1),(t==0||t==4)&&(n+=3)}for(let r=0;r<t;r+=1)for(let i=0;i<t-6;i+=1)e.isDark(r,i)&&!e.isDark(r,i+1)&&e.isDark(r,i+2)&&e.isDark(r,i+3)&&e.isDark(r,i+4)&&!e.isDark(r,i+5)&&e.isDark(r,i+6)&&(n+=40);for(let r=0;r<t;r+=1)for(let i=0;i<t-6;i+=1)e.isDark(i,r)&&!e.isDark(i+1,r)&&e.isDark(i+2,r)&&e.isDark(i+3,r)&&e.isDark(i+4,r)&&!e.isDark(i+5,r)&&e.isDark(i+6,r)&&(n+=40);let r=0;for(let n=0;n<t;n+=1)for(let i=0;i<t;i+=1)e.isDark(i,n)&&(r+=1);let i=Math.abs(100*r/t/t-50)/5;return n+=i*10,n},r}(),Fg=function(){let e=Array(256),t=Array(256);for(let t=0;t<8;t+=1)e[t]=1<<t;for(let t=8;t<256;t+=1)e[t]=e[t-4]^e[t-5]^e[t-6]^e[t-8];for(let n=0;n<255;n+=1)t[e[n]]=n;let n={};return n.glog=function(e){if(e<1)throw`glog(`+e+`)`;return t[e]},n.gexp=function(t){for(;t<0;)t+=255;for(;t>=256;)t-=255;return e[t]},n}(),Ig=function(e,t){if(e.length===void 0)throw e.length+`/`+t;let n=function(){let n=0;for(;n<e.length&&e[n]==0;)n+=1;let r=Array(e.length-n+t);for(let t=0;t<e.length-n;t+=1)r[t]=e[t+n];return r}(),r={};return r.getAt=function(e){return n[e]},r.getLength=function(){return n.length},r.multiply=function(e){let t=Array(r.getLength()+e.getLength()-1);for(let n=0;n<r.getLength();n+=1)for(let i=0;i<e.getLength();i+=1)t[n+i]^=Fg.gexp(Fg.glog(r.getAt(n))+Fg.glog(e.getAt(i)));return Ig(t,0)},r.mod=function(e){if(r.getLength()-e.getLength()<0)return r;let t=Fg.glog(r.getAt(0))-Fg.glog(e.getAt(0)),n=Array(r.getLength());for(let e=0;e<r.getLength();e+=1)n[e]=r.getAt(e);for(let r=0;r<e.getLength();r+=1)n[r]^=Fg.gexp(Fg.glog(e.getAt(r))+t);return Ig(n,0).mod(e)},r},Lg=function(){let e=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],t=function(e,t){let n={};return n.totalCount=e,n.dataCount=t,n},n={},r=function(t,n){switch(n){case Mg.L:return e[(t-1)*4+0];case Mg.M:return e[(t-1)*4+1];case Mg.Q:return e[(t-1)*4+2];case Mg.H:return e[(t-1)*4+3];default:return}};return n.getRSBlocks=function(e,n){let i=r(e,n);if(i===void 0)throw`bad rs block @ typeNumber:`+e+`/errorCorrectionLevel:`+n;let a=i.length/3,o=[];for(let e=0;e<a;e+=1){let n=i[e*3+0],r=i[e*3+1],a=i[e*3+2];for(let e=0;e<n;e+=1)o.push(t(r,a))}return o},n}(),Rg=function(){let e=[],t=0,n={};return n.getBuffer=function(){return e},n.getAt=function(t){let n=Math.floor(t/8);return(e[n]>>>7-t%8&1)==1},n.put=function(e,t){for(let r=0;r<t;r+=1)n.putBit((e>>>t-r-1&1)==1)},n.getLengthInBits=function(){return t},n.putBit=function(n){let r=Math.floor(t/8);e.length<=r&&e.push(0),n&&(e[r]|=128>>>t%8),t+=1},n},zg=function(e){let t=jg.MODE_NUMBER,n=e,r={};r.getMode=function(){return t},r.getLength=function(e){return n.length},r.write=function(e){let t=n,r=0;for(;r+2<t.length;)e.put(i(t.substring(r,r+3)),10),r+=3;r<t.length&&(t.length-r==1?e.put(i(t.substring(r,r+1)),4):t.length-r==2&&e.put(i(t.substring(r,r+2)),7))};let i=function(e){let t=0;for(let n=0;n<e.length;n+=1)t=t*10+a(e.charAt(n));return t},a=function(e){if(`0`<=e&&e<=`9`)return e.charCodeAt(0)-48;throw`illegal char :`+e};return r},Bg=function(e){let t=jg.MODE_ALPHA_NUM,n=e,r={};r.getMode=function(){return t},r.getLength=function(e){return n.length},r.write=function(e){let t=n,r=0;for(;r+1<t.length;)e.put(i(t.charAt(r))*45+i(t.charAt(r+1)),11),r+=2;r<t.length&&e.put(i(t.charAt(r)),6)};let i=function(e){if(`0`<=e&&e<=`9`)return e.charCodeAt(0)-48;if(`A`<=e&&e<=`Z`)return e.charCodeAt(0)-65+10;switch(e){case` `:return 36;case`$`:return 37;case`%`:return 38;case`*`:return 39;case`+`:return 40;case`-`:return 41;case`.`:return 42;case`/`:return 43;case`:`:return 44;default:throw`illegal char :`+e}};return r},Vg=function(e){let t=jg.MODE_8BIT_BYTE,n=Ag.stringToBytes(e),r={};return r.getMode=function(){return t},r.getLength=function(e){return n.length},r.write=function(e){for(let t=0;t<n.length;t+=1)e.put(n[t],8)},r},Hg=function(e){let t=jg.MODE_KANJI,n=Ag.stringToBytes;(function(e,t){let r=n(e);if(r.length!=2||(r[0]<<8|r[1])!=t)throw`sjis not supported.`})(`友`,38726);let r=n(e),i={};return i.getMode=function(){return t},i.getLength=function(e){return~~(r.length/2)},i.write=function(e){let t=r,n=0;for(;n+1<t.length;){let r=(255&t[n])<<8|255&t[n+1];if(33088<=r&&r<=40956)r-=33088;else if(57408<=r&&r<=60351)r-=49472;else throw`illegal char at `+(n+1)+`/`+r;r=(r>>>8&255)*192+(r&255),e.put(r,13),n+=2}if(n<t.length)throw`illegal char at `+(n+1)},i},Ug=function(){let e=[],t={};return t.writeByte=function(t){e.push(t&255)},t.writeShort=function(e){t.writeByte(e),t.writeByte(e>>>8)},t.writeBytes=function(e,n,r){n=n||0,r=r||e.length;for(let i=0;i<r;i+=1)t.writeByte(e[i+n])},t.writeString=function(e){for(let n=0;n<e.length;n+=1)t.writeByte(e.charCodeAt(n))},t.toByteArray=function(){return e},t.toString=function(){let t=``;t+=`[`;for(let n=0;n<e.length;n+=1)n>0&&(t+=`,`),t+=e[n];return t+=`]`,t},t},Wg=function(){let e=0,t=0,n=0,r=``,i={},a=function(e){r+=String.fromCharCode(o(e&63))},o=function(e){if(e<0)throw`n:`+e;if(e<26)return 65+e;if(e<52)return 97+(e-26);if(e<62)return 48+(e-52);if(e==62)return 43;if(e==63)return 47;throw`n:`+e};return i.writeByte=function(r){for(e=e<<8|r&255,t+=8,n+=1;t>=6;)a(e>>>t-6),t-=6},i.flush=function(){if(t>0&&(a(e<<6-t),e=0,t=0),n%3!=0){let e=3-n%3;for(let t=0;t<e;t+=1)r+=`=`}},i.toString=function(){return r},i},Gg=function(e){let t=e,n=0,r=0,i=0,a={};a.read=function(){for(;i<8;){if(n>=t.length){if(i==0)return-1;throw`unexpected end of file./`+i}let e=t.charAt(n);if(n+=1,e==`=`)return i=0,-1;e.match(/^\s$/)||(r=r<<6|o(e.charCodeAt(0)),i+=6)}let e=r>>>i-8&255;return i-=8,e};let o=function(e){if(65<=e&&e<=90)return e-65;if(97<=e&&e<=122)return e-97+26;if(48<=e&&e<=57)return e-48+52;if(e==43)return 62;if(e==47)return 63;throw`c:`+e};return a},Kg=function(e,t){let n=e,r=t,i=Array(e*t),a={};a.setPixel=function(e,t,r){i[t*n+e]=r},a.write=function(e){e.writeString(`GIF87a`),e.writeShort(n),e.writeShort(r),e.writeByte(128),e.writeByte(0),e.writeByte(0),e.writeByte(0),e.writeByte(0),e.writeByte(0),e.writeByte(255),e.writeByte(255),e.writeByte(255),e.writeString(`,`),e.writeShort(0),e.writeShort(0),e.writeShort(n),e.writeShort(r),e.writeByte(0);let t=s(2);e.writeByte(2);let i=0;for(;t.length-i>255;)e.writeByte(255),e.writeBytes(t,i,255),i+=255;e.writeByte(t.length-i),e.writeBytes(t,i,t.length-i),e.writeByte(0),e.writeString(`;`)};let o=function(e){let t=e,n=0,r=0,i={};return i.write=function(e,i){if(e>>>i)throw`length over`;for(;n+i>=8;)t.writeByte(255&(e<<n|r)),i-=8-n,e>>>=8-n,r=0,n=0;r=e<<n|r,n+=i},i.flush=function(){n>0&&t.writeByte(r)},i},s=function(e){let t=1<<e,n=(1<<e)+1,r=e+1,a=c();for(let e=0;e<t;e+=1)a.add(String.fromCharCode(e));a.add(String.fromCharCode(t)),a.add(String.fromCharCode(n));let s=Ug(),l=o(s);l.write(t,r);let u=0,d=String.fromCharCode(i[u]);for(u+=1;u<i.length;){let e=String.fromCharCode(i[u]);u+=1,a.contains(d+e)?d+=e:(l.write(a.indexOf(d),r),a.size()<4095&&(a.size()==1<<r&&(r+=1),a.add(d+e)),d=e)}return l.write(a.indexOf(d),r),l.write(n,r),l.flush(),s.toByteArray()},c=function(){let e={},t=0,n={};return n.add=function(r){if(n.contains(r))throw`dup key:`+r;e[r]=t,t+=1},n.size=function(){return t},n.indexOf=function(t){return e[t]},n.contains=function(t){return e[t]!==void 0},n};return a},qg=function(e,t,n){let r=Kg(e,t);for(let i=0;i<t;i+=1)for(let t=0;t<e;t+=1)r.setPixel(t,i,n(t,i));let i=Ug();r.write(i);let a=Wg(),o=i.toByteArray();for(let e=0;e<o.length;e+=1)a.writeByte(o[e]);return a.flush(),`data:image/gif;base64,`+a};Ag.stringToBytes;function Jg(e){let t=Ag(0,`M`);t.addData(e),t.make();let n=t.getModuleCount(),r=n+6,i=``;for(let e=0;e<n;e++)for(let r=0;r<n;r++)t.isDark(e,r)&&(i+=`M${r+3} ${e+3}h1v1h-1z`);let a=`http://www.w3.org/2000/svg`,o=document.createElementNS(a,`svg`);o.setAttribute(`viewBox`,`0 0 ${r} ${r}`),o.setAttribute(`shape-rendering`,`crispEdges`),o.setAttribute(`role`,`img`),o.setAttribute(`aria-label`,`QR-Code zum Koppeln des Handys`);let s=document.createElementNS(a,`rect`);s.setAttribute(`width`,String(r)),s.setAttribute(`height`,String(r)),s.setAttribute(`fill`,`#f7f4ec`);let c=document.createElementNS(a,`path`);return c.setAttribute(`d`,i),c.setAttribute(`fill`,`#101214`),o.append(s,c),o}function Yg(e){let t=Math.floor(e/60),n=e-t*60;return`${t}:${n<10?`0`:``}${n.toFixed(1)}`}var Xg=class{constructor(e){T(this,`app`,P(`app`)),T(this,`inName`,P(`in-name`)),T(this,`inCode`,P(`in-code`)),T(this,`homeMsg`,P(`home-msg`)),T(this,`btnCreate`,P(`btn-create`)),T(this,`btnJoin`,P(`btn-join`)),T(this,`btnReady`,P(`btn-ready`)),T(this,`btnStart`,P(`btn-start`)),T(this,`btnLeave`,P(`btn-leave`)),T(this,`btnBack`,P(`btn-back`)),T(this,`banner`,P(`banner`)),T(this,`modal`,P(`modal`)),T(this,`lastQrUrl`,``),T(this,`lastPlayersJson`,``),T(this,`localReady`,!1),T(this,`hudCache`,{}),T(this,`lastCountdown`,null),T(this,`shownTime`,0),T(this,`lastSetupJson`,``),T(this,`lastOrderJson`,``),T(this,`minimap`,new kg(P(`minimap`))),T(this,`on`,void 0),this.on=e,this.btnCreate.addEventListener(`click`,()=>{e.gesture(),e.create(this.name())});let t=()=>{e.gesture();let t=de(this.inCode.value);C(t,5)?e.join(t,this.name()):(this.setHomeMessage(t.length===5?`Dieser Code enthält ein Zeichen, das in Raumcodes nicht vorkommt. Erlaubt sind: ${j.split(``).join(` `)}`:`Der Raumcode hat 5 Zeichen.`,`bad`),this.inCode.focus())};this.btnJoin.addEventListener(`click`,t),this.inCode.addEventListener(`keydown`,e=>{e.key===`Enter`&&t()}),this.inCode.addEventListener(`input`,()=>{this.inCode.value=de(this.inCode.value).slice(0,5)}),this.inName.addEventListener(`change`,()=>e.nameChanged(this.name())),this.btnReady.addEventListener(`click`,()=>{e.gesture(),e.ready(!this.localReady)}),this.btnStart.addEventListener(`click`,()=>{e.gesture(),e.start()}),this.btnLeave.addEventListener(`click`,()=>e.leave()),P(`btn-again`).addEventListener(`click`,()=>e.again()),P(`btn-lobby`).addEventListener(`click`,()=>e.backToLobby());let n=P(`chk-bots`);n.addEventListener(`change`,()=>e.setBots(n.checked)),P(`btn-debug-lobby`).addEventListener(`click`,()=>e.toggleDebug()),P(`btn-copy`).addEventListener(`click`,()=>void this.copyInvite()),P(`btn-settings`).addEventListener(`click`,()=>this.showSettings());let r=P(`menu`),i=()=>{r.hidden=!0},a=P(`btn-menu`);a.addEventListener(`click`,()=>{e.click(`click`),r.hidden=!r.hidden,a.blur()}),r.addEventListener(`click`,e=>{e.target===r&&i()});let o=(t,n)=>{P(t).addEventListener(`click`,()=>{e.click(t===`btn-back`?`back`:`click`),i(),document.activeElement?.blur?.(),n()})};o(`btn-menu-close`,()=>void 0),o(`btn-settings-game`,()=>this.showSettings()),o(`btn-pair`,()=>e.showPairing()),o(`btn-camera`,()=>e.toggleCamera()),o(`btn-debug`,()=>e.toggleDebug()),o(`btn-back`,()=>e.backToLobby()),window.addEventListener(`keydown`,e=>{e.code===`Escape`&&this.view===`game`&&(r.hidden=!r.hidden)});for(let t of document.querySelectorAll(`#ai-level button`))t.addEventListener(`click`,()=>{e.click(`click`),e.setAiLevel(Number(t.dataset.level))})}show(e){this.app.dataset.view=e,e!==`game`&&(P(`menu`).hidden=!0);let t=P(`debug`);e===`lobby`?P(`debug-slot`).append(t):this.app.append(t)}get view(){return this.app.dataset.view}name(){return this.inName.value.trim()}setHome(e,t){this.inName.value=e,this.inCode.value=t}setVersion(e){P(`home-version`).textContent=`Version ${e}`}setHomeBusy(e){this.btnCreate.disabled=e,this.btnJoin.disabled=e}setHomeMessage(e,t=`info`){this.homeMsg.textContent=e,this.homeMsg.dataset.tone=t}renderLobby(e){P(`lobby-code`).textContent=e.code,P(`hud-code`).textContent=e.code;let t=P(`lobby-link`);t.value!==e.inviteUrl&&(t.value=e.inviteUrl),e.pairUrl!==this.lastQrUrl&&(this.lastQrUrl=e.pairUrl,P(`lobby-qr`).replaceChildren(Jg(e.pairUrl)),P(`pair-url`).textContent=e.pairUrl.replace(/^https?:\/\//,``));let n=P(`pair-status`),r=`Kein Handy verbunden`;e.controllerConnected&&(r=e.controllerState===`active`?`Handy verbunden · Ping ${O(e.controllerRtt)}`:e.controllerState===`waiting`?`Handy verbunden – dort noch „Tippen zum Starten“`:`Handy verbunden, sendet aber gerade nichts`,e.controllerMismatch&&(r=`Handy hat eine ältere Fassung der Seite – dort bitte neu laden`)),n.textContent=r,n.dataset.on=String(e.controllerConnected&&e.controllerState===`active`&&!e.controllerMismatch);let i=JSON.stringify([e.players,e.localSlot,e.bots]);i!==this.lastPlayersJson&&(this.lastPlayersJson=i,this.renderPlayers(e)),this.localReady=e.localReady,this.btnReady.hidden=e.isHost,this.btnReady.textContent=e.localReady?`Doch nicht bereit`:`Ich bin bereit`,this.btnReady.classList.toggle(`btn-on`,e.localReady),this.btnStart.hidden=!e.isHost,this.btnStart.disabled=!e.canStart,this.btnLeave.textContent=e.isHost?`Lobby schließen`:`Lobby verlassen`,this.btnBack.textContent=e.isHost?`Zur Lobby`:`Verlassen`;let a=P(`chk-bots`);a.checked=e.bots,a.disabled=!e.isHost,P(`bots-note`).textContent=e.isHost?``:`Strecke und Gegner legt der Host fest.`;let o=JSON.stringify([e.track,e.aiLevel,e.bots,e.isHost]);o!==this.lastSetupJson&&(this.lastSetupJson=o,this.renderSetup(e));let s=``;s=e.isHost?e.waitingFor.length>0?`Noch nicht bereit: ${e.waitingFor.join(`, `)}`:e.players.length===1?e.bots?`Du kannst gegen die KI starten oder auf Mitspieler warten.`:`Du kannst allein starten oder auf Mitspieler warten.`:`Alle bereit.`:e.localReady?`Der Host startet das Rennen.`:`Melde dich bereit, wenn dein Controller verbunden ist.`,P(`lobby-hint`).textContent=s,P(`hud-note`).textContent=e.controllerConnected?``:`Kein Handy verbunden – den QR-Code gibt es im Menü unter „Controller koppeln“. Am Rechner: Pfeiltasten/WASD, Shift = Drift, Leertaste = Item.`}setBanner(e,t=`warn`){this.banner.hidden=!e,this.banner.textContent=e??``,this.banner.dataset.tone=t}showModal(e,t,n){P(`modal-title`).textContent=e,P(`modal-body`).replaceChildren(...t.map(e=>typeof e==`string`?I(`p`,{text:e}):e));let r=P(`modal-actions`);r.replaceChildren();for(let e of n){let t=I(`button`,{class:e.primary?`btn btn-primary`:`btn`,type:`button`,text:e.label});t.addEventListener(`click`,()=>{this.hideModal(),e.run()}),r.append(t)}this.modal.hidden=!1}hideModal(){this.modal.hidden=!0}setText(e,t){this.hudCache[e]!==t&&(this.hudCache[e]=t,P(e).textContent=t)}renderRaceHud(e){let t=P(`race-hud`);if(t.hidden===e.visible&&(t.hidden=!e.visible),!e.visible){this.hudCache.smoke!==`0`&&(this.hudCache.smoke=`0`,P(`smoke-veil`).style.opacity=`0`);for(let[e,t]of[[`banner`,`race-banner`],[`flag`,`finish-flag`],[`fps`,`fps`]])this.hudCache[e]&&(this.hudCache[e]=``,P(t).hidden=!0);return}this.setText(`rh-place`,String(e.place)),this.setText(`rh-of`,`von ${e.of}`),this.setText(`rh-lap`,`${e.lap}/${e.laps}`),e.frozenTime||(this.shownTime=e.timeSec),this.setText(`rh-time`,Yg(this.shownTime)),this.setText(`rh-speed`,String(e.speedKmh)),this.hudCache.placeAttr!==String(e.place)&&(this.hudCache.placeAttr=String(e.place),P(`rh-place-box`).dataset.place=String(e.place));let n=JSON.stringify(e.order);if(n!==this.lastOrderJson){this.lastOrderJson=n;let t=P(`rh-order`);t.replaceChildren(),e.order.forEach((e,n)=>{let r=I(`span`,{class:`who`,text:e.name});r.style.setProperty(`--c`,D(e.slot));let i=I(`li`,{},I(`span`,{class:`n`,text:String(n+1)}),r);i.dataset.me=String(e.me),i.dataset.done=String(e.done),t.append(i)})}let r=e.banner??``;if(this.hudCache.banner!==r){this.hudCache.banner=r;let t=P(`race-banner`);t.hidden=!r,t.textContent=r,t.dataset.tone=e.bannerTone}let i=e.fps===null?``:`${Math.round(e.fps)} Bilder/s`;if(this.hudCache.fps!==i){this.hudCache.fps=i;let e=P(`fps`);e.hidden=!i,e.textContent=i}let a=e.smoke<.02?`0`:e.smoke.toFixed(2);this.hudCache.smoke!==a&&(this.hudCache.smoke=a,P(`smoke-veil`).style.opacity=a);let o=e.rolling?`rolling`:e.item===0?`none`:`item${e.item}`;if(this.hudCache.item!==o){this.hudCache.item=o;let t=P(`rh-item`);t.dataset.state=e.rolling?`rolling`:e.item===0?`none`:`ready`;let n=le[e.item];P(`rh-item-icon`).innerHTML=e.rolling?oe(te):n?oe(n.icon):``,P(`rh-item-name`).textContent=e.rolling?``:n?n.name:``,P(`rh-item-hint`).textContent=e.rolling?``:n?n.hint:``}let s=P(`finish-flag`),c=e.finished?`Ziel! Platz ${e.place}`:``;e.finished&&(P(`menu`).hidden=!0),this.hudCache.flag!==c&&(this.hudCache.flag=c,s.textContent=c,s.hidden=!c)}setHudNoteVisible(e){let t=P(`hud-note`);t.hidden===e&&(t.hidden=!e)}setRaceTitle(e,t=``){let n=e??``;if(this.hudCache.title===n)return;this.hudCache.title=n;let r=P(`race-title`);r.hidden=e===null,e!==null&&(P(`race-title-name`).textContent=e,P(`race-title-sub`).textContent=t)}drawMinimap(e,t,n){this.minimap.setTrack(e),this.minimap.draw(t,n)}setCameraLabel(e){P(`btn-camera`).textContent=e?`Kamera: Verfolger`:`Kamera: Übersicht`}setCountdown(e){if(e===this.lastCountdown)return;this.lastCountdown=e;let t=P(`countdown`);t.hidden=e===null,e!==null&&(t.textContent=e,t.dataset.go=String(e===`Los!`),t.classList.remove(`pop`),t.offsetWidth,t.classList.add(`pop`))}showResults(e,t,n=``){P(`results-track`).textContent=n,P(`menu`).hidden=!0;let r=P(`results-list`);r.replaceChildren();for(let t of e){let e=I(`span`,{class:`chip`,text:String(t.slot+1)});e.style.setProperty(`--c`,D(t.slot)),r.append(I(`li`,{class:`result${t.me?` result-me`:``}`},I(`span`,{class:`result-place`,text:`${t.place}.`}),e,I(`span`,{class:`result-name`},t.name,t.bot?I(`span`,{class:`tag`,text:`KI`}):null,t.me?I(`span`,{class:`you`,text:`du`}):null),I(`span`,{class:`result-time`,text:t.timeSec>=0?Yg(t.timeSec):`nicht im Ziel`})))}P(`btn-again`).hidden=!t,P(`btn-lobby`).hidden=!t,P(`results-note`).textContent=t?``:`Der Host entscheidet, wie es weitergeht.`,P(`results`).hidden=!1}hideResults(){P(`results`).hidden=!0}showPairingModal(e,t){let n=I(`div`,{class:`qr qr-large`});n.append(Jg(e)),this.showModal(`Controller koppeln`,[n,t?`Es ist bereits ein Handy verbunden. Scannt ein anderes den Code, übernimmt es die Steuerung.`:`QR-Code mit der Handy-Kamera scannen.`],[{label:`Schließen`,run:()=>void 0}])}renderPlayers(e){let t=P(`lobby-players`);t.replaceChildren();let n=new Map(e.players.map(e=>[e.slot,e]));for(let r=0;r<4;r++){let i=n.get(r),a=I(`span`,{class:`chip`,text:String(r+1)});if(a.style.setProperty(`--c`,D(r)),!i){t.append(I(`li`,{class:`player player-empty${e.bots?` player-bot`:``}`},a,I(`span`,{class:`player-name`,text:e.bots?mt[r]:`frei`}),e.bots?I(`span`,{class:`player-tags`},I(`span`,{class:`tag`,text:`KI`})):null));continue}let o=r===e.localSlot,s=I(`span`,{class:`player-name`},i.name,o?I(`span`,{class:`you`,text:`du`}):null,I(`span`,{class:`player-fig`,text:`fährt ${mt[r]}`})),c=I(`span`,{class:`player-tags`});i.isHost&&c.append(I(`span`,{class:`tag tag-host`,text:`Host`})),i.online||c.append(I(`span`,{class:`tag tag-bad`,text:`getrennt`}));let l=I(`span`,{class:`stat stat-controller ${i.controller?`stat-ok`:`stat-off`}`},I(`span`,{class:`stat-label`,text:`Controller`}),i.controller?`verbunden · ${O(i.ctrlRtt)}`:`nicht verbunden`),u=I(`span`,{class:`stat stat-ready ${i.isHost||i.ready?`stat-ok`:`stat-off`}`},I(`span`,{class:`stat-label`,text:`Status`}),i.isHost?`startet`:i.ready?`bereit`:`nicht bereit`),d=I(`span`,{class:`stat stat-num`},I(`span`,{class:`stat-label`,text:`Ping`}),i.isHost?`Host`:i.online?O(i.ping):`–`),f=I(`li`,{class:`player${o?` player-me`:``}${i.online?``:` player-off`}`},a,s,c,l,u,d);f.title=`Platz ${r+1} · ${ce[r]}`,t.append(f)}}renderSetup(e){let t=P(`track-list`);t.replaceChildren();for(let n=0;n<d;n++){let r=u(n),i=document.createElementNS(`http://www.w3.org/2000/svg`,`svg`);i.setAttribute(`viewBox`,`0 0 120 74`),i.setAttribute(`class`,`track-map`);let a=document.createElementNS(`http://www.w3.org/2000/svg`,`path`);a.setAttribute(`d`,Og(r,120,74,8)),i.append(a);let o=I(`button`,{class:`track-card`,type:`button`},i,I(`span`,{class:`track-name`,text:r.def.name}),I(`span`,{class:`track-blurb`,text:r.def.blurb}),I(`span`,{class:`track-meta`,text:`${Math.round(r.length/10)*10} m · ${`●`.repeat(r.def.grade)}${`○`.repeat(3-r.def.grade)}`}));o.dataset.on=String(n===e.track),o.disabled=!e.isHost,o.setAttribute(`aria-pressed`,String(n===e.track)),o.addEventListener(`click`,()=>{this.on.click(`click`),this.on.setTrack(n)}),t.append(o)}let n=P(`ai-level`);n.dataset.off=String(!e.bots);for(let t of n.querySelectorAll(`button`))t.setAttribute(`aria-pressed`,String(Number(t.dataset.level)===e.aiLevel)),t.disabled=!e.isHost||!e.bots}showSettings(){let e=this.on,t=e.settings(),n=I(`div`,{class:`seg`,role:`group`});for(let[r,i]of[[`auto`,`Automatisch`],[`low`,`Niedrig`],[`medium`,`Mittel`],[`high`,`Hoch`]]){let a=I(`button`,{type:`button`,text:i});a.setAttribute(`aria-pressed`,String(r===t.quality)),a.addEventListener(`click`,()=>{e.click(`click`),e.setQuality(r);for(let e of n.querySelectorAll(`button`))e.setAttribute(`aria-pressed`,String(e===a))}),n.append(a)}let r=e=>{let t=I(`input`,{type:`range`,min:`0`,max:`100`,step:`5`});return t.value=String(Math.round(e*100)),t},i=r(t.music),a=r(t.sfx),o=()=>e.setVolumes(Number(i.value)/100,Number(a.value)/100);i.addEventListener(`input`,o),a.addEventListener(`input`,o),a.addEventListener(`change`,()=>e.click(`click`));let s=(e,t,n)=>{let r=I(`input`,{type:`checkbox`});return r.checked=t,r.addEventListener(`change`,()=>n(r.checked)),I(`label`,{class:`settings-check`},r,I(`span`,{text:e}))},c=I(`div`,{class:`settings`},I(`div`,{class:`settings-row`},I(`span`,{text:`Grafik`}),n),I(`p`,{class:`settings-note`,text:`„Automatisch“ senkt die Auflösung, sobald das Bild ruckelt. Gilt für diesen Bildschirm; die Detailstufe der Kulissen wechselt mit dem nächsten Rennen.`}),s(`Bildrate im Rennen anzeigen`,t.showFps,t=>e.setShowFps(t)),I(`div`,{class:`settings-row`},I(`span`,{text:`Musik`}),i),I(`div`,{class:`settings-row`},I(`span`,{text:`Geräusche`}),a),s(`Ton aus`,t.muted,t=>e.setMuted(t)));this.showModal(`Einstellungen`,[c],[{label:`Fertig`,primary:!0,run:()=>void 0}])}async copyInvite(){let e=P(`lobby-link`),t=P(`btn-copy`),n=!1;try{await navigator.clipboard.writeText(e.value),n=!0}catch{e.focus(),e.select()}t.textContent=n?`Kopiert`:`Markiert`,window.setTimeout(()=>t.textContent=`Kopieren`,1600)}},Zg=2,Qg={visible:!1,place:0,of:0,lap:0,laps:0,timeSec:0,frozenTime:!1,item:0,rolling:!1,speedKmh:0,finished:!1,order:[],banner:null,bannerTone:`info`,fps:null,smoke:0},$g=new Set([`hit`,`bump`,`pickup`,`finish`,`block`,`stall`,`lap`,`finallap`]);function e_(e){try{return localStorage.getItem(e)===`1`}catch{return!1}}function t_(){try{return new pt}catch(e){return console.warn(`[audio] Ton nicht verfügbar:`,e),null}}function n_(){let e=ee().quality;if(e)return e;try{let e=localStorage.getItem(`kart.quality`);if(e===`low`||e===`medium`||e===`high`)return e}catch{}return`auto`}function r_(e){switch(e){case`online`:return{value:`verbunden`,tone:`ok`};case`connecting`:return{value:`verbinde …`,tone:`warn`};case`offline`:return{value:`getrennt, verbinde neu …`,tone:`bad`};case`id-taken`:return{value:`Kennung vergeben`,tone:`bad`};case`unsupported`:return{value:`Browser ohne WebRTC`,tone:`bad`}}}function i_(e){if(!e||e.kind===`unknown`)return{value:`wird ermittelt …`,tone:void 0};let t=`${e.local}→${e.remote}, ${e.protocol}`;return e.kind===`relay`?{value:`über TURN (${t})`,tone:`warn`}:{value:`direkt (${t})`,tone:`ok`}}function a_(e){return e<0?`noch keine Messung`:`${O(e)} hin und zurück · ≈ ${O(e/2)} einfach`}new class{constructor(){T(this,`debug`,ee()),T(this,`appRoot`,new URL(`.`,location.href)),T(this,`linkOptions`,void 0),T(this,`setup`,void 0),T(this,`identity`,yg()),T(this,`screenEp`,void 0),T(this,`pairing`,void 0),T(this,`keyboard`,new vn),T(this,`ui`,void 0),T(this,`overlay`,void 0),T(this,`ticker`,void 0),T(this,`scene`,null),T(this,`role`,`none`),T(this,`roomEp`,null),T(this,`hostLobby`,null),T(this,`hostGame`,null),T(this,`clientLobby`,null),T(this,`clientGame`,null),T(this,`playerToken`,``),T(this,`roomPeerToken`,``),T(this,`inGame`,!1),T(this,`autoBrain`,null),T(this,`shownRaceId`,-1),T(this,`resultsShown`,!1),T(this,`lastHudJson`,``),T(this,`lastHudAt`,0),T(this,`joinStartedAt`,0),T(this,`lastSaveJson`,``),T(this,`quality`,n_()),T(this,`showFps`,e_(`kart.fps`)),T(this,`sound`,void 0),T(this,`kartAudio`,[]),T(this,`finalLapUntil`,0),T(this,`wrongWaySince`,0),T(this,`mapTick`,0),T(this,`ents`,[]),T(this,`lastCmd`,{steer:0,buttons:0}),T(this,`lastFrame`,0),T(this,`lastOverlay`,0),T(this,`frames`,0),T(this,`ticks`,0),T(this,`seconds`,0),T(this,`rates`,{fps:0,tick:0,ctrl:0,snap:0,peakCorrection:0}),T(this,`prev`,{ctrl:0,snap:0}),T(this,`hostPath`,null),T(this,`seatPaths`,new Map),T(this,`seatRates`,new Map),T(this,`frame`,()=>{requestAnimationFrame(this.frame);let e=performance.now(),t=Math.min(.1,(e-this.lastFrame)/1e3);if(this.lastFrame=e,this.frames++,this.inGame&&this.scene){let n=this.ticker.advance(),r=this.hostGame??this.clientGame;if(r){let i=e/1e3;r.entities(n,i,t,this.ents);let a=r.race(i);this.scene.frame(this.ents,r.localSlot,t,a,r.things(i)),this.updateRaceUi(a,e),this.sound.update(t,a.phase===2?null:this.scene.kartAudio(this.kartAudio)),++this.mapTick%3==0&&this.ui.drawMinimap(s,this.ents,r.localSlot)}}this.inGame?this.overlay.setInput(this.lastCmd.steer/127,this.lastCmd.buttons):this.pairing.connected&&this.pairing.input.fresh?this.overlay.setInput(this.pairing.input.steer/127,this.pairing.input.buttons):this.overlay.setInput(0,0),e-this.lastOverlay>250&&(this.lastOverlay=e,this.overlay.visible&&this.overlay.setSections(this.collectDebug()))}),this.linkOptions={openTimeoutMs:15e3,idleTimeoutMs:8e3,netSim:{lag:this.debug.lag,jitter:this.debug.jitter,loss:this.debug.loss}},this.sound=new fg(t_(),this.debug.mute),this.pairing=new ug(()=>this.pairedInfo()),this.pairing.onChange=()=>{this.reportController(),this.refresh()},this.ticker=new bn(()=>this.step(),1e3/60),this.overlay=new jn(P(`debug`)),this.overlay.visible=this.debug.debugOverlay,this.ui=new Xg({create:e=>void this.createLobby(e),join:(e,t)=>this.joinLobby(e,t,null),ready:e=>this.clientLobby?.setReady(e),start:()=>{this.hostLobby?.canStart()&&this.hostLobby.setPhase(`game`)},again:()=>{this.hostGame&&this.hostLobby&&(this.hostGame.setRoster(this.hostLobby.slots(),this.hostLobby.bots),this.hostGame.newRace())},setBots:e=>this.hostLobby?.setBots(e),setAiLevel:e=>this.hostLobby?.setAiLevel(e),setTrack:e=>this.hostLobby?.setTrack(Math.max(0,Math.min(d-1,e))),setQuality:e=>this.setQuality(e),leave:()=>this.leave(),backToLobby:()=>{this.hostLobby?this.hostLobby.setPhase(`lobby`):this.leave()},toggleCamera:()=>{this.scene&&(this.scene.cameraMode=this.scene.cameraMode===`chase`?`top`:`chase`,this.ui.setCameraLabel(this.scene.cameraMode===`top`))},setVolumes:(e,t)=>this.sound.setVolumes(e,t),setMuted:e=>this.sound.setMuted(e),setShowFps:e=>{this.showFps=e;try{localStorage.setItem(`kart.fps`,e?`1`:`0`)}catch{}},settings:()=>({quality:this.quality,...this.sound.volumes(),muted:this.sound.muted,showFps:this.showFps}),click:e=>{this.sound.unlock(),this.sound.ui(e)},toggleDebug:()=>this.overlay.visible=!this.overlay.visible,showPairing:()=>this.ui.showPairingModal(this.pairUrl(),this.pairing.connected),nameChanged:e=>{Tg(e),this.hostLobby?.setLocalName(e),this.clientLobby?.setName(e)},gesture:()=>{this.sound.unlock(),M()}}),window.addEventListener(`keydown`,e=>{e.code===`F2`&&(this.overlay.visible=!this.overlay.visible)}),this.sound.music(`menu`);let e=()=>this.sound.unlock();window.addEventListener(`pointerdown`,e,{passive:!0}),window.addEventListener(`keydown`,e),window.addEventListener(`pagehide`,()=>{this.hostLobby?.dropLinks(),this.clientLobby?.link?.close(),this.pairing.link?.close()}),this.installTestHook()}async boot(){this.setup=await A(this.appRoot),this.initScreenEndpoint();let e=new URLSearchParams(location.search),t=de(e.get(`room`)??``),n=xg(),r=wg();this.ui.setHome(r,C(t,5)?t:``),this.ui.setVersion(N),requestAnimationFrame(this.frame),window.setInterval(()=>this.everySecond(),1e3),n&&(!t||t===n.code)?n.role===`host`?this.resumeHost(n,r):this.joinLobby(n.code,r,n.playerToken):(n&&Cg(),this.ui.show(`home`),C(t,5)&&this.ui.setHomeMessage(r?`Einladung in Lobby ${t}. Tippe auf „Beitreten“.`:`Einladung in Lobby ${t}. Trag deinen Namen ein und tritt bei.`))}initScreenEndpoint(){let e=new ie(i(this.identity.screenId),this.identity.peerToken,this.setup,this.linkOptions);this.screenEp=e,e.onIncoming=e=>{e.metadata.role===`controller`?this.pairing.accept(e):e.close()},e.onStatus=t=>{t===`id-taken`&&this.screenEp===e&&(e.destroy(),this.identity=bg(),this.initScreenEndpoint()),this.refresh()}}async createLobby(e){Tg(e),this.ui.setHomeBusy(!0),this.ui.setHomeMessage(`Erstelle Lobby …`);for(let t=0;t<5;t++){let t=me(5),n=E(),r=new ie(a(t),n,this.setup,this.linkOptions),i=await this.waitForEndpoint(r,12e3);if(i===`online`){this.ui.setHomeBusy(!1),this.ui.setHomeMessage(``),this.becomeHost(t,n,r,E(),e,void 0);return}if(r.destroy(),i!==`id-taken`){this.ui.setHomeBusy(!1),this.ui.setHomeMessage(i===`unsupported`?`Dieser Browser unterstützt kein WebRTC.`:`Der Signaling-Server ist nicht erreichbar. Prüf die Internetverbindung und versuch es noch einmal.`,`bad`);return}}this.ui.setHomeBusy(!1),this.ui.setHomeMessage(`Es ließ sich kein freier Raumcode finden. Versuch es noch einmal.`,`bad`)}waitForEndpoint(e,t){return new Promise(n=>{let r=window.setTimeout(()=>n(`timeout`),t),i=e=>{(e===`online`||e===`id-taken`||e===`unsupported`)&&(window.clearTimeout(r),n(e))};e.onStatus=i,i(e.status)})}resumeHost(e,t){let n=e.roomPeerToken??E(),r=new ie(a(e.code),n,this.setup,this.linkOptions);this.becomeHost(e.code,n,r,e.playerToken,t||`Host`,e.hostSave)}becomeHost(e,t,n,r,i,a){this.role=`host`,this.roomEp=n,this.playerToken=r,this.roomPeerToken=t;let o=new kn(e,r,i,a);a||(this.debug.track>=0&&(o.track=Math.min(d-1,this.debug.track)),this.debug.ai>=0&&(o.aiLevel=this.debug.ai)),o.track=Math.min(d-1,o.track),this.hostLobby=o,n.onIncoming=e=>{e.metadata.role===`screen`?o.accept(e):e.close()},n.onStatus=t=>{t===`id-taken`&&this.roomEp===n?(this.teardown(),this.ui.show(`home`),this.ui.setHomeMessage(`Die Lobby ${e} wird bereits von einem anderen Bildschirm geführt.`,`bad`)):this.refresh()},o.onChange=()=>{this.persistHost(),this.refresh()},o.onSeatsChanged=()=>this.hostGame?.setRoster(o.slots(),o.bots),o.onPlayerLink=e=>{this.hostGame?.resetInput(e),this.hostGame?.setOnline(e,!0)},o.onPlayerDown=e=>this.hostGame?.setOnline(e,!1),o.onFast=(e,t)=>{if(!this.hostGame||t.getUint8(0)!==32)return;let n=pe(t);n&&this.hostGame.receiveCmds(e,n.newestSeq,n.cmds)},this.setRoomInUrl(e),this.persistHost(),this.reportController(),this.ui.show(`lobby`),this.refresh()}persistHost(){if(!this.hostLobby)return;let e=this.hostLobby.toSave(),t=JSON.stringify(e);t!==this.lastSaveJson&&(this.lastSaveJson=t,Sg({role:`host`,code:this.hostLobby.code,playerToken:this.playerToken,roomPeerToken:this.roomPeerToken,hostSave:e}))}joinLobby(e,t,n){Tg(t),this.role=`client`,this.joinStartedAt=Date.now(),this.playerToken=n??E(),this.ui.setHomeBusy(!0),this.ui.setHomeMessage(n?`Kehre in Lobby ${e} zurück …`:`Verbinde mit Lobby ${e} …`),this.ui.show(`home`);let r=new Tn(()=>this.screenEp,e,this.playerToken,t||`Spieler`,n!==null);this.clientLobby=r,r.onFast=e=>{if(!this.clientGame||e.getUint8(0)!==33)return;let t=g(e);t&&this.clientGame.onSnapshot(t,performance.now()/1e3)},r.onLinkUp=()=>{this.clientGame?.resync(),this.reportController()},r.onFx=e=>this.localFx(e),r.onChange=()=>this.onClientChange(r)}onClientChange(e){if(this.clientLobby===e){if(e.isFinal){let t=e.code,n=e.status,r=e.rejectReason;this.teardown(),this.ui.show(`home`),this.ui.setHome(wg(),t);let i=this.setup.turn.available?`Ein TURN-Server ist eingerichtet, die Verbindung kam trotzdem nicht zustande.`:`Es ist kein TURN-Server eingerichtet. In Mobilfunk-, Schul- und Firmennetzen kommt dann oft keine direkte Verbindung zustande.`,[a,o]={"not-found":[`Lobby nicht gefunden`,`Unter dem Code ${t} läuft gerade keine Lobby. Prüf den Code oder frag den Host.`],unreachable:[`Keine Verbindung zum Host`,`Die Lobby ${t} existiert, aber die beiden Geräte erreichen sich nicht. ${i}`],closed:[`Lobby geschlossen`,`Der Host hat die Lobby geschlossen.`],lost:[`Host nicht mehr erreichbar`,`Der Host hat die Lobby verlassen oder seine Verbindung verloren. Die Lobby ist beendet.`],replaced:[`In einem anderen Tab aktiv`,`Dein Platz wird jetzt von einem anderen Tab oder Gerät genutzt.`]}[n]??[`Verbindung beendet`,``];n===`rejected`&&(r===`full`?[a,o]=[`Lobby ist voll`,`Alle vier Plätze sind belegt.`]:r===`running`?[a,o]=[`Rennen läuft bereits`,`Neue Spieler können erst beitreten, wenn der Host zurück in der Lobby ist.`]:[a,o]=[`Versionen passen nicht zusammen`,`Lade die Seite auf beiden Geräten neu.`]),this.ui.showModal(a,[o],[{label:`Zur Startseite`,primary:!0,run:()=>void 0}])}else e.status===`joined`&&e.state&&(this.ui.view===`home`||this.ui.view===`boot`)&&(this.ui.setHomeBusy(!1),this.ui.setHomeMessage(``),this.setRoomInUrl(e.code),Sg({role:`client`,code:e.code,playerToken:this.playerToken}),this.ui.show(`lobby`)),this.refresh()}}leave(){this.hostLobby&&this.hostLobby.close(),this.clientLobby?.leave();let e=this.roomEp;this.roomEp=null,e&&window.setTimeout(()=>e.destroy(),600),this.teardown(),this.ui.setHome(wg(),``),this.ui.setHomeMessage(``),this.ui.show(`home`)}teardown(){this.exitGame(),this.clientLobby?.dispose(),this.clientLobby=null,this.hostLobby?.close(),this.hostLobby=null,this.roomEp?.destroy(),this.roomEp=null,this.role=`none`,this.lastSaveJson=``,this.hostPath=null,this.seatPaths.clear(),Cg(),this.setRoomInUrl(null),this.ui.setHomeBusy(!1),this.ui.setBanner(null),this.pairing.pushInfo()}lobbyState(){return this.hostLobby?this.hostLobby.state():this.clientLobby?.state??null}localSlot(){return this.hostLobby?this.hostLobby.localSlot:this.clientLobby?.slot??-1}pairedInfo(){let e=this.lobbyState(),t=this.localSlot(),n=e?.players.find(e=>e.slot===t);return{name:n?.name??wg(),slot:n?t:-1,room:e?.code??null,phase:e?.phase??`home`}}pairUrl(){let e=F(new URL(`c/`,this.appRoot));return e.searchParams.set(`s`,this.identity.screenId),e.href}inviteUrl(e){let t=F(new URL(this.appRoot.href));return t.searchParams.set(`room`,e),t.href}setRoomInUrl(e){let t=new URL(location.href);e?t.searchParams.set(`room`,e):t.searchParams.delete(`room`),history.replaceState(null,``,t)}reportController(){let e=this.pairing.connected,t=e?this.pairing.rtt:-1;this.hostLobby?.setLocalController(e,t),this.clientLobby?.reportStatus(e,t)}refresh(){this.updateBanner();let e=this.lobbyState();if(!e||this.role===`none`||this.clientLobby&&this.clientLobby.slot<0)return;let t=this.localSlot(),n=e.players.find(e=>e.slot===t),r={code:e.code,inviteUrl:this.inviteUrl(e.code),pairUrl:this.pairUrl(),players:e.players,localSlot:t,isHost:this.role===`host`,canStart:this.hostLobby?.canStart()??!1,bots:e.bots,aiLevel:e.aiLevel,track:e.track,quality:this.quality,waitingFor:e.players.filter(e=>!e.isHost&&e.online&&!e.ready).map(e=>e.name),localReady:n?.ready??!1,controllerConnected:this.pairing.connected,controllerState:this.pairing.input.fresh?`active`:this.pairing.input.lastPacketAt===0?`waiting`:`silent`,controllerMismatch:this.pairing.buildMismatch,controllerRtt:this.pairing.rtt};this.ui.renderLobby(r),this.scene?.setRoster(this.drivers(e)),this.pairing.pushInfo(),this.syncPhase(e.phase)}updateBanner(){let e=this.clientLobby;if(e&&e.status===`reconnecting`){let t=Math.max(0,Math.ceil((e.deadline-Date.now())/1e3));this.ui.setBanner(`Verbindung zum Host unterbrochen – verbinde neu … (noch ${t} s)`,`bad`)}else e&&e.status===`joined`&&e.buildMismatch?this.ui.setBanner(`Dieser Bildschirm und der Host nutzen unterschiedliche Fassungen der Seite. Bitte auf beiden die Seite neu laden.`):this.role===`host`&&this.roomEp?.status===`offline`?this.ui.setBanner(`Signaling-Server nicht erreichbar – neue Spieler können gerade nicht beitreten. Bestehende Verbindungen laufen weiter.`):this.role!==`none`&&this.screenEp.status===`offline`?this.ui.setBanner(`Signaling-Server nicht erreichbar – ein Handy lässt sich gerade nicht neu koppeln.`):this.ui.setBanner(null)}syncPhase(e){e===`game`&&!this.inGame?this.enterGame():e===`lobby`&&this.inGame&&(this.exitGame(),this.ui.show(`lobby`))}drivers(e){let t=[];for(let n=0;n<mt.length;n++){let r=e.players.find(e=>e.slot===n);r?t.push({slot:n,name:r.name,bot:!1}):e.bots&&t.push({slot:n,name:mt[n],bot:!0})}return t}enterGame(){let e=this.lobbyState();if(e){if(this.ui.show(`game`),ne(e.track),!this.scene)try{this.scene=new cg(P(`stage`),this.quality)}catch(e){console.error(e),this.ui.showModal(`3D-Darstellung nicht möglich`,[`Dieser Browser stellt kein WebGL bereit.`],[{label:`Schließen`,run:()=>void 0}]);return}if(this.scene.setTrack(),this.scene.reset(),this.ui.setCameraLabel(!1),this.scene.onEvent=e=>this.sound.sceneEvent(e),this.scene.setRoster(this.drivers(e)),this.sound.music(s.def.theme),this.finalLapUntil=0,this.wrongWaySince=0,this.autoBrain=this.debug.autopilot?yt(this.localSlot()):null,this.shownRaceId=-1,this.resultsShown=!1,this.lastHudJson=``,this.hostLobby){let e=this.hostLobby,t=new pn(e.localSlot,{laps:this.debug.laps||void 0,aiLevel:e.aiLevel});this.hostGame=t,t.setRoster(e.slots(),e.bots);for(let n of e.state().players)n.isHost||t.setOnline(n.slot,n.online);t.onFx=(t,n)=>{t===e.localSlot?this.localFx(n):$g.has(n)&&e.sendFx(t,n)},t.newRace()}else if(this.clientLobby){let e=this.clientLobby;this.clientGame=new Ht(e.slot,()=>e.link?.rtt??-1),this.clientGame.onFx=e=>this.localFx(e)}this.inGame=!0,this.overlay.visible=this.debug.debugInRace,document.activeElement?.blur?.(),this.ticker.start()}}exitGame(){this.inGame&&(this.inGame=!1,this.ticker.stop(),this.hostGame=null,this.clientGame=null,this.ents.length=0,this.lastCmd={steer:0,buttons:0},this.ui.hideResults(),this.ui.setCountdown(null),this.ui.renderRaceHud({...Qg}),this.ui.setRaceTitle(null),this.sound.update(0,null),this.sound.music(`menu`),this.overlay.visible=this.debug.debugOverlay,this.sendHud(!0))}setQuality(e){this.quality=e;try{localStorage.setItem(`kart.quality`,e)}catch{}this.scene?.setQuality(e),this.refresh()}localFx(e){this.pairing.sendFx(e),this.sound.fx(e),e===`finallap`&&(this.finalLapUntil=performance.now()+2600)}localState(){return this.hostGame?this.hostGame.authoritative(this.hostGame.localSlot):this.clientGame?.ready?this.clientGame.predictedState():null}step(){this.ticks++;let e=performance.now()/1e3,t=yn(this.pairing.connected?this.pairing.input.sample():null,this.keyboard.sample(),this.keyboard.steering);if(this.autoBrain){let n=this.localState(),r=this.hostGame?this.hostGame.localCanDrive():this.clientGame?.localCanDrive(e)??!1;n&&(t=kt(n,this.autoBrain,[],r,{tick:this.ticks,place:1,smoke:!1}))}if(this.lastCmd=t,this.hostGame&&this.hostLobby)this.hostGame.step(t),this.hostGame.tick%Zg===0&&this.hostLobby.broadcastFast(this.hostGame.snapshot());else if(this.clientGame&&this.clientLobby){let n=this.clientGame.tick(t,e);n&&this.clientLobby.sendFast(n)}}updateRaceUi(e,t){let n=this.hostGame??this.clientGame,r=this.lobbyState();if(!n||!r)return;let i=this.ents.find(e=>e.slot===n.localSlot)??null;e.raceId!==this.shownRaceId&&(this.shownRaceId=e.raceId,this.resultsShown=!1,this.ui.hideResults(),this.sound.music(s.def.theme),this.finalLapUntil=0);let a=null;e.phase===0&&e.untilGo<=3&&e.untilGo>0?a=String(Math.ceil(e.untilGo)):e.phase!==2&&e.untilGo<=0&&e.untilGo>-1.1&&(a=`Los!`),this.ui.setCountdown(a),this.sound.countdown(a),this.ui.setHudNoteVisible(e.phase===0);let o=e.phase===0&&e.untilGo>3.15&&e.untilGo<345/60;this.ui.setRaceTitle(o?s.def.name:null,`Strecke ${s.index+1} · ${e.laps} ${e.laps===1?`Runde`:`Runden`}`),this.sound.roulette((i?.roulette??0)>0,t);let c=!1;if(i&&e.phase===1&&!i.finished&&i.respawn===0&&i.spin===0){let e=i.seg%s.n,n=i.vx*s.tx[e]+i.vz*s.tz[e],r=Math.sin(i.heading)*s.tx[e]+Math.cos(i.heading)*s.tz[e];n<-3&&r<-.3?(this.wrongWaySince===0&&(this.wrongWaySince=t),c=t-this.wrongWaySince>900):this.wrongWaySince=0}else this.wrongWaySince=0;let l=new Map(this.drivers(r).map(e=>[e.slot,e.name])),u=this.ents.length;if(this.ui.renderRaceHud({visible:i!==null,place:i?.place??0,of:u,lap:i?.lap??1,laps:e.laps,timeSec:e.phase===1||e.phase===2?Math.max(0,-e.untilGo):0,frozenTime:i?.finished??!1,item:i?.item??0,rolling:(i?.roulette??0)>0,speedKmh:i?Math.round(Math.hypot(i.vx,i.vz)*3.6):0,finished:(i?.finished??!1)&&e.phase!==2,order:n.standings().map(e=>({slot:e.slot,name:l.get(e.slot)??`Fahrer ${e.slot+1}`,me:e.slot===n.localSlot,done:e.finished})),banner:c?`Falsch herum!`:t<this.finalLapUntil?`Letzte Runde!`:null,bannerTone:c?`bad`:`info`,fps:this.showFps&&this.scene?this.scene.stats.fps:null,smoke:this.scene?.smoke??0}),e.phase===2&&!this.resultsShown){this.resultsShown=!0;let e=new Map(this.drivers(r).map(e=>[e.slot,e])),t=n.standings().map(t=>({place:t.place,slot:t.slot,name:e.get(t.slot)?.name??`Fahrer ${t.slot+1}`,bot:t.bot,me:t.slot===n.localSlot,timeSec:t.finished?t.finishTicks/60:-1}));this.ui.showResults(t,this.role===`host`,s.def.name),this.sound.music(`results`),this.sound.results(i?.place??t.find(e=>e.me)?.place??0,t.length)}t-this.lastHudAt>120&&(this.lastHudAt=t,this.sendHud(!1))}sendHud(e){let t=this.hostGame??this.clientGame,n=t?this.ents.find(e=>e.slot===t.localSlot):void 0,r=t?.race(performance.now()/1e3),i={racing:this.inGame&&!!n&&!!r&&r.phase!==2,item:n?.item??0,rolling:(n?.roulette??0)>0,place:n?.place??0,of:this.ents.length,lap:n?.lap??0,laps:r?.laps??0},a=JSON.stringify(i);(e||a!==this.lastHudJson)&&(this.lastHudJson=a,this.pairing.sendHud(i))}everySecond(){if(this.seconds++,this.rates.fps=this.frames,this.frames=0,this.rates.tick=this.ticks,this.ticks=0,this.rates.ctrl=this.pairing.input.packets-this.prev.ctrl,this.prev.ctrl=this.pairing.input.packets,this.clientGame?(this.rates.snap=this.clientGame.stats.snapshots-this.prev.snap,this.prev.snap=this.clientGame.stats.snapshots,this.rates.peakCorrection=this.clientGame.stats.peakCorrection,this.clientGame.stats.peakCorrection=0):(this.rates.snap=0,this.prev.snap=0),this.hostGame){this.seatRates.clear();for(let[e,t]of this.hostGame.drainCmdCounts())this.seatRates.set(e,t)}if(this.reportController(),this.clientLobby?.status===`reconnecting`&&this.updateBanner(),this.clientLobby?.status===`connecting`&&Date.now()-this.joinStartedAt>8e3){let e=Math.max(0,Math.ceil((this.clientLobby.deadline-Date.now())/1e3));this.ui.setHomeMessage(`Die Verbindung zu Lobby ${this.clientLobby.code} kommt bisher nicht zustande. Das passiert meist, wenn ein Gerät im Mobilfunk-, Schul- oder Firmennetz hängt${this.setup.turn.available?``:` und kein TURN-Server eingerichtet ist`}. Ich versuche es weiter${e>0?` (noch ${e} s)`:``} …`)}this.seconds%2==0&&this.refreshPaths()}async refreshPaths(){await this.pairing.refreshPath();let e=this.clientLobby?.link;if(this.hostPath=e&&e.state===`open`?await e.getPath():null,this.hostLobby){let e=this.hostLobby,t=new Set;for(let n of e.slots()){let r=e.linkOf(n);r&&(t.add(n),this.seatPaths.set(n,await r.getPath()))}for(let e of[...this.seatPaths.keys()])t.has(e)||this.seatPaths.delete(e)}}channelRow(e){return e.fastIsUnreliable?{label:`Schneller Kanal`,value:`unreliable, ungeordnet`,tone:`ok`}:{label:`Schneller Kanal`,value:`Ersatzweg (zuverlässig)`,tone:`warn`}}collectDebug(){let e=[],t=this.setup.turn,n=t.available?`eingerichtet`:`nicht eingerichtet`,r=t.available?`ok`:`warn`;t.mode===`force`&&(n+=` · erzwungen (Test)`),t.mode===`off`&&(n=`abgeschaltet (Test)`,r=`warn`),t.error&&(n=t.error,r=`bad`);let i=[{label:`Version`,value:N},{label:`Rolle`,value:this.role===`host`?`Host`:this.role===`client`?`Mitspieler`:`–`},{label:`Signaling`,...r_(this.screenEp.status)}];this.roomEp&&i.push({label:`Signaling Raum`,...r_(this.roomEp.status)}),i.push({label:`TURN`,value:n,tone:r});let a=this.linkOptions.netSim;a&&(a.lag||a.jitter||a.loss)&&i.push({label:`Netz-Simulation`,value:`+${a.lag} ms, Jitter ${a.jitter} ms, Verlust ${a.loss} %`,tone:`warn`}),i.push({label:`Bildrate`,value:`${this.rates.fps} FPS`,tone:this.rates.fps>=55?`ok`:this.rates.fps>=30?`warn`:`bad`}),this.inGame&&i.push({label:`Simulation`,value:`${this.rates.tick} Schritte/s`}),i.push({label:`Wachhalten`,value:{native:`Wake Lock`,video:`Video-Ersatz`,none:`inaktiv`}[w()]}),e.push({title:`Dieser Bildschirm`,rows:i});let o=this.pairing,s=[];if(o.link&&o.connected?(s.push({label:`Status`,value:`verbunden`,tone:`ok`}),s.push({label:`Weg`,...i_(o.path)}),s.push({label:`Latenz`,value:a_(o.rtt)}),this.rates.ctrl===0&&o.info.sendHz===0?s.push({label:`Eingaben`,value:`Handy wartet auf „Tippen zum Starten“`,tone:`warn`}):(s.push({label:`Eingaben`,value:`${this.rates.ctrl}/s empfangen · Handy sendet ${o.info.sendHz}/s`,tone:this.rates.ctrl>=50?`ok`:this.rates.ctrl>=30?`warn`:`bad`}),s.push({label:`Sensor`,value:o.info.tilt?`Neigung, ${o.info.sensorHz} Hz`:`Touch-Lenkung (kein Neigungssensor aktiv)`})),s.push(this.channelRow(o.link))):s.push({label:`Status`,value:`kein Handy verbunden`,tone:`warn`}),e.push({title:`Handy → Bildschirm`,rows:s}),this.clientLobby){let t=this.clientLobby,n=[];if(t.link&&t.status===`joined`){if(n.push({label:`Status`,value:`verbunden`,tone:`ok`}),n.push({label:`Weg`,...i_(this.hostPath)}),n.push({label:`Latenz`,value:a_(t.link.rtt)}),n.push(this.channelRow(t.link)),this.clientGame){let e=this.clientGame.stats;n.push({label:`Snapshots`,value:`${this.rates.snap}/s`,tone:this.rates.snap>=25?`ok`:this.rates.snap>=15?`warn`:`bad`}),n.push({label:`Vorhersage`,value:`${e.pending} Eingaben unbestätigt`}),n.push({label:`Korrektur`,value:`max. ${this.rates.peakCorrection.toFixed(2)} m in der letzten Sekunde`,tone:this.rates.peakCorrection<.15?`ok`:this.rates.peakCorrection<1?`warn`:`bad`}),n.push({label:`Andere Fahrzeuge`,value:`${Math.round(Lt*1e3)} ms verzögert dargestellt`})}}else n.push({label:`Status`,value:t.status===`reconnecting`?`verbinde neu …`:`verbinde …`,tone:`bad`});e.push({title:`Bildschirm → Host`,rows:n})}if(this.hostLobby){let t=[];for(let e of this.hostLobby.state().players){if(e.isHost)continue;let n=this.hostLobby.linkOf(e.slot);if(!n){t.push({label:e.name,value:`getrennt`,tone:`bad`});continue}let r=i_(this.seatPaths.get(e.slot)??null),i=this.seatRates.get(e.slot),a=[r.value,a_(n.rtt)];this.inGame&&i&&a.push(`${i.received} Eingaben/s`,`Puffer ${i.queued}`),n.fastIsUnreliable||a.push(`Ersatzweg`),t.push({label:e.name,value:a.join(` · `),tone:r.tone})}t.length===0&&t.push({label:`Mitspieler`,value:`noch keiner verbunden`}),e.push({title:`Mitspieler → Host`,rows:t})}return e}installTestHook(){window.__kart={role:()=>this.role,view:()=>this.ui.view,lobby:()=>this.lobbyState(),slot:()=>this.localSlot(),pairUrl:()=>this.pairUrl(),inviteUrl:()=>{let e=this.lobbyState();return e?this.inviteUrl(e.code):null},cmd:()=>({...this.lastCmd}),entities:()=>this.ents.map(e=>({...e})),authoritative:e=>{let t=this.hostGame?.authoritative(e);return t?{...t}:null},predicted:()=>this.clientGame?.ready?{...this.clientGame.predictedState()}:null,race:()=>(this.hostGame??this.clientGame)?.race(performance.now()/1e3)??null,standings:()=>(this.hostGame??this.clientGame)?.standings()??[],things:()=>((this.hostGame??this.clientGame)?.things(performance.now()/1e3)??[]).map(e=>({...e})),track:()=>{let e=-1,t=-1;for(let n=0;n<s.n;n++)e<0&&s.edge[n]&4&&(e=n),t<0&&(s.edge[n]&7)==3&&(t=n);return{index:s.index,name:s.def.name,length:s.length,gapAt:e*s.step,openAt:t*s.step,halfWidth:t>=0?s.wh[t]:0}},scene:()=>this.scene?{...this.scene.stats,smoke:this.scene.smoke}:null,audio:()=>this.sound.debug(),place:(e,t,n=0)=>this.hostGame?.debugPlace(e,t,n),giveItem:(e,t)=>this.hostGame?.giveItem(e,t),debugHit:e=>this.hostGame?.debugHit(e),clientStats:()=>this.clientGame?{...this.clientGame.stats,peak:this.rates.peakCorrection}:null,rates:()=>({...this.rates}),controller:()=>({connected:this.pairing.connected,rtt:this.pairing.rtt,unreliable:this.pairing.link?.fastIsUnreliable??!1,path:this.pairing.path,info:this.pairing.info}),hostLink:()=>{let e=this.clientLobby?.link;return e?{state:e.state,rtt:e.rtt,unreliable:e.fastIsUnreliable,path:this.hostPath}:null},clientStatus:()=>this.clientLobby?.status??null,signaling:()=>({screen:this.screenEp.status,room:this.roomEp?.status??null}),dropHostLink:()=>this.clientLobby?.link?.close(),dropControllerLink:()=>this.pairing.link?.close()}}}().boot();