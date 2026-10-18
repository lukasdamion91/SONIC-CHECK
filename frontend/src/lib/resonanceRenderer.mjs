// Approved HARRY identity: nine fixed knots, an eight-second breath and one blended colour family per active component.
import { RESONANCE_GLOW_BOOST, RESONANCE_BREATH_SECONDS } from "./resonanceIdentity.mjs";
export function createResonanceRenderer(canvas) {
  const ctx=canvas.getContext('2d',{alpha:true});
  if(!ctx)return null;
  const TAU=Math.PI*2, STEPS=240, WIRES=12, FORMS=9, DEPTHS=26, SHADES=6, MATERIALS=2;
  const wires=[],beads=[];
  const buckets=Array.from({length:DEPTHS*FORMS*SHADES*MATERIALS},()=>[]);
  const beadBuckets=Array.from({length:DEPTHS},()=>[]);
  const SIGNAL_LEVELS=6;
  const signalBuckets=Array.from({length:DEPTHS*FORMS*SIGNAL_LEVELS},()=>[]);
  const signalNodes=Array.from({length:DEPTHS},()=>[]);
  const hex=s=>[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)];
  // Lilac, baby powder blue, pale lavender, pale magenta and very pale light green.
  // Existing tints retain their hues; both previews receive metallic shading.
  const palette=['#c8a2dc','#b9d9ef','#cbbaf2','#eab2e6','#e2f4d3'].map(hex);
  const mint=hex('#bcebd8'),freshMint=hex('#a2e6cb'),seafoam=hex('#91d6bb'),white=hex('#f4f6f8');
  const fixedTints=[freshMint,mint,seafoam,white,hex('#dce4e8')];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit=a=>{const m=Math.hypot(...a);return a.map(v=>v/m);};
  const center=t=>{const r=1.45+.62*Math.cos(3*t);return[r*Math.cos(2*t),r*Math.sin(2*t),.76*Math.sin(3*t)];};
  const fixed=p=>{
    const a=-.24,b=.40;
    const x=p[0]*Math.cos(a)-p[1]*Math.sin(a),y=p[0]*Math.sin(a)+p[1]*Math.cos(a);
    return[x*.98,(y*Math.cos(b)-p[2]*Math.sin(b))*1.08,y*Math.sin(b)+p[2]*Math.cos(b)];
  };
  function placeForm(p,form){
    if(form===0)return fixed(p);
    // All nine fixed, intersecting orientations share both rotation axes.
    const orientations=[[0,0,0,0],[Math.PI/3,.92,0,.10],[-Math.PI/3,-.92,0,-.10],[1.9,.36,.98,.09],[-1.9,-.36,-.98,-.09],[.24,Math.PI/2,.24,0],[-.54,-Math.PI/2,.42,.025],[1.11,.72,-1.32,-.025],[-1.28,.62,1.12,.018]];
    const [a,b,c,offset]=orientations[form];
    const x=p[0]*Math.cos(a)-p[1]*Math.sin(a),y=p[0]*Math.sin(a)+p[1]*Math.cos(a);
    const yy=y*Math.cos(b)-p[2]*Math.sin(b),zz=y*Math.sin(b)+p[2]*Math.cos(b);
    return fixed([x*Math.cos(c)+zz*Math.sin(c)+offset,yy,-x*Math.sin(c)+zz*Math.cos(c)-offset]);
  }
  for(let form=0;form<FORMS;form++){
    for(let j=0;j<WIRES;j++){
      const points=[],phase=j*TAU/WIRES,radius=.190+.045*Math.sin(j*2.399963);
      for(let i=0;i<=STEPS;i++){
        const t=i*TAU/STEPS,p=center(t),p1=center(t+.0001),p0=center(t-.0001);
        const tangent=unit(p1.map((v,k)=>v-p0[k]));
        const normal=unit(cross(tangent,[0,0,1])),binormal=cross(tangent,normal);
        const a=phase+2*t+.075*Math.sin(5*t+j),r=radius*(1+.055*Math.sin(4*t+j*.47));
        points.push(placeForm(p.map((v,k)=>v+r*(normal[k]*Math.cos(a)+binormal[k]*Math.sin(a))),form));
      }
      wires.push({points,form,material:j%3===0?1:0});
    }
    for(let n=0;n<13;n++){
      const wire=wires[form*WIRES+(n*17+3)%WIRES];
      const index=Math.floor(((n*.61803398875+.083)%1)*STEPS);
      beads.push({p:wire.points[index],form,size:n%8===0?.037:n%4===0?.026:.015,glow:n%4===0});
    }
  }
  const BREATH_SECONDS=RESONANCE_BREATH_SECONDS;
  const yaw=-.18,diagonal=0;
  let width=400,elapsed=0,lift=RESONANCE_GLOW_BOOST;
  let activeEvent={kind:'receive',start:0};
  let state={mode:'metallic',activeIds:[]}, blend=0, previousTime=null;
  let lastKey='', eventStart=0, familyHue=null;
  const formComponents=['lyric_overlap','lyric_overlap','relational_specificity','recording_identity','composition_similarity','interval_path_specificity','interval_path_specificity','lyric_order_recovery','relational_specificity'];
  const componentHex={recording_identity:'#20c5ea',lyric_overlap:'#ccff33',composition_similarity:'#3ca1ee',relational_specificity:'#5ee2c4',lyric_order_recovery:'#c466dc',interval_path_specificity:'#8a8deb'};
  const hueOf=rgb=>{
    const [r,g,b]=rgb.map(v=>v/255),high=Math.max(r,g,b),low=Math.min(r,g,b),delta=high-low;
    if(!delta)return 0;
    return ((high===r?(g-b)/delta:high===g?(b-r)/delta+2:(r-g)/delta+4)*60+360)%360;
  };
  const componentHues=Object.fromEntries(Object.entries(componentHex).map(([id,value])=>[id,hueOf(hex(value))]));
  const hslToRgb=(h,s,l)=>{
    const c=(1-Math.abs(2*l-1))*s,hp=((h%360)+360)%360/60,x=c*(1-Math.abs(hp%2-1)),m=l-c/2;
    const rgb=hp<1?[c,x,0]:hp<2?[x,c,0]:hp<3?[0,c,x]:hp<4?[0,x,c]:hp<5?[x,0,c]:[c,0,x];
    return rgb.map(v=>(v+m)*255);
  };
  // All nine knots share ONE hue family. Small hue shifts and lightness differences
  // retain the interwoven depth; specular highlights still use the metallic renderer.
  const tonalOffsets=[[-4,.98,.54],[3,.84,.64],[5,.96,.47],[-2,.90,.59],[0,.72,.70],[-5,1,.52],[2,.86,.61],[4,.92,.45],[-1,.78,.66]];
  const tonalPalette=hue=>tonalOffsets.map(([offset,s,l])=>hslToRgb(hue+offset,s,l));
  // Each junction has two branches that follow the existing 3D knot exactly.
  const junctions=Array.from({length:FORMS},(_,form)=>({
    form,wire:wires[form*WIRES+(form*5+3)%WIRES],index:40+(form%3)*80
  }));
  function colourPair(t){
    const cycle=palette,fixed=fixedTints;
    const phase=(t%40)/8,i=Math.floor(phase);
    let f=phase-i;f=f*f*(3-2*f);
    // Four knots cycle through the existing palette; mint, seafoam and white stay constant.
    return Array.from({length:FORMS},(_,form)=>form>=4?fixed[form-4]:cycle[(i+form)%cycle.length].map((v,k)=>v+(cycle[(i+form+1)%cycle.length][k]-v)*f));
  }
  function breathingAt(t){return 1+.036*Math.sin(t*TAU/BREATH_SECONDS);}
  function project(p,cy,sy,breath,cd,sd){
    const x0=p[0]*cy+p[2]*sy,y0=p[1],z0=-p[0]*sy+p[2]*cy;
    // Rodrigues rotation about a diagonal axis halfway between horizontal and vertical.
    const a=Math.SQRT1_2,dot=a*(x0+y0),arc=a*dot*(1-cd);
    const x=(x0*cd+a*z0*sd+arc)*breath;
    const y=(y0*cd-a*z0*sd+arc)*breath;
    const z=(z0*cd+a*(y0-x0)*sd)*breath;
    const perspective=width*.99/(6.8-z);
    return[width*.5+x*perspective,width*.5-y*perspective,z,perspective];
  }
  const depth=z=>Math.max(0,Math.min(DEPTHS-1,Math.floor((z+2.8)/5.6*DEPTHS)));
  const clamp01=x=>Math.max(0,Math.min(1,x));
  function pointOnWire(wire,index){
    const t=((index%STEPS)+STEPS)%STEPS,i=Math.floor(t),f=t-i;
    return wire.points[i].map((v,k)=>v+(wire.points[i+1][k]-v)*f);
  }
  function buildSignals(cy,sy,breath,cd,sd){
    for(const b of signalBuckets)b.length=0;
    for(const b of signalNodes)b.length=0;
    if(!state.activeIds.length||state.mode!=='spectrum')return;
    const projectSignal=p=>project(p,cy,sy,breath,cd,sd);
    const addSegment=(a,b,energy,form)=>{
      if(energy<.045)return;
      const p=projectSignal(a),q=projectSignal(b),d=depth((p[2]+q[2])*.5);
      const level=Math.min(SIGNAL_LEVELS-1,Math.floor(clamp01(energy)*SIGNAL_LEVELS));
      signalBuckets[(d*FORMS+form)*SIGNAL_LEVELS+level].push(p[0],p[1],q[0],q[1]);
    };
    const addNode=(p,energy,form,size=1)=>{
      if(energy<.05)return;
      const point=projectSignal(p);
      signalNodes[depth(point[2])].push({p:point,energy:clamp01(energy),form,size});
    };
    const age=elapsed-activeEvent.start,receiving=activeEvent.kind==='receive';
    for(const junction of junctions){
      const {form,wire,index}=junction;
      if(!state.activeIds.includes(formComponents[form]))continue;
      let junctionEnergy=0;
      for(const direction of [-1,1]){
        const delay=(form%3)*.12+Math.floor(form/3)*.075+(direction===1?.055:0);
        const duration=receiving?1.7:1.45,q=(age-delay)/duration;
        if(q>=0&&q<1.36){
          const envelope=clamp01(q/.1)*clamp01((1.36-q)/.22);
          for(let step=0;step<40;step++){
            const u=(step+.5)/40,travel=receiving?1-u:u,behind=q-travel;
            if(behind<-.025||behind>.34)continue;
            const energy=envelope*(behind<0?1+behind/.025:Math.pow(1-behind/.34,1.2));
            addSegment(wire.points[index+direction*step],wire.points[index+direction*(step+1)],energy,form);
          }
          if(q<=1){
            const u=receiving?1-q:q;
            addNode(pointOnWire(wire,index+direction*40*u),envelope*.85,form,.65);
          }
        }
        const fireTime=delay+(receiving?duration:0.16);
        junctionEnergy=Math.max(junctionEnergy,Math.exp(-Math.pow((age-fireTime)/.38,2)));
      }
      // After reception, a second wave relays information around the interwoven paths.
      const relayAge=age-2.02-form*.07;
      if(receiving&&relayAge>=0&&relayAge<2.65){
        const head=index+relayAge*42,envelope=clamp01(relayAge/.18)*clamp01((2.65-relayAge)/.45);
        for(let step=0;step<19;step++){
          const end=head-step,energy=.72*envelope*Math.pow(1-step/19,1.2);
          addSegment(pointOnWire(wire,end-1),pointOnWire(wire,end),energy,form);
        }
        addNode(pointOnWire(wire,head),envelope*.56,form,.7);
      }
      addNode(wire.points[index],junctionEnergy,form,1.2);
    }
  }
  function paintSignals(ctx,d,tints,glowGain){
    const scale=width/313.344;
    for(let form=0;form<FORMS;form++){
      const tint=tints[form],halo=tint.map(Math.round).join(',');
      const core=tint.map(v=>Math.round(v*.22+255*.78)).join(',');
      for(let level=0;level<SIGNAL_LEVELS;level++){
        const segments=signalBuckets[(d*FORMS+form)*SIGNAL_LEVELS+level];
        if(!segments.length)continue;
        const energy=(level+1)/SIGNAL_LEVELS,front=.55+.45*d/DEPTHS;
        ctx.beginPath();
        for(let k=0;k<segments.length;k+=4){ctx.moveTo(segments[k],segments[k+1]);ctx.lineTo(segments[k+2],segments[k+3]);}
        ctx.strokeStyle=`rgba(${halo},${Math.min(.42,.16*energy*glowGain)})`;ctx.lineWidth=10*scale;ctx.stroke();
        ctx.strokeStyle=`rgba(${halo},${.65*energy*front})`;ctx.lineWidth=4.4*scale;ctx.stroke();
        ctx.strokeStyle=`rgba(${core},${.98*energy*front})`;ctx.lineWidth=1.85*scale;ctx.stroke();
      }
    }
    for(const node of signalNodes[d]){
      const [x,y]=node.p,tint=tints[node.form],energy=node.energy*(.6+.4*d/DEPTHS);
      const radius=(5+energy*6)*scale*node.size,halo=ctx.createRadialGradient(x,y,0,x,y,radius);
      const rgb=tint.map(Math.round).join(',');
      halo.addColorStop(0,`rgba(${rgb},${Math.min(.95,energy*.8)})`);
      halo.addColorStop(.3,`rgba(${rgb},${energy*.36})`);halo.addColorStop(1,`rgba(${rgb},0)`);
      ctx.fillStyle=halo;ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fill();
      ctx.fillStyle=`rgba(${tint.map(v=>Math.round(v*.25+255*.75)).join(',')},${energy})`;
      ctx.beginPath();ctx.arc(x,y,Math.max(.5,1.6*scale*node.size),0,TAU);ctx.fill();
    }
  }
  function draw(){
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cd=Math.cos(diagonal),sd=Math.sin(diagonal);
    const breathWave=Math.sin(elapsed*TAU/BREATH_SECONDS),breath=breathingAt(elapsed);
    const gain=(1+lift/180)*(1+.048*breathWave),glowGain=(1+lift/65)*(1+.1344*breathWave);
    const restingGain=1;
    const pulse=Array.from({length:FORMS},(_,form)=>.96+.04*Math.sin(elapsed*TAU/7+form*TAU/FORMS));
    for(const b of buckets)b.length=0;
    for(const b of beadBuckets)b.length=0;
    for(const wire of wires){
      let prev=project(wire.points[0],cy,sy,breath,cd,sd);
      for(let i=1;i<=STEPS;i++){
        const p=project(wire.points[i],cy,sy,breath,cd,sd),z=(prev[2]+p[2])*.5;
        const dx=p[0]-prev[0],dy=p[1]-prev[1];
        const orient=Math.abs((dx*.6-dy*.8)/(Math.hypot(dx,dy)||1));
        const light=Math.min(1,.13+.37*((z+2.8)/5.6)+.50*Math.pow(orient,7));
        const shade=Math.max(0,Math.min(SHADES-1,Math.floor(light*SHADES)));
        buckets[((depth(z)*FORMS+wire.form)*SHADES+shade)*MATERIALS+wire.material].push(prev[0],prev[1],p[0],p[1]);
        prev=p;
      }
    }
    for(const bead of beads){const p=project(bead.p,cy,sy,breath,cd,sd);beadBuckets[depth(p[2])].push({p,size:bead.size*p[3],glow:bead.glow,form:bead.form});}
    buildSignals(cy,sy,breath,cd,sd);
    {
      const metallic=colourPair(elapsed),tonal=tonalPalette(familyHue??componentHues.recording_identity);
      const tints=metallic.map((tint,form)=>tint.map((v,k)=>v+(tonal[form][k]-v)*blend));
      const variantGlow=glowGain*(1+.8*blend);
      ctx.clearRect(0,0,width,width);
    for(let form=0;form<FORMS;form++){
      const rgb=tints[form].map(Math.round).join(',');
      const x=width*(.36+form*.28/(FORMS-1));
      const glow=ctx.createRadialGradient(x,width*.5,0,x,width*.5,width*.40);
      glow.addColorStop(0,`rgba(${rgb},${.014*variantGlow})`);glow.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=glow;ctx.fillRect(0,0,width,width);
    }
    ctx.lineCap='round';ctx.lineJoin='round';
    // Shared back-to-front buckets interleave all nine at their real depths.
    for(let d=0;d<DEPTHS;d++){
      for(let form=0;form<FORMS;form++)for(let shade=0;shade<SHADES;shade++)for(let material=0;material<MATERIALS;material++){
        const b=buckets[((d*FORMS+form)*SHADES+shade)*MATERIALS+material];if(!b.length)continue;
        // Dark reflections, coloured midtones and narrow silver highlights give every hue a metal finish.
        const reflection=[.20,.30,.46,.65,.88,1.06][shade];
        const value=(reflection+blend*.12)*(material===1?1.06:1)*gain*pulse[form]*restingGain;
        const silver=[.015,.025,.045,.09,.26,.60][shade]+(material===1?.08:0);
        const rgb=tints[form].map(v=>Math.min(255,Math.round((246*silver+v*(1-silver))*value)));
        const line=width/435.2*(material===1?.80+shade*.095:.74+shade*.080);
        ctx.beginPath();for(let k=0;k<b.length;k+=4){ctx.moveTo(b[k],b[k+1]);ctx.lineTo(b[k+2],b[k+3]);}
        if(shade>=3){
          const halo=tints[form].map(Math.round).join(',');
          ctx.strokeStyle=`rgba(${halo},${(.007+shade*.0025)*variantGlow*restingGain})`;ctx.lineWidth=line+6.0;ctx.stroke();
          ctx.strokeStyle=`rgba(${halo},${(.015+shade*.006)*variantGlow*restingGain})`;ctx.lineWidth=line+2.3;ctx.stroke();
        }
        ctx.strokeStyle=`rgba(${rgb.join(',')},${.70+d/DEPTHS*.28})`;ctx.lineWidth=line;ctx.stroke();
        if(shade>=4){
          const glint=tints[form].map(v=>Math.round(v*.28+255*.72)).join(',');
          ctx.strokeStyle=`rgba(${glint},${(shade===5?.78:.34)*(.68+d/DEPTHS*.32)*restingGain})`;
          ctx.lineWidth=line*.34;ctx.stroke();
        }
      }
      for(const bead of beadBuckets[d]){
        const tint=tints[bead.form],front=.46+.54*d/DEPTHS,[x,y]=bead.p,r=Math.max(.65,bead.size);
        if(bead.glow){const haloRadius=r*(4.8+variantGlow*1.6),h=ctx.createRadialGradient(x,y,0,x,y,haloRadius);h.addColorStop(0,`rgba(${tint.map(Math.round).join(',')},${Math.min(.9,.5*front*variantGlow)})`);h.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=h;ctx.beginPath();ctx.arc(x,y,haloRadius,0,TAU);ctx.fill();}
        const grad=ctx.createRadialGradient(x-r*.3,y-r*.35,r*.02,x,y,r),silver=Math.min(255,Math.round(225*front*gain));
        grad.addColorStop(0,`rgb(${silver},${silver},${silver})`);
        grad.addColorStop(.32,`rgb(${tint.map(v=>Math.min(255,Math.round((v*.7+70)*front*gain))).join(',')})`);
        grad.addColorStop(.78,`rgb(${tint.map(v=>Math.round(v*.46*front)).join(',')})`);grad.addColorStop(1,'#17232d');
        ctx.fillStyle=grad;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
      }
      paintSignals(ctx,d,tints,variantGlow);
    }
    }
  }
  return {
    resize(cssWidth,dpr=1){
      width=Math.max(1,cssWidth);
      const ratio=Math.min(2,Math.max(1,dpr));
      canvas.width=Math.round(width*ratio);canvas.height=Math.round(width*ratio);
      ctx.setTransform(ratio,0,0,ratio,0,0);
    },
    draw(time,nextState={mode:'metallic',activeIds:[]},{instant=false}={}){
      elapsed=Math.max(0,Number.isFinite(time)?time:0);
      state={mode:nextState.mode==='spectrum'?'spectrum':'metallic',activeIds:Array.isArray(nextState.activeIds)?nextState.activeIds.filter(id=>Object.hasOwn(componentHex,id)):[]};
      if(state.mode==='metallic')state.activeIds=[];
      const dt=previousTime===null?0:Math.max(0,elapsed-previousTime);
      const factor=instant||previousTime===null?1:1-Math.exp(-dt/.28);
      blend+=(Number(state.mode==='spectrum')-blend)*factor;
      const targetHue=componentHues[state.activeIds[0]]??familyHue??componentHues.recording_identity;
      if(instant||familyHue===null)familyHue=targetHue;
      else familyHue=(familyHue+((targetHue-familyHue+540)%360-180)*factor+360)%360;
      const key=state.activeIds.join('|');
      if(key!==lastKey){eventStart=elapsed;lastKey=key;}
      // A travelling light illustrates an explicitly reported running component.
      // It does not measure progress, count commands, or infer missing telemetry.
      activeEvent={kind:'receive',start:elapsed-((elapsed-eventStart)%5.4)};
      previousTime=elapsed;
      draw();
    },
  };
}
