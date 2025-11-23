import fs from "fs";
import path from "path";
import express from "express";
import JSZip from "jszip";
import { spawn, exec } from "child_process";
import { Gpio } from "onoff";
import fftw from "fftw-js";
import { fileURLToPath, pathToFileURL } from "url";
import { encode as cborEncode, decode as cborDecode } from "cbor-x";

import globals, { consolelog } from "./globals.js";
import fileStore from "./files.js";
import TEIs from "./TEImodules.js";
import daq3 from "./daq3.js";

//  dans le REPL remplacer l'import par const fftw = require("fftw-js")
const FFT = fftw?.FFT ?? fftw?.default?.FFT;
if (typeof FFT !== "function") {
    throw new Error("FFT constructor not found in fftw-js module");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const serverVersion = "20230509";
// version adaptée à l'ampli diff_JFE2140
// gain 5/50, gpio led
let JCFFT = 1; // to use either the pld python version or the new js version (JCFFT->new javascript)

const args = process.argv;
if (args.indexOf("NOJC") !== -1) {
    console.log("This version of app.js *cannot* with flag NOJC or NOJCFFT")
    process.exit(0)
    globals.JC = 0;
}
if (args.indexOf("NOJCFFT") !== -1) {
    console.log("This version of app.js *cannot* with flag NOJC or NOJCFFT")
    process.exit(0)
    JCFFT = 0;
}

const app = express();
const CBOR_MIME_TYPE = "application/cbor";
const jsonParser = express.json({ limit: "5mb" });
const cborRawParser = express.raw({ type: CBOR_MIME_TYPE, limit: "10mb" });

const encodeToBuffer = (payload) => {
    const encoded = cborEncode(payload);
    return Buffer.isBuffer(encoded) ? encoded : Buffer.from(encoded);
};

const sendCbor = (res, payload, status = 200) => {
    if (typeof status === "number" && res.statusCode !== status) {
	res.status(status);
    }
    res.set("Content-Type", CBOR_MIME_TYPE);
    return res.send(encodeToBuffer(payload));
};

const asFloat64Array = (value) => {
    if (value == null) {
	return new Float64Array(0);
    }
    if (value instanceof Float64Array) {
	return value;
    }
    if (Array.isArray(value)) {
	return Float64Array.from(value);
    }
    if (ArrayBuffer.isView(value)) {
	return Float64Array.from(value);
    }
    return new Float64Array(0);
};

app.use((req, res, next) => {
    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
	if (req.is(CBOR_MIME_TYPE)) {
	    return cborRawParser(req, res, (err) => {
		if (err) {
		    err.status = err.status || 400;
		    return next(err);
		}
		if (!req.body || !req.body.length) {
		    req.body = {};
		    return next();
		}
		try {
		    req.body = cborDecode(req.body);
		} catch (parseError) {
		    parseError.status = 400;
		    parseError.message = "Invalid CBOR payload";
		    return next(parseError);
		}
		return next();
	    });
	}
	return jsonParser(req, res, next);
    }
    return next();
});

const staticDir = path.join(__dirname, "..", "web");
const dataDirectory = path.join(__dirname, "..", "data");
app.use("/", express.static(staticDir));

let mode = "complet";
let TEImodule = 0;
//const teis = require('./TEImodule.js');
// liste des commandes de gain a envoyer au module daq3
const gainValues = [0, 1];

//pin numbers physical
// gpios odroid utilisées { nom, numero de pin, valeur de depart, instance(new) }
const odroidGPIOS = [
    { name: "ACDC", pin: 30, start: 0, gpio: null },
    { name: "X10", pin: 22, start: 0, gpio: null },
    { name: "J1", pin: 21, start: 0, gpio: null },
    { name: "J2", pin: 18, start: 0, gpio: null },
    { name: "LED", pin: 31, start: 0, gpio: null },
    { name: "FILTER", pin: 29, start: 0, gpio: null },
];
let ledStatus = 0;

//parametres d'acquisition
// gain programmable DAQ3, gain exterieur, gain preampli :5/50
let acq_gain = 1;
let acq_extgain = 1;
let acq_gainX10 = 5;
let acq_samples = 16;
let acq_highZ = false;
let acq_spanComp = false;
let acq_sqWave = false;
let fft_X_1 = new Float64Array(0);
let fft_Y_1 = new Float64Array(0);
let fft_X_N = new Float64Array(0);
let fft_Y_N = new Float64Array(0);
/* ********************************************************************* */
/*                      POUR TESTER WELCH                                */
/* ********************************************************************* */

