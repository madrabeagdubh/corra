// game/effects/starfield.js

let canvas, ctx, animationId;
let stars = [];
let active = false;
const starCount = 3000;

class Star {
    constructor(w, h) {
        this.w = w;
        this.h = h;
        this.reset();
    }

    reset() {
        const maxDist = Math.max(this.w, this.h) * 2.5;
        this.dist = Math.random() * maxDist;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = (Math.random() * 0.00001) + 0.000005; 
        this.size = Math.random() * 1.3 + 0.1;
        this.brightness = Math.random() * Math.PI;
        this.twinkleSpeed = Math.random() * 0.01 + 0.004;
        
        const r = Math.random();
        if (r > 0.99) this.color = "212, 175, 55";
        else if (r > 0.95) this.color = "100, 140, 255";
        else if (r > 0.90) this.color = "180, 80, 255";
        else this.color = "255, 255, 255";               
    }

    update(delta) {
        this.angle += this.speed * delta;
        this.brightness += this.twinkleSpeed;
    }

    draw(ctx, cx, cy) {
        const x = cx + Math.cos(this.angle) * this.dist;
        const y = cy + Math.sin(this.angle) * this.dist;
        
        if (y > cy + 100 || x < -50 || x > this.w + 50) return;

        const opacity = (Math.sin(this.brightness) * 0.5 + 0.5);
        ctx.fillStyle = `rgba(${this.color}, ${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

export function initStarfield() {
    active = true;
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();

    stars = Array.from({ length: starCount }, () => new Star(canvas.width, canvas.height));

    let lastTime = performance.now();
    let bgPulse = 0;

  function animate(now) {
    if (!active) return;
    const delta = now - lastTime;
    lastTime = now;
    bgPulse += delta * 0.00015;

    // 1. CHANGE THIS: Clear the canvas to be transparent
    ctx.clearRect(0, 0, canvas.width, canvas.height); 

    const hubX = canvas.width * 0.33;
    const hubY = canvas.height * 0.7;

    // 2. THE BACKGROUND HUES (Keep these, they are semi-transparent)
    // Blue Glow
    const blueGrad = ctx.createRadialGradient(hubX, hubY, 0, hubX, hubY, canvas.height * 1.2);
    const blueAlpha = 0.12 + (Math.sin(bgPulse) * 0.05); 
    blueGrad.addColorStop(0, `rgba(30, 60, 180, ${blueAlpha})`);
    blueGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = blueGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Purple Glow
    const purpGrad = ctx.createRadialGradient(canvas.width, 0, 0, hubX, hubY, canvas.width * 1.5);
    const purpAlpha = 0.08 + (Math.cos(bgPulse * 0.6) * 0.04);
    purpGrad.addColorStop(0, `rgba(120, 40, 200, ${purpAlpha})`);
    purpGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = purpGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. DRAW STARS
    stars.forEach(star => {
        star.update(delta);
        star.draw(ctx, hubX, hubY);
    });

    animationId = requestAnimationFrame(animate);
}
 

    animationId = requestAnimationFrame(animate);
    window.addEventListener('resize', resizeCanvas);
    return canvas;
}

export function stopStarfield() {
    active = false;
    if (animationId) cancelAnimationFrame(animationId);
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
}

function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

