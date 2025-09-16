const fs = require("fs");

/**
 * Charge le tableau [log(x), y] à partir d'un fichier texte,
 * en ignorant la première ligne.
 *
 * @param {string} filename - chemin du fichier
 * @returns {Array<[number, number]>} - tableau [log(x), y]
 */
function chargerData(filename) {
  const contenu = fs.readFileSync(filename, "utf8");

  const lignes = contenu
    .trim()
    .split(/\r?\n/)
    .slice(1);  // saute la première ligne

  return lignes.map(line => {
    const [xs, ys] = line.trim().split(/\s+/);
    const x = parseFloat(xs);
    const y = parseFloat(ys);
    if (x <= 0 || y <= 0) {
      throw new Error(`x et y doivent être > 0 pour appliquer log, mais trouvé x=${x}, y=${y}`);
    }
    return [Math.log(x), y]; // prendre le log de x ici
  });
}

/**
 * Regroupe les données en paquets selon log(x) déjà calculé
 * et calcule pour chaque paquet non vide :
 * - moyenne de log(x)
 * - log(yMin)
 * - log(yMax)
 * - taille du paquet
 *
 * @param {Array<[number, number]>} data - tableau [log(x), y]
 * @param {number} N - nombre de paquets
 * @returns {Array<[number, number, number, number]>} - lignes de stats
 */
function statsParPaquetLog(data, N) {
  if (data.length === 0) return [];

  // bornes log(x)
  let xminLog = data[0][0];
  let xmaxLog = xminLog;
  for (const [lx] of data) {
    if (lx < xminLog) xminLog = lx;
    if (lx > xmaxLog) xmaxLog = lx;
  }

  const delta = (xmaxLog - xminLog) / N;

  // paquets
  const paquets = Array.from({ length: N }, () => ({
    xSum: 0,
    yMin: Infinity,
    yMax: -Infinity,
    count: 0,
  }));

  data.forEach(([lx, y]) => {
    let i = Math.floor((lx - xminLog) / delta);
    if (i >= N) i = N - 1;
    if (i < 0) i = 0;

    const p = paquets[i];
    p.xSum += lx;
    p.yMin = Math.min(p.yMin, y);
    p.yMax = Math.max(p.yMax, y);
    p.count += 1;
  });

  // lignes de stats pour paquets non vides
  const result = [];
  for (const p of paquets) {
    if (p.count > 0) {
      const xMeanLog = p.xSum / p.count;
      const yMinLog = Math.log(p.yMin);
      const yMaxLog = Math.log(p.yMax);
      result.push([xMeanLog, yMinLog, yMaxLog, p.count]);
    }
  }

  return result;
}

// Exemple d’utilisation
const data = chargerData("data.txt");
const stats = statsParPaquetLog(data, 1024);

// Affichage
if (0) {
    stats.forEach(([xMeanLog, yMinLog, yMaxLog, count]) => {
	console.log(Math.exp(xMeanLog),Math.exp( yMinLog), Math.exp(yMaxLog), count);
    });
}
stats.forEach(([xMeanLog, yMinLog, yMaxLog, count]) => {
    console.log(Math.exp(xMeanLog),Math.exp( yMinLog), count);
    if (count>1)
	console.log(Math.exp(xMeanLog),Math.exp( yMaxLog),  count);
});
