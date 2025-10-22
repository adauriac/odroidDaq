const fs = require('fs');
// Lit un fichier donne sur la lignede cmd constitué de deux nombres par lignes
// et commentaires commencant par #
// Produit un fichier squeeze avec les parametres n et p : les p premieres lignes sont
// inchangées, ensuite les N-p restantes sont coupées en p bins de meme taille
// en log, puis pour chaque bin on produit deux lignes :
// x_milieu y_min (minimum sur le bin)
// x_milieu y_max (maximum sur le bin)

console.log(`# syntax: testingSqueeze file n p`)
console.log(`# to keep the p first lignes and gather the other lines in n bins`)
console.log(`# empty bins are not kept`)
console.log(`# bins with one or two points points are replaced by the corresponding lines`)
console.log(`# bins with more than 2 pts are replaced by two lines x_mid y_min and x_mid y_max`)

if (process.argv.length != 5)
    process.exit(0)
file = process.argv[2]
n = parseInt(process.argv[3],10)
p = parseInt(process.argv[4],10)

function squeeze(X0,Y0,n,p) {
    // X0 and Y0 are  the frequence and the spectrum with X0[0] =0 et X croissant
    // le segment [X0[p],X0[-1]] est decoupe en n bin
    // pour chaque bin on va creer deux point (X_milieu,min(Y)) et (X_milieu,max(Y))
    //  ces 2 tableaux de taille 2*n sont retournes 
    let X=X0.slice(0,p)
    let Y=Y0.slice(0,p)
    let N = X0.length
    const deb = Math.log(X0[p]),fin = Math.log(X0[N-1])
    const dx = (fin - deb)/(n)
    let liste = Array.from({ length:n}, () => []);
    for (let i=p;i<X0.length;i++) {
	let k = Math.floor((Math.log(X0[i]) - deb)/dx);
	//console.log(`i=${i} k=${k}`)
	if (k==n)
	    k=n-1
	if ((k<0) || (k>=n)) {
	    console.log(`pb k=${k} X0[i]=${X0[i]} (X0[i]-deb)=${(X[0]-deb)}`)
	    return;
	}
	liste[k].push(i)
    }
    for (let k=0;k<liste.length;k++) {
	//console.log(`${k} -> ${liste[k]}`)
	if (liste[k].length===0)
	    continue
	if (liste[k].length===1) {
	    X.push(X0[liste[k][0]])
	    Y.push(Y0[liste[k][0]])
	    continue
	}
	if (liste[k].length===2) {
	    X.push(X0[liste[k][0]])
	    Y.push(Y0[liste[k][0]])
	    X.push(X0[liste[k][1]])
	    Y.push(Y0[liste[k][1]])
	    continue
	}
	let x=0,yi=Y0[liste[k][0]],ya=Y0[liste[k][0]]
	for (let i=0;i<liste[k].length;i++) {
	    x += X0[liste[k][i]]
	    let y = Y0[liste[k][i]]
	    if (y<yi)
		yi=y
	    if (y>ya)
		ya=y
	}
	x /= liste[k].length;
	//console.log(`${x} ${yi}`)
	// console.log(`${x} ${ya}`)
	X.push(x)
	Y.push(yi)
	X.push(x)
	Y.push(ya)
    }
    if (X.length!=Y.length) {
	console.log(`${X.length} != ${Y.length}`)
	return
    }
    if (0) for (let i=0;i<X.length;i++) {
	console.log(`${X[i]} ${Y[i]}`)
    }
    return [X,Y]
}  // FIN squeeze(X,Y)
// *****************************************************************************

function extraireXYDepuisFichier(nomFichier) {
  // Lire le contenu du fichier
  const texte = fs.readFileSync(nomFichier, 'utf-8');
  const lignes = texte.split('\n');
  const x = [];
  const y = [];
  for (let ligne of lignes) {
    ligne = ligne.trim();
      if (ligne === '' || ligne.startsWith('#'))
	  continue; // ignorer commentaires et lignes vides
    const parties = ligne.split(/\s+/);
    if (parties.length >= 2) {
      const xi = parseFloat(parties[0]);
      const yi = parseFloat(parties[1]);
      if (!isNaN(xi) && !isNaN(yi)) {
        x.push(xi);
        y.push(yi);
      }
    }
  }
  return [x, y];
}  // FIN function extraireXYDepuisFichier(nomFichier) {
// *****************************************************************************

let [X,Y] = extraireXYDepuisFichier(process.argv[2])
if (0) for (let i=0;i<X.length;i++) {
    console.log(`${X[i]} ${Y[i]}`)
}

let [A,B] = squeeze(X,Y,n,p)
for (let i=0;i<A.length;i++) {
    console.log(`${A[i]} ${B[i]}`)
}
