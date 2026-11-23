// PixQX v0.7 -- pure per-pixel filter functions (no shared mutable state)

const filters = {
    grayscale: d => { for (let i=0;i<d.length;i+=4){ const a=(d[i]+d[i+1]+d[i+2])/3; d[i]=d[i+1]=d[i+2]=a; } },
    invert: d => { for (let i=0;i<d.length;i+=4){ d[i]=255-d[i]; d[i+1]=255-d[i+1]; d[i+2]=255-d[i+2]; } },
    sepia: d => { for (let i=0;i<d.length;i+=4){
        const r=d[i],g=d[i+1],b=d[i+2];
        d[i]   = Math.min(255, r*0.393 + g*0.769 + b*0.189);
        d[i+1] = Math.min(255, r*0.349 + g*0.686 + b*0.168);
        d[i+2] = Math.min(255, r*0.272 + g*0.534 + b*0.131);
    } },
    brightnessUp: d => { for (let i=0;i<d.length;i+=4){ d[i]=Math.min(255,d[i]+24); d[i+1]=Math.min(255,d[i+1]+24); d[i+2]=Math.min(255,d[i+2]+24); } },
    brightnessDown: d => { for (let i=0;i<d.length;i+=4){ d[i]=Math.max(0,d[i]-24); d[i+1]=Math.max(0,d[i+1]-24); d[i+2]=Math.max(0,d[i+2]-24); } },
    contrastUp: d => { const f=1.25; for (let i=0;i<d.length;i+=4){ d[i]=clamp((d[i]-128)*f+128); d[i+1]=clamp((d[i+1]-128)*f+128); d[i+2]=clamp((d[i+2]-128)*f+128); } },
    contrastDown: d => { const f=0.8; for (let i=0;i<d.length;i+=4){ d[i]=clamp((d[i]-128)*f+128); d[i+1]=clamp((d[i+1]-128)*f+128); d[i+2]=clamp((d[i+2]-128)*f+128); } },
    saturateUp: d => { const f=1.4; for (let i=0;i<d.length;i+=4){
        const lum = 0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
        d[i]=clamp(lum+(d[i]-lum)*f); d[i+1]=clamp(lum+(d[i+1]-lum)*f); d[i+2]=clamp(lum+(d[i+2]-lum)*f);
    } },
    saturateDown: d => { const f=0.6; for (let i=0;i<d.length;i+=4){
        const lum = 0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
        d[i]=clamp(lum+(d[i]-lum)*f); d[i+1]=clamp(lum+(d[i+1]-lum)*f); d[i+2]=clamp(lum+(d[i+2]-lum)*f);
    } },
    hueRotate: d => { const deg = 30; const rad = deg * Math.PI / 180; const cosA = Math.cos(rad), sinA = Math.sin(rad);
        // Standard hue-rotate matrix (same approach browsers use for CSS hue-rotate filter)
        const m = [
          0.213+cosA*0.787-sinA*0.213, 0.715-cosA*0.715-sinA*0.715, 0.072-cosA*0.072+sinA*0.928,
          0.213-cosA*0.213+sinA*0.143, 0.715+cosA*0.285+sinA*0.140, 0.072-cosA*0.072-sinA*0.283,
          0.213-cosA*0.213-sinA*0.787, 0.715-cosA*0.715+sinA*0.715, 0.072+cosA*0.928+sinA*0.072
        ];
        for (let i=0;i<d.length;i+=4){
          const r=d[i], g=d[i+1], b=d[i+2];
          d[i]   = clamp(r*m[0] + g*m[1] + b*m[2]);
          d[i+1] = clamp(r*m[3] + g*m[4] + b*m[5]);
          d[i+2] = clamp(r*m[6] + g*m[7] + b*m[8]);
        }
    },
    posterize: d => { const levels = 4; const step = 255/(levels-1);
        for (let i=0;i<d.length;i+=4){
          d[i]=Math.round(Math.round(d[i]/step)*step);
          d[i+1]=Math.round(Math.round(d[i+1]/step)*step);
          d[i+2]=Math.round(Math.round(d[i+2]/step)*step);
        }
    },
    threshold: d => { for (let i=0;i<d.length;i+=4){
        const lum = 0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
        const v = lum > 128 ? 255 : 0;
        d[i]=d[i+1]=d[i+2]=v;
    } },
    noise: d => { const amount = 30; for (let i=0;i<d.length;i+=4){
        const n = (Math.random()-0.5)*amount*2;
        d[i]=clamp(d[i]+n); d[i+1]=clamp(d[i+1]+n); d[i+2]=clamp(d[i+2]+n);
    } },
    warm: d => { for (let i=0;i<d.length;i+=4){ d[i]=clamp(d[i]+18); d[i+2]=clamp(d[i+2]-18); } },
    cool: d => { for (let i=0;i<d.length;i+=4){ d[i]=clamp(d[i]-18); d[i+2]=clamp(d[i+2]+18); } },
  };
  function clamp(v){ return Math.max(0, Math.min(255, v)); }

  function vignette(layer) {
    const w = layer.canvas.width, h = layer.canvas.height;
    const imgData = layer.ctx.getImageData(0,0,w,h);
    const d = imgData.data;
    const cx = w/2, cy = h/2;
    const maxDist = Math.sqrt(cx*cx + cy*cy);
    for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
      const dist = Math.sqrt((x-cx)*(x-cx) + (y-cy)*(y-cy)) / maxDist;
      const factor = clamp(1 - Math.pow(dist, 2.2)) / 1;
      const f = 0.35 + 0.65 * factor;
      const i = (y*w+x)*4;
      d[i] = d[i] * f; d[i+1] = d[i+1] * f; d[i+2] = d[i+2] * f;
    }
    layer.ctx.putImageData(imgData,0,0);
  }

  function pixelate(layer) {
    const w = layer.canvas.width, h = layer.canvas.height;
    const block = Math.max(4, Math.round(Math.min(w,h) / 60));
    const src = layer.ctx.getImageData(0,0,w,h);
    const dst = layer.ctx.createImageData(w,h);
    for (let by=0; by<h; by+=block) {
      for (let bx=0; bx<w; bx+=block) {
        let r=0,g=0,b=0,a=0,c=0;
        for (let y=by; y<Math.min(by+block,h); y++) for (let x=bx; x<Math.min(bx+block,w); x++) {
          const i=(y*w+x)*4; r+=src.data[i]; g+=src.data[i+1]; b+=src.data[i+2]; a+=src.data[i+3]; c++;
        }
        r=Math.round(r/c); g=Math.round(g/c); b=Math.round(b/c); a=Math.round(a/c);
        for (let y=by; y<Math.min(by+block,h); y++) for (let x=bx; x<Math.min(bx+block,w); x++) {
          const i=(y*w+x)*4; dst.data[i]=r; dst.data[i+1]=g; dst.data[i+2]=b; dst.data[i+3]=a;
        }
      }
    }
    layer.ctx.putImageData(dst,0,0);
  }

  function boxBlur(layer) {
    const w = layer.canvas.width, h = layer.canvas.height;
    const src = layer.ctx.getImageData(0,0,w,h);
    const dst = layer.ctx.createImageData(w,h);
    const radius = 2;
    for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
      let r=0,g=0,b=0,a=0,c=0;
      for (let dy=-radius; dy<=radius; dy++) for (let dx=-radius; dx<=radius; dx++) {
        const nx=x+dx, ny=y+dy;
        if (nx<0||ny<0||nx>=w||ny>=h) continue;
        const i=(ny*w+nx)*4;
        r+=src.data[i]; g+=src.data[i+1]; b+=src.data[i+2]; a+=src.data[i+3]; c++;
      }
      const o=(y*w+x)*4;
      dst.data[o]=r/c; dst.data[o+1]=g/c; dst.data[o+2]=b/c; dst.data[o+3]=a/c;
    }
    layer.ctx.putImageData(dst,0,0);
  }
  function sharpen(layer) {
    const w = layer.canvas.width, h = layer.canvas.height;
    const src = layer.ctx.getImageData(0,0,w,h);
    const dst = layer.ctx.createImageData(w,h);
    const kernel = [0,-1,0,-1,5,-1,0,-1,0];
    for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
      let r=0,g=0,b=0; let k=0;
      for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) {
        const nx=Math.min(w-1,Math.max(0,x+dx)), ny=Math.min(h-1,Math.max(0,y+dy));
        const i=(ny*w+nx)*4; const kv = kernel[k++];
        r+=src.data[i]*kv; g+=src.data[i+1]*kv; b+=src.data[i+2]*kv;
      }
      const o=(y*w+x)*4;
      dst.data[o]=clamp(r); dst.data[o+1]=clamp(g); dst.data[o+2]=clamp(b); dst.data[o+3]=src.data[o+3];
    }
    layer.ctx.putImageData(dst,0,0);
  }