// intervalle de cligotement de la led status
let blinkLEDinterval = setInterval(blinkLEDstatus, 500);
/**************************************************************************/

/**
 * fait clignoter la led de status
 */
function blinkLEDstatus() {
    ledStatus = ledStatus === 0 ? 1 : 0;
    odroidGPIOS[4].gpio.writeSync(ledStatus);
}

function setLEDstatus(s) {
    clearInterval(blinkLEDinterval);
    odroidGPIOS[4].gpio.writeSync(s);
}
/******************************** GPIOs ***************************************/

/**
 * init des gpios
 * */
odroidGPIOS.forEach((n) => {
    const gpioInstance = new Gpio(n.pin, "out");
    n.gpio = gpioInstance;
});

/**************************serveur web ***********************************************/

function startServer() {
    app.listen(PORT, (error) => {
	if (!error) {
	    consolelog(
		`# Server ${serverVersion} is Successfully Running, and App is listening on port ${PORT}`,
	    );
	} else {
	    consolelog(`Error occurred, server can't start error= ${error}`);
	}
    });
}

/******************************** requetes GET ***************************************/

// sert la page par defaut odroidDaqweb/index.html
app.get("/", (req, res) => {
    consolelog(req.originalUrl || req.url, 10);
    res.sendFile(path.join(staticDir, "index.html"));
});

// sert les pages index.*
app.get("/index/", (req, res) => {
    res.sendFile(path.join(staticDir, "index", "index.html"));
});

// reponse à la requete 'listserial'
app.get("/listSerial/", (req, res) => {
    odroidGPIOS.forEach((gpioConfig) => {
	consolelog(`reinit : ${gpioConfig.name} ${gpioConfig.start}`, 10);
	gpioConfig.gpio.writeSync(gpioConfig.start);
    });
    consolelog("listSerial", 10);
    daq3
	.getSerialPortList()
	.then((list) => sendCbor(res, { serial: list }))
	.catch((error) => {
	    consolelog(error);
	    sendCbor(res, { error: "Serial list unavailable" }, 500);
	});
});

// reponse à la requete 'acquire'
app.get("/acquire/", (req, res) => {
    clearInterval(blinkLEDinterval);
    setLEDstatus(1);
    daq3.dataCollect(acq_samples);
    sendCbor(res, { acq: "started" });
});

// reponse à la requete 'save'
app.get("/save/", (req, res) => {
    let name = req.query.f;
    if (!name)
	name = ""; // if no prefix take empty string
    const filename = path.join(dataDirectory, `${name}_sig_${Date.now()}.dat`);
    consolelog(`app.js save -> ${filename}`, 10);

    let gain = acq_gain;
    if (acq_spanComp) {
	gain = acq_gain / 0.8;
    }
    gain *= acq_gainX10;

    const data = daq3.getSignalData(gain);
    const period = (1000 * 1) / TEIs.getModule(TEImodule).AdcSamplingRate;

    const rows = [];
    for (let i = 0; i < data.length; i += 1) {
	const x = i * period;
	rows.push(`${x} ${data[i]}`);
    }

    fs.writeFile(filename, `${rows.join("\n")}\n`, (err) => {
	if (err) {
	    consolelog(err);
	    sendCbor(res, { error: "Save failed" }, 500);
	    return;
	}
	consolelog(`Saved in ${filename}`, 10);
	sendCbor(res, { fname: filename });
    });
});

// reponse à la requete 'savefft'
app.get("/savefft/", (req, res) => {
    let name = req.query.f;
    if (!name)
	name = "";  // no prefix given -> ""
    const dateNow = Date.now();
    const firstFftFile = path.join(dataDirectory, `${name}_fft_1_${dateNow}.dat`);
    consolelog(`app.get("/savefft/ : Starting serialization`, 10);
    const serializeFft = (x, y) => {
	const rows = [];
	for (let i = 0; i < x.length; i += 1) {
	    rows.push(`${x[i]} ${y[i]}`);
	}
	return `${rows.join("\n")}\n`;
    };

    try {
	fs.writeFileSync(firstFftFile, serializeFft(fft_X_1, fft_Y_1));
	consolelog(`app.get("/savefft/ :  Serialization took ${Date.now() - dateNow}`, 10);
	consolelog(`${firstFftFile} Saved!`, 10);
    } catch (err) {
	consolelog(err);
	sendCbor(res, { error: "FFT save failed" }, 500);
	return;
    }

    let responseFilename = firstFftFile;
    if (fft_X_N.length) {
	const secondFftFile = path.join(
	    dataDirectory,
	    `${name}_fft_N_${dateNow}.dat`,
	);
	consolelog(`Saving secondary FFT ${secondFftFile}`, 10);
	try {
	    fs.writeFileSync(secondFftFile, serializeFft(fft_X_N, fft_Y_N));
	    consolelog(`${secondFftFile} Saved!`, 10);
	    responseFilename = secondFftFile;
	} catch (err) {
	    consolelog(err);
	    sendCbor(res, { error: "Secondary FFT save failed" }, 500);
	    return;
	}
    }
    sendCbor(res, { fname: responseFilename });
});

