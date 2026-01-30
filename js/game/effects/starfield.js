// ./js/game/effects/starfield.js

let canvas, ctx;
let particles = [];
let animationId = null;
let rotation = 0;
let container = null;
let active = false;

class Star {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.reset();
    }

    reset() {
        this.radius = Math.random() * Math.min(this.width, this.height) * 0.5;
        this.angle = Math.random() * Math.PI * 2;
        this.size = Math.random() * 2 + 0.5;
        this.opacity = Math.random() * 0.5 + 0.3;
        this.color = Math.random() > 0.5 ? '#d4af37' : '#ffd700';
        this.speed = 0.0005 + Math.random() * 0.001;
    }

    update(delta) {
        this.angle += this.speed * delta;
    }

    draw(ctx, centerX, centerY) {
        const x = centerX + this.radius * Math.cos(this.angle + rotation);
        const y = centerY + this.radius * Math.sin(this.angle + rotation);
        ctx.beginPath();
        ctx.arc(x, y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.opacity;
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

function initStarfield(targetContainer = document.body, starCount = 100) {
    if (canvas) return; // Already initialized
    active = true;
    container = targetContainer;

    canvas = document.createElement('canvas');
    canvas.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: -1;
        pointer-events: none;
    `;
    container.appendChild(canvas);
    ctx = canvas.getContext('2d');

    resizeCanvas();

    for (let i = 0; i < starCount; i++) {
        particles.push(new Star(canvas.width, canvas.height));
    }

    let lastTime = performance.now();

    function animate(now) {
        if (!active) return;
        const delta = now - lastTime;
        lastTime = now;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        rotation += 0.0003 * delta; // Rotation speed

        particles.forEach(star => {
            star.update(delta);
            star.draw(ctx, centerX, centerY);
        });

        animationId = requestAnimationFrame(animate);
    }

    animationId = requestAnimationFrame(animate);

    window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Update star radii to fit new size
    particles.forEach(star => {
        star.width = canvas.width;
        star.height = canvas.height;
        star.radius = Math.random() * Math.min(canvas.width, canvas.height) * 0.5;
    });
}

function stopStarfield() {
    active = false;
    if (animationId) cancelAnimationFrame(animationId);
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null;
    ctx = null;
    particles = [];
    window.removeEventListener('resize', resizeCanvas);
}

export { initStarfield, stopStarfield };
