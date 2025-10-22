// welch_node.js
const fs = require("fs");
const FFTW = require("fftw-js");

// --- Fenêtre Hanning ---
function hanning(M) {
    return Array.from({ length: M }, (_, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (M - 1)));
}

// --- Welch optimisé ---
function welchOptim(signal, fs = 1, nperseg = 256, noverlap = null) {
    if (noverlap === null) noverlap = Math.floor(nperseg / 2);
    const step = nperseg - noverlap;
    if (step <= 0) throw new Error("noverlap doit être < nperseg");

    const window = hanning(nperseg);
    const U = window.reduce((acc, w) => acc + w*w, 0);

    const fft = new FFTW.FFT(nperseg);
    const nSegments = Math.floor((signal.length - nperseg) / step) + 1;
    if (nSegments <= 0) return { f0: fs / nperseg, Pxx: [] };

    const half = Math.floor(nperseg / 2);
    const Pxx = new Float64Array(half + 1);

    for (let seg = 0; seg < nSegments; seg++) {
        const start = seg * step;
        const segment = signal.slice(start, start + nperseg).map((v,i) => v*window[i]);
        const spectrum = fft.forward(segment);
        for (let k = 0; k <= half; k++) {
            const re = spectrum[2*k];
            const im = spectrum[2*k+1];
            Pxx[k] += (re*re + im*im)/(U*fs);
        }
    }

    for (let k = 0; k <= half; k++) {
        Pxx[k] /= nSegments;
    }

    return { f0: fs / nperseg, Pxx };
}

// --- Main ---
const signal = fs.readFileSync("signal.txt", "utf8")
    .trim().split(/\r?\n/).map(Number).filter(v => !isNaN(v));

//const fsVal = 1000;
//const nperseg = 256;
//const noverlap = 128;
let fsVal = signal.length
let nperseg = fsVal
let noverlap = fsVal/2

const { f0, Pxx } = welchOptim(signal, fsVal, nperseg, noverlap);

Pxx.forEach((p, k) => {
    console.log(`${(k*f0).toFixed(6)}, ${p.toExponential(6)}`);
});