// reponse à la requete 'data'
// recup de données temporelles dans le daq3
app.get("/data/", (req, res) => {
    consolelog(`/data/ mode=${mode}`, 10);
    let gain = acq_gain;
    if (acq_spanComp) {
	gain = acq_gain / 0.8;
    }
    gain *= acq_gainX10;
    sendCbor(res, { data: daq3.getSignalData(gain) });
});

// reponse à la requete 'time'
app.get("/time/", (req, res) => {
    const timestamp = Date.now();
    const theTime = new Date(timestamp);
    consolelog(`app.get time= ${theTime}`, 10);
    sendCbor(res, { time: theTime.toJSON() });
});

// reponse à la requete 'cpuTemp'
app.get("/cpuTemp/", (req, res) => {
    computeCPUTemp()
	.then((temp) => {
	    consolelog(`app.get cpuTemp ${temp}`, 10);
	    sendCbor(res, { cpuTemp: temp });
	})
	.catch((error) => {
	    consolelog(error);
	    sendCbor(res, { error: "CPU temperature unavailable" }, 500);
	});
});

// reponse à la requete 'done?'
app.get("/done?/", (req, res) => {
    const stat = daq3.getAcqDone();
    consolelog(`acqDone ${stat}`, 10);
    if (stat === false) {
	blinkLEDstatus();
    } else {
	blinkLEDinterval = setInterval(blinkLEDstatus, 500);
    }
    sendCbor(res, { acqDone: stat });
});

// reponse à la requete 'fft?'
// lance un calcul de fft sur les données acquises
app.get("/fft/", (req, res) => {
    let gain = acq_gain;
    if (acq_spanComp) {
	gain = acq_gain / 0.8;
    }
    gain *= acq_extgain * acq_gainX10;

    const signal = daq3.getSignalData(gain);
    const seg = Math.max(1, Number.parseInt(req.query.seg, 10) || 1);
    consolelog(`app.get("/fft/") seg=${seg}`, 10);
    setLEDstatus(1);

    const applyWelchCache = (payload) => {
	if (!payload) {
	    return;
	}
	if (payload.fft_x1) {
	    fft_X_1 = asFloat64Array(payload.fft_x1);
	}
	if (payload.fft_y1) {
	    fft_Y_1 = asFloat64Array(payload.fft_y1);
	}
	fft_X_N = asFloat64Array(payload.fft_x2);
	fft_Y_N = asFloat64Array(payload.fft_y2);
    };

    if (JCFFT) {
	try {
	    const samplingRate = TEIs.getModule(TEImodule).AdcSamplingRate;
	    const nbperseg = acq_samples * 1024;
	    const baseFreq = samplingRate / signal.length;

	    consolelog(`app.get("/fft/") first call signal.length=${signal.length} samplingRate=${samplingRate}  nbperseg=${nbperseg}`,10)
	    const primarySpectrum = welchOptim(signal, samplingRate, nbperseg);
	    const response = {
		fft_x1: generateFftAxis(signal.length, baseFreq),
		fft_y1: primarySpectrum,
		f0: 0,
		fft_x2: new Float64Array(0),
		fft_y2: new Float64Array(0),
	    };

	    if (seg !== 1) {
		const adjustedNperseg = Math.max(1, Math.trunc(nbperseg / seg));
		consolelog(`app.get("/fft/") second call signal.length=${signal.length} samplingRate=${samplingRate}  adjustedNperseg=${adjustedNperseg}`,10)
		const secondarySpectrum = welchOptim(
		    signal,
		    samplingRate,
		    adjustedNperseg,
		);
		const secondaryFreq = baseFreq * seg;
		response.f0 = secondaryFreq;
		response.fft_x2 = generateFftAxis(adjustedNperseg, secondaryFreq);
		response.fft_y2 = secondarySpectrum;
	    }

	    applyWelchCache(response);
	    sendCbor(res, response);
	} catch (error) {
	    consolelog(error);
	    sendCbor(res, { error: "FFT processing failed" }, 500);
	} finally {
	    blinkLEDinterval = setInterval(blinkLEDstatus, 500);
	}
	return;
    }

});

