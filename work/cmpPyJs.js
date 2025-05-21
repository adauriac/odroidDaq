/* 
pour comparer python et js : cmpPyJs.js
On calcule la fft simple de python, et on fera de meme dans cmpPyJs.js
On donne le signal dans le fichier nommé tmp
Sort sur stdout i s[i] Re(fft(i)) Im(fft(i] abs(fft[i])

appel: node cmpJsPy.js
use: github.com/indutny/fft.js/blob/master/README.md.
*/

const fs = require('fs')
const contenu = fs.readFileSync("./tmp",'utf8')
const lines = contenu.split(/\r?\n/)
lines.pop()
const signal = lines.map(ligne=>parseFloat(ligne,10))

const FFT = require('./lib/fft.js') // JC ?????????????????
N = signal.length
const fft = new FFT(N);
let fftOut = fft.createComplexArray();
fft.realTransform(fftOut, signal);
fft.completeSpectrum(fftOut);

for(let i=0;i<N;i++) {
    let re = fftOut[2*i]
    let im = fftOut[2*i+1]
    console.log(`${i} ${signal[i]} ${re} ${im}`)
}
