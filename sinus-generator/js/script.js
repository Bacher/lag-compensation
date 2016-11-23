const canvas  = document.getElementById('canvas');
const control = document.getElementById('control');
const results = document.getElementById('text');

canvas.width  = 800;
canvas.height = 400;

control.addEventListener('submit', e => {
    render();
    e.preventDefault();
});

control.addEventListener('keyup', render);
control.addEventListener('change', render);

function render() {
    const count = Number(control.count.value);
    const min   = Number(control.min.value);
    const max   = Number(control.max.value);

    let result = [];

    if (
        Number.isNaN(count) ||
        Number.isNaN(min) ||
        Number.isNaN(max)
    ) {
        return;
    }

    const ctx = canvas.getContext('2d');

    ctx.save();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.translate(-0.5, 199.5);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(canvas.width, 0);
    ctx.strokeStyle = '#000';
    ctx.stroke();

    const accum = [];

    for (let x = 0; x < canvas.width; x++) {
        accum[x] = 0;
    }

    for (let i = 0; i < count; i++) {
        const offset      = Math.random() * 2 * Math.PI;
        const multiplier  = min + Math.random() * (max - min);
        const yMultiplier = min + Math.random() * (max - min);

        result.push(`SIN[${i}]`);
        result.push(`OFFSET:  ${offset}`);
        result.push(`MULTI:   ${multiplier}`);
        result.push(`Y-MULTI: ${yMultiplier}`);

        ctx.beginPath();

        for (let x = 0; x < canvas.width; x++) {
            const y = 50 * yMultiplier * Math.sin(offset + x * multiplier * 0.02);

            ctx.lineTo(x, y);
            accum[x] += y;
        }

        ctx.strokeStyle = '#777';
        ctx.stroke();
    }

    ctx.beginPath();

    for (let x = 0; x < canvas.width; x++) {
        ctx.lineTo(x, accum[x] * 2 / count);
    }

    ctx.strokeStyle = '#F00';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore();

    results.innerText = result.join('\n');
}

render();