// reponse à la requete 'listdir?'
app.get("/listDir/", async (req, res) => {
    consolelog("entering /listDir", 10);
    try {
	const files = await fileStore.list();
	consolelog(`/listDir ${files}`, 10);
	sendCbor(res, { files });
    } catch (error) {
	consolelog(error);
	sendCbor(res, { error: "Listing failed" }, 500);
    }
});

// reponse à la requete 'upload?'
// route to download a file
app.get("/upload/", async (req, res) => {
    const fileParam = req.query.f;
    if (!fileParam) {
	sendCbor(res, { error: "Missing filename" }, 400);
	return;
    }

    const requestedFiles = fileParam
	  .split(",")
	  .map((f) => f.trim())
	  .filter((f) => f.length);

    if (requestedFiles.length === 0) {
	sendCbor(res, { error: "No valid filenames provided" }, 400);
	return;
    }

    if (requestedFiles.length === 1) {
	const fileName = requestedFiles[0];
	const fileLocation = path.join(dataDirectory, fileName);
	consolelog(`Download single file ${fileLocation}`, 10);
	res.download(fileLocation, fileName, (err) => {
	    if (err) {
		consolelog(err);
		if (!res.headersSent) {
		    sendCbor(res, { error: "File not found" }, 404);
		}
	    }
	});
	return;
    }

    const zip = new JSZip();
    try {
	requestedFiles.forEach((fileName) => {
	    const filePath = path.join(dataDirectory, fileName);
	    const content = fs.readFileSync(filePath);
	    zip.file(fileName, content);
	});

	const archive = await zip.generateAsync({ type: "nodebuffer" });
	const zipName = `data_${Date.now()}.zip`;
	consolelog(`zip -> ${zipName}`, 10);
	res.set({
	    "Content-Type": "application/zip",
	    "Content-Disposition": `attachment; filename="${zipName}"`,
	});
	res.send(archive);
    } catch (error) {
	consolelog(error);
	if (!res.headersSent) {
	    sendCbor(res, { error: "Zip generation failed" }, 500);
	}
    }
});
/************************************* requetes POST *********************************/

app.post("/update-mode", (req, res) => {
    consolelog("/update-mode called", 10);
    const { mode: newMode } = req.body;
    if (newMode === "complet") {
	mode = newMode;
	consolelog(`Mode mis à jour : ${mode}`, 10);
	sendCbor(res, { success: true, mode });
    } else {
	sendCbor(res, { success: false, message: "Valeur invalide" }, 400);
    }
    consolelog(`mode=${mode}`, 10);
});

app.post("/", (req, res) => {
    consolelog(`* ${req.body}`, 10);
    res.end();
});

// reponse à la requete 'initSerial?'
app.post("/initSerial", async (req, res) => {
    consolelog(`initSerial ${req.body.val}`, 10);
    try {
	const id = await daq3.initSerial(req.body.val);
	consolelog(`id ${id}`, 10);
	TEImodule = id;
	const moduleInfo = TEIs.getModule(id);
	consolelog(moduleInfo, 10);
	sendCbor(res, moduleInfo);
	fillGainCommand(moduleInfo);
	consolelog(`${daq3.setup()}`, 10);
	daq3.initParser();
    } catch (error) {
	consolelog(error);
	sendCbor(res, { error: "Serial init failed" }, 500);
    }
});

// reponse à la requete 'closeSerial?'
app.post("/closeSerial", (req, res) => {
    consolelog("closeSerial", 10);
    daq3.closeSerial();
    res.end();
});

