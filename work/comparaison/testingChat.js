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
} // FIN function welchOptim(signal, fs = 1, nperseg = 256, noverlap = null) {
// ******************************************************************************

function squeeze(X0,Y0,n,p) {
    // X0 and Y0 are  the frequence and the spectrum with X0[0] =0 et X croissant
    // le segment [X0[p],X0[-1]] est decoupe en n bin
    // pour chaque bin on va creer deux point (X_milieu,min(Y)) et (X_milieu,max(Y))
    //  ces 2 tableaux de taille 2*n sont retournes 
    let X=X0.slice(p-1)
    let Y=Y0.slice(p-1)
    const deb = Math.log(X0[p])
    const dx = (Math.log(X0[X0.length-1]) - deb)/(n-p)
    let liste = Array.from({ length: n-p }, () => []);
    for (let i=p;i<X.length;i++) {
	let k = Math.floor((Math.log(X[i]) - deb)/dx);
	//console.log(`i=${i} k=${k}`)
	if (k==n-p)
	    k=n-p-1
	if ((k<0) || (k>=n-p)) {
	    console.log(`pb k=${k} X[i]={X[i]} (X[i]-X[p])=${(X[i]-X[p])}`)
	    return;
	}
	liste[k].push(i)
    }
    for (let k=0;k<liste.length;k++) {
	// console.log(`${k} -> ${liste[k]}`)
	let x=0,yi=Y[liste[k][0]],ya=Y[liste[k][0]]
	for (let i=0;i<liste[k].length;i++) {
	    x += X[liste[k][i]]
	    let y = Y[liste[k][i]]
	    if (y<yi)
		yi=y
	    if (y>ya)
		ya=y
	}
	x /= liste[k].length;
	console.log(`${x} ${yi}`)
	console.log(`${x} ${ya}`)
	X.push(x)
	Y.push(yi)
	X.push(x)
	Y.push(ya)
    }
    if (X.length!=Y.length) {
	console.log(`${X.length} != ${Y.length}`)
	return
    }
    for (let i=0;i<X.length;i++) {
	console.log(`${X[i]} ${Y[i]}`)
    }
    return (X,Y)
}  // FIN squeeze(X,Y)
// *****************************************************************************
squeeze(X,Y,5,2)

// --- Main ---
// Paramètres
const freqs = 10;      // fréquence d'échantillonnage (Hz)
const T = 10;        // durée du signal en secondes
const N = Math.floor(freqs * T); // nombre d'échantillons
console.log(`# N=${N}`)
// Création des tableaux avec Float64Array pour efficacité
const t = new Float64Array(N);
const signal = new Float64Array(N);

// --- Génération du vecteur temps et du signal ---
const f1 = 50;   // Hz
const f2 = 120;  // Hz
for (let i = 0; i < N; i++) {
    t[i] = i / freqs; // équivalent à np.linspace(0, T, N, endpoint=False)
    signal[i] = Math.sin(2 * Math.PI * f1 * t[i]) + 0.8 * Math.sin(2 * Math.PI * f2 * t[i]);
}

// --- Normalisation optionnelle ---
let maxAbs = 0;
for (let i = 0; i < N; i++) {
    const absVal = Math.abs(signal[i]);
    if (absVal > maxAbs) maxAbs = absVal;
}
for (let i = 0; i < N; i++) {
    signal[i] /= maxAbs;
}

// signal est maintenant un Float64Array normalisé prêt pour welchOptim

let fsVal = freqs
let nperseg = Math.floor(N/2)
let noverlap =Math.floor(nperseg/2)
//console.log(signal.slice(0, 10)); // Affiche les 10 premiers échantillons

const { f0, Pxx } = welchOptim(signal, fsVal, nperseg, noverlap);

squeeze(f0,Pxx,16)
if (0)
    Pxx.forEach((p, k) => {
	console.log(`${(k*f0).toFixed(6)}, ${p.toExponential(6)}`);
    });

/*
  j'ai un couple de tableau X et Y qui represente les coordonnées de points. X est croissant. Je voudrais regrouper  les points en n bins,
  */
