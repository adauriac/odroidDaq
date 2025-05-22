/* 
pour comparer python et js : cmpPyJs.js
On calcule la fft simple de python, et on fera de meme dans cmpPyJs.js
On donne le signal dans le fichier nommé exampleSignal
Sort sur stdout i s[i] Re(fft(i)) Im(fft(i] abs(fft[i])

appel: node cmpJsPy.js
use: github.com/indutny/fft.js/blob/master/README.md.
*/

const fs = require('fs')

function welchise(data,freqSampling,n) {
    let N = data.length
    const f = Array.from({ length: N/2 + 1 }, (_, i) => i*freqSampling/N);
    let U = 0
    for (let i=0;i<N;i++) {
	let w = 0.5 - 0.5*Math.cos(2*Math.PI*i/N)
	U += w*w
	data[i] *= w
    }
    const FFT = require('./lib/fft.js') 
    const fft = new FFT(N)
    const c = 1/(freqSampling*U)
    let fftOut = fft.createComplexArray();
    fft.realTransform(fftOut, data);
    fft.completeSpectrum(fftOut);
    P = new Array(N/2+1)
    for(let i=0;i<=N/2;i++) {
	let re = fftOut[2*i]
	let im = fftOut[2*i+1]
	P[i] = c*(re*re+im*im)
	if (i!=N/2)
	    P[i] *= 2
    }
    // console.log(`# welch en javascript freqSampling=${freqSampling} ${N}`)
    // for (let i=0;i<=N/2;i++) 
    // 	console.log(i,f[i],P[i])
    return [f,P]
} // function welchise(data,freqSampling,n) {
// ***************************************************************************************

if (process.argv.length < 3) {
    console.log("syntax: node cmpPyJs.js f/w  freqSampling   (pour welch ou fft)")
    process.exit(0)
}
let quoi = process.argv[2];
if (quoi!='f' && quoi!='w'){
    console.log("syntax: node cmpPyJs.js f/w     (pour welch ou fft)")
    process.exit(0)
}
const contenu = fs.readFileSync("./exampleSignal",'utf8')
const lines = contenu.split(/\r?\n/)
lines.pop()
const data = lines.map(ligne=>parseFloat(ligne,10))
let N = data.length
if (quoi=='f') {
    console.log(`# fft en javascript `)
    const FFT = require('./lib/fft.js') // JC ?????????????????
    const fft = new FFT(N);
    let fftOut = fft.createComplexArray();
    fft.realTransform(fftOut, data);
    fft.completeSpectrum(fftOut);

    for(let i=0;i<N;i++) {
	let re = fftOut[2*i]
	let im = fftOut[2*i+1]
	console.log(`${i} ${data[i]} ${re} ${im}`)
    }
} else {
    let freqSampling = parseFloat(process.argv[3])
    let [f,P] = welchise(data,freqSampling,1)
    console.log(`# welch en javascript freqSampling=${freqSampling} ${N}`)
    for (let i=0;i<=N/2;i++) {
	console.log(i,f[i],P[i])
    }
}