// reponse à la requete 'dateSet'
app.post("/dateset", (req, res) => {
    const dateTime = new Date(req.body.val);
    const day = dateTime.getDate();
    const month = dateTime.getUTCMonth() + 1;
    const year = dateTime.getFullYear();
    const hour = dateTime.getHours();
    const min = dateTime.getMinutes();
    const updateD = `${year}-${month}-${day} ${hour}:${min}`;

    consolelog(`setdate ${req.body.val} ${updateD}`, 10);
    exec(`/usr/local/bin/setDate.sh "${updateD}"`, (err, stdout, stderr) => {
	if (err || stderr) {
	    console.error("err", err);
	    consolelog(`log ${stderr}`);
	} else {
	    consolelog("Successfully set the system's datetime", 10);
	}
    });
    res.end();
});

// reponse à la requete 'gain'
// changement de la valeur du gain dans le daq3
app.post("/gain", (req, res) => {
    acq_gain = gainValues[req.body.val - 1];
    consolelog(`gain ${req.body.val} -> ${acq_gain}`, 10);
    daq3.setParameter(req.body.val.toString()).then(() => acq_gain);
    res.end();
});

// reponse à la requete 'extgain'
// changement de la valeur du gain externe
app.post("/extgain", (req, res) => {
    acq_extgain = req.body.val;
    consolelog(
	`extgain ${req.body.val} -> gain= ${acq_extgain} * ${acq_gain}`,
	10,
    );
    res.end();
});

// reponse à la requete 'set'
// changement de la valeur d'une variable du daq3
app.post("/set", (req, res) => {
    consolelog(`set ${req.body.val}`, 10);
    const [key, valueRaw] = req.body.val.split("=");
    const value = Number(valueRaw);
    let cmd = "";

    if (key.includes("highZ")) {
	cmd = "h";
	acq_highZ = value === 1;
    } else if (key.includes("spanComp")) {
	cmd = "s";
	acq_spanComp = value === 1;
    } else if (key.includes("SQwave")) {
	cmd = "f";
	acq_sqWave = value === 1;
    }

    if (!cmd) {
	sendCbor(res, { error: "Commande inconnue" }, 400);
	return;
    }

    if (value === 1) {
	cmd = cmd.toUpperCase();
    }

    consolelog(`set ${cmd}`, 10);
    daq3.setParameter(cmd).then(() => "done");
    res.end();
});

// reponse à la requete 'gpio'
// change l'etat d'une gpio de l'odroid
app.post("/gpio", (req, res) => {
    consolelog(`gpio ${req.body.val}`, 10);
    const [name, valueRaw] = req.body.val.split("=");
    let value = Number(valueRaw);

    if (name.includes("J")) {
	value = value === 0 ? 1 : 0;
    }

    if (name.includes("X")) {
	acq_gainX10 = value === 1 ? 50 : 5;
    }

    consolelog(`${name} ${value}`, 10);
    const theGpio = odroidGPIOS.find((element) => element.name === name);
    if (!theGpio) {
	sendCbor(res, { error: "GPIO not found" }, 404);
	return;
    }

    consolelog(`set gpio ${theGpio.name} ${theGpio.pin} ${value}`, 10);
    theGpio.gpio.writeSync(value);
    res.end();
});

// reponse à la requete 'samples'
app.post("/samples", (req, res) => {
    acq_samples = Number(req.body.val);
    res.end();
});

// reponse à la requete 'delfile'
app.post("/delfile", (req, res) => {
    consolelog(`del ${req.body}`, 10);
    sendCbor(res, { deleted: fileStore.delete(req.body.val) });
});

// reponse à la requete 'quit'
app.post("/quit", (req, res) => {
    consolelog(`quit ${req.body}`, 10);
    quit();
    res.end();
});

/**************************************************************************/
/**
 * rempli les tableau de gain et commandes (pour obtenir cs gains sur le daq3)
 * @param {*} data : valeurs fonction du type de module (pour nous daq3)
 */
function fillGainCommand(data) {
    const keys = Object.keys(data);
    consolelog(`keys ${keys}`, 10);
    while (gainValues.length) {
	gainValues.pop();
    }
    for (const key of keys) {
	if (key.search(/^gain\s\d/) !== -1) {
	    gainValues.push(key.substring(key.indexOf(" ") + 1));
	}
    }
    consolelog(`gainValues: ${gainValues}`, 10);
} // FIN function fillGainCommand(data){
/**************************************************************************/

/**
 * async function computeCPUTemp()
 * @brief   calcule une temperature moyenne du CPU en lisant les valeurs de temp des 5 zones
 *  dans /sys/devices/virtual/thermal/thermal_zoneX
 *
 * @returns la temperature moyenne
 */
