 let canvas, ctx, animationId;
 let active = true;
 let stars = [];
 let lastTime = performance.now();
 const nebulaImage = new Image();

 // CONFIGURATION
 const STAR_COUNT = 350;                                                 nebulaImage.src = 'assets/n1-top@3x.png';

 class Star {             constructor(w, h, hubX, hubY) {
   this.hubX = hubX;
     this.hubY = hubY;
     this.reset(w, h);
   }

   reset(w, h) {
     // We want stars to fill the diagonal of the screen
     const maxScreenDist = Math.sqrt(w * w + h * h);

     // Distribute stars mostly within the screen view
     this.dist = Math.random() * maxScreenDist;
     this.angle = Math.random() * Math.PI * 2;

     this.size = Math.random() * 1.4 + 0.2;
     // Variety in speed creates depth (parallax)
     this.rotationSpeed = (Math.random() * 0.00004 + 0.00001);

     // Twinkle factor
     this.opacity = Math.random() * 0.6 + 0.2;
     this.twinkleSpeed = Math.random() * 0.002 + 0.001;
   }

   update(delta) {
     this.angle += this.rotationSpeed * delta;
   }

   draw(ctx, now) {
     const x = this.hubX + Math.cos(this.angle) * this.dist;
     const y = this.hubY + Math.sin(this.angle) * this.dist;

     // Subtle twinkle effect using sine wave on opacity
    const currentOpacity = this.opacity + Math.sin(now * this.twinkleSpeed) * 0.2;

     ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, currentOpacity)})`;
     ctx.beginPath();
     ctx.arc(x, y, this.size, 0, Math.PI * 2);
     ctx.fill();
   }
 }

 export function initStarfield() {
   active = true;
   canvas = document.createElement('canvas');
   ctx = canvas.getContext('2d');

   canvas.width = window.innerWidth;
   canvas.height = window.innerHeight;

   const hubX = canvas.width * 0.33;
   const hubY = canvas.height * 0.7;

   stars = Array.from({ length: STAR_COUNT }, () => new Star(canvas.width, canvas.height, hubX, hubY));

   function animate(now) {
     if (!active) return;
     const delta = now - lastTime;
     lastTime = now;

     // 1. Solid Background
     ctx.fillStyle = '#02040a';
     ctx.fillRect(0, 0, canvas.width, canvas.height);

     // 2. Rotating Nebula
     if (nebulaImage.complete && nebulaImage.naturalWidth > 0) {
       ctx.save();
       ctx.translate(hubX, hubY);
       ctx.rotate(now * 0.00002); // Slower, majestic rotation
       ctx.globalAlpha = 0.4 + (Math.sin(now * 0.0005) * 0.1);

       const scale = 2.2;
       const side = Math.max(canvas.width, canvas.height) * scale;
       ctx.drawImage(nebulaImage, -side/2, -side/2, side, side);
       ctx.restore();
     }

    // 3. Wheeling Stars (Batch drawing is faster)
     stars.forEach(star => {
       star.update(delta);
       star.draw(ctx, now);
     });

     animationId = requestAnimationFrame(animate);
   }

  window.addEventListener('resize', resizeCanvas);
   animationId = requestAnimationFrame(animate);

   return canvas;
 }

 export function stopStarfield() {
   active = false;
   if (animationId) cancelAnimationFrame(animationId);
   if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
   window.removeEventListener('resize', resizeCanvas);
 }

 function resizeCanvas() {
   if (!canvas) return;
   canvas.width = window.innerWidth;  canvas.height = window.innerHeight;
  // Re-calculate stars on resize to fit new screen dimensions
   const hubX = canvas.width * 0.33;
   const hubY = canvas.height * 0.7;
   stars.forEach(s => {
       s.hubX = hubX;
       s.hubY = hubY;
   });
 }

