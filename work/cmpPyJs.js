/* 
pour comparer python et js : cmpPyJs.js
On calcule la fft simple de python, et on fera de meme dans cmpPyJs.js
On donne le signal comme une formule 
Sort sur stdout i s[i] Re(fft(i)) Im(fft(i] abs(fft[i])

node -i cmpJsPy.js
use: github.com/indutny/fft.js/blob/master/README.md.
*/
var FFT = require('./lib/fft.js') // JC ?????????????????

function f(t) {return Math.sin(2 * Math.PI * 100 * t)}

// Paramètres du signal
let fs = 1024                // Fréquence d'échantillonnage en Hz
let T = 1.0                  // Durée en secondes
let N = Math.round(T * fs)          // Nombre d'échantillons
//t = np.linspace(0, T, N, endpoint=False)
// console.log(N)
const Ts = Array.from({ length: N }, (_, i) => i/N);
const signal = Ts.map(f)
const fft = new FFT(N);
let fftOut = fft.createComplexArray();
fft.realTransform(fftOut, signal);
fft.completeSpectrum(fftOut);

for(let i=0;i<N;i++) {
    let re = fftOut[2*i]
    let im = fftOut[2*i+1]
    console.log(`${i} ${signal[i]} ${re} ${im}`)
}