async function computeCPUTemp() {
    let cpuTemp = 0;
    const cpuTempCmd = "cat /sys/devices/virtual/thermal/thermal_zone";
    let error = false;
    for (let i = 0; i !== 5 && error === false; i += 1) {
	const cmd = `${cpuTempCmd}${i}/temp`;
	await getCpuTemp(cmd)
	    .then((temp) => {
		cpuTemp += temp;
	    })
	    .catch((err) => {
		error = true;
	    });
    }
    if (error === true) {
	return -1;
    }
    cpuTemp /= 5;
    return cpuTemp / 1000;
} // FIN async function computeCPUTemp()

/**
 * function getCpuTemp( cmd)
 * recupre une des temperatures CPU de l'odroid
 * @param {} cmd : commande 'cat ..' à executer
 * @returns promise
 */
function getCpuTemp(cmd) {
    return new Promise((resolve, reject) => {
	let temp = 0;
	let error = false;
	const script = exec(cmd);
	script.stdout.on("data", (data) => {
	    temp = parseInt(data, 10);
	});
	script.stderr.on("data", () => {
	    error = true;
	});
	script.on("exit", (code) => {
	    if (code !== 0) {
		error = true;
	    }
	    if (error === true) {
		reject(error);
	    } else {
		resolve(temp);
	    }
	});
    });
}
/**************************************************************************/

function quit() {
    /**
     * pour quitter, et arretere proprement l'odroid
     */
    consolelog("function quit", 10);
    // lancement du script bash
    spawn("/bin/sh", ["-c", `/usr/local/bin/shutDown.sh`]);
} // FIN function quit() {
/* *********************************************************************************** */

function generateFftAxis(dataLength, freqMin) {
    const upperBound = Math.floor(dataLength / 2);
    const axis = new Float64Array(upperBound + 1);
    for (let i = 0; i <= upperBound; i += 1) {
	axis[i] = i * freqMin;
    }
    return axis;
}

function hanning(M) {
    return Array.from(
	{ length: M },
	(_, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (M - 1)),
    );
}

function welchOptim(signal, fs = 1, nperseg = 256, noverlap = null) {
    consolelog(`welchOptim fs=${fs} nperseg=${nperseg} noverlap=${noverlap} signal(0:1)=${signal[0]} ${signal[1]}`,10);
    const resolvedOverlap =
	  noverlap === null ? Math.floor(nperseg / 2) : noverlap;
    const step = nperseg - resolvedOverlap;
    if (step <= 0) {
	throw new Error("noverlap doit être < nperseg");
    }

    const window = hanning(nperseg);
    const U = window.reduce((acc, w) => acc + w * w, 0);

    const fft = new FFT(nperseg);
    const nSegments = Math.floor((signal.length - nperseg) / step) + 1;
    consolelog(
	`welchOptim window(0..3)=${window[0]} ${window[1]} ${window[2]} ${window[3]} nSegments=${nSegments}`,
	10,
    );
    if (nSegments <= 0) {
	return [];
    }

    const half = Math.floor(nperseg / 2);
    const Pxx = new Float64Array(half + 1);

    for (let seg = 0; seg < nSegments; seg += 1) {
	const start = seg * step;
	const segment = signal
	      .slice(start, start + nperseg)
	      .map((v, i) => v * window[i]);
	const spectrum = fft.forward(segment);
	for (let k = 0; k <= half; k += 1) {
	    const re = spectrum[2 * k];
	    const im = spectrum[2 * k + 1];
	    Pxx[k] += (re * re + im * im) / (U * fs);
	}
    }

    consolelog(`welchOptim()  : executing fft.dispose();`,10)
    fft.dispose();

    for (let k = 0; k <= half; k += 1) {
	Pxx[k] = Math.sqrt(1.63*Pxx[k] / nSegments); // Julien : 1.63 vient de la litterature
    }

    return Pxx;
}

const appApi = {
    get verboseThresholdGlobal() {
	return globals.verboseThresholdGlobal;
    },
    consolelog: globals.consolelog,
    get JC() {
	return globals.JC;
    },
    startServer,
};

const isMainModule = () => {
    if (!process.argv[1]) {
	return false;
    }
    try {
	return import.meta.url === pathToFileURL(process.argv[1]).href;
    } catch (error) {
	consolelog(error);
	return false;
    }
};

if (isMainModule()) {
    startServer();
}

export { startServer };
export default appApi;
