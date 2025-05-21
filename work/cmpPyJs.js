/* 
pour comparer python et js : cmpPyJs.js
On calcule la fft simple de python, et on fera de meme dans cmpPyJs.js
On donne le signal dans le fichier nommé tmp
Sort sur stdout i s[i] Re(fft(i)) Im(fft(i] abs(fft[i])

appel: node cmpJsPy.js
use: github.com/indutny/fft.js/blob/master/README.md.
*/

const fs = require('fs')

if (process.argv.length!=3) {
    console.log("syntax: node cmpPyJs.js f/w     (pour welch ou fft)")
    process.exit(0)
}
let quoi = process.argv[2];
if (quoi!='f' && quoi!='w'){
    console.log("syntax: node cmpPyJs.js f/w     (pour welch ou fft)")
    process.exit(0)
}
const contenu = fs.readFileSync("./tmp",'utf8')
const lines = contenu.split(/\r?\n/)
lines.pop()
const signal = lines.map(ligne=>parseFloat(ligne,10))
if (quoi=='f') {
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
} else {
    console.log("in progress")
}
