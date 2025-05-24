const PORT = 3000;
const serverVersion = '20230509';
// version adaptée à l'ampli diff_JFE2140
// gain 5/50, gpio led

let JCFFT = 1 // to use either the pld python version or the new js version (JCFFT->new javascript)
let JC = 1
// const verboseThresholdGlobal = Number.MAX_SAFE_INTEGER // never printed 
const verboseThresholdGlobal = 11 // 0->always printed, Number.MAX_SAFE_INTEGER->never printed  printed if verbose>=verboseThresholdGlobal
// plus verboseThresholdGlobal est BAS plus on affiche
module.exports = { verboseThresholdGlobal,consolelog,JC }

// pour la comm avec daq3
const daq3 = require('./daq3.js');
// pour le management des fichiers de données
const dataFiles = require('./files.js');
// pour la manipulation des gpios de l'odroid
const gpio = require("onoff").Gpio
// pour la manipulation de fichiers statiques
const path = require('path')
var fs = require('fs');
var FFT = require('./lib/fft.js') // JC ?????????????????
//les pages web sont dans le dossier 'web'
var express = require('express');
const { parseArgs } = require('util');
const { setgroups } = require('process');
const app = express()
bodyparse = require('body-parser');
//definit le dossier des fichier statiques
app.use('/', express.static( 'odroidDaq/web'))
// for parsing application/json
app.use(bodyparse.json()) 

var jszip = require('jszip');
const FileSaver = require('file-saver');
// pour lancer un script pyhton (fft welch) et scripts bash
const {spawn}= require('child_process');
const {exec}= require('child_process');

var TEImodule =0
//const teis = require('./TEImodule.js');
// liste des commandes de gain a envoyer au module daq3
var gainValues = [0,1]

const TEIs = require('./TEImodules.js');
const files = require('./files.js');

//pin numbers physical
// gpios odroid utilisées { nom, numero de pin, valeur de depart, instance(new) }
const odroidGPIOS = [ {name:'ACDC', pin:30, start:0, gpio: null}, {name:'X10', pin:22, start:0, gpio: null}, 
                      {name:'J1', pin:21,start:0, gpio: null}, {name:'J2', pin:18 ,start:0, gpio: null},
                      {name:'LED', pin:31 ,start:0, gpio: null}, {name:'FILTER', pin:29 ,start:0, gpio: null}]
var LedStatus = 0;
var gpios ={}
//parametres d'acquisition
// gain programmable DAQ3, gain exterieur, gain preampli :5/50
var acq_gain =1,  acq_extgain =1, acq_gainX10=5, acq_samples=16
var acq_highZ=false, acq_spanComp=false, acq_sqWave=false
var fft_X_1= new Float64Array(), fft_Y_1= new Float64Array()
var fft_X_N= new Float64Array(), fft_Y_N= new Float64Array()
/* ********************************************************************* */
/*                      POUR TESTER WELCH                                */
/* ********************************************************************* */

consolelog(`# flag JCFFT=${JCFFT}`)
if (0)
    testAndQuit(128,5,1./10) // testAndQuit(npts,w,T) signal = sin(w*t) echatillonne a 0,T,2*T,...,(npts-1)*T 
/**************************************************************************/

// intervalle de cligotement de la led status
var blinkLEDinterval =setInterval(blinkLEDstatus, 500);
/**************************************************************************/

/**
 * fait clignoter la led de status
 */
function blinkLEDstatus() { 
    if ( LedStatus===0) LedStatus= 1
    else LedStatus=0
    odroidGPIOS[4].gpio.writeSync( LedStatus );
}

function setLEDstatus( s ) { 
    clearInterval(blinkLEDinterval)
    odroidGPIOS[4].gpio.writeSync( s );
}
/******************************** GPIOs ***************************************/

/**
 * init des gpios
 * */
odroidGPIOS.forEach( function( n) {
    // consolelog(`GPIO: ${n} ${n.name} ${n.pin)`,10)
    var mygpio = new gpio(n.pin, 'out')
    //  consolelog(`${typeof mygpio}, ${mygpio}`,10)
    n.gpio= mygpio
});

/**************************serveur web ***********************************************/

// demarrage du serveur web 'express'
app.listen(PORT, (error) =>{
    if(!error) 
        consolelog(`# Server ${serverVersion} is Successfully Running, and App is listening on port ${PORT}`); 
    else 
        consolelog(`Error occurred, server can't start error= ${error}`);
});

/******************************** requetes GET ***************************************/

//// sert la page par defaut odroidDaqweb/index.html
app.get('/', (req, res)=>{  
    consolelog(`/${req}`,10)  
    res.sendFile('/index.html');
});

//// sert les pages index.*
app.get('/index/', (req, res)=>{   
    res.sendFile('/index/');
});

//// reponse à la requete 'listserial'
app.get('/listSerial/', (req, res)=>{   
    odroidGPIOS.forEach( function( n) {
        // valeur initiale sur les gpios
        consolelog(`reinit : ${n.name} ${n.start}`,10)
        n.gpio.writeSync(n.start)
    })
    consolelog('listSerial',10)
    daq3.getSerialPortList().then (
        (list)=> {
            //renvoie la liste des ports serie
            res.json({'serial' :list});
        } )
});

//// reponse à la requete 'getJCFFT'
app.get('/getJCFFT', (req, res)=>{
    consolelog(`getJCFFT: entering`,10)
    var x = JCFFT;
    res.send({ 'JCFFT': x });
});

//// reponse à la requete 'aquire'
app.get('/acquire/', (req, res)=>{   
    clearInterval(blinkLEDinterval);
    setLEDstatus(1)
    // lance l'acqui ur le daq3
    daq3.dataCollect(acq_samples) // acq_samples est une variable global
    res.send({ 'acq': 'started'});
});

//// reponse à la requete 'save'
app.get('/save/', (req, res)=>{   
    var name= req.query['f']
    var fname = "data/"+name +"_sig_" +Date.now() + '.dat'    
    // sauvegarde des données temporelles acquises
    var gain = acq_gain
    if (acq_spanComp)
        gain = acq_gain / 0.8  
    // on tient compte du gain externe, et du gain preampli
    gain = gain *  acq_gainX10
    var data= daq3.getSignalData(gain)   
    ///acq_samplingrate
    var x, periode = 1000 * 1 / TEIs.getModule(TEImodule).AdcSamplingRate   
    /* Stringify the array before saving */
    // fichier texte 2 colonnes x, y
    var dataStr='', size = data.length
    for (let i=0; i!=size; i++ ){
        x = (i++)*periode
        dataStr += x.toString() + ' ' + data[i].toString() + '\n'
    }
    consolelog(`app.get(/save app.js (l 173) dataStr= ${dataStr}`,10)
    fs.writeFile(fname, dataStr, function (err) {
        if (err) throw err;
        consolelog('Saved!',10);
    })
    res.send({'fname' :fname});
});

//// reponse à la requete 'savefft'
app.get('/savefft/', (req, res)=>{   
    var name= req.query['f'], dateNow = Date.now()
    // sauvegarde de la fft calculée
    // fichier texte 2 colonnes X, Y
    var fftStr='', size = fft_X_1.length
    for (let i=0; i!=size; i++ ){
        fftStr += fft_X_1[i].toString() + ' ' + fft_Y_1[i].toString() + '\n'
    }
    var fname = "data/"+name +"_fft_1_" + dateNow + '.dat'
    try{
        fs.writeFileSync(fname, fftStr );
	consolelog(`${fname} Saved!`,10);
    }catch (err) {       
        consolelog( err)  
    }
    // si on a fait une fft avec seg>1 on a 2 ffts
    if (fft_X_N.length ){
        fftStr='', size = fft_X_N.length
        for (let i=0; i!=size; i++ ){
            fftStr += fft_X_N[i].toString() + ' ' + fft_Y_N[i].toString() + '\n'
        }
        fname = "data/"+name +"_fft_N_" + dateNow + '.dat'
        try {
            fs.writeFileSync(fname, fftStr );
	    consolelog(`${fname} Saved!`,10);
        }
        catch (err){
            consolelog( err)  
        }
    }
    res.send({'fname' :fname});
});

//// reponse à la requete 'data'
// recup de données temporelles dans le daq3
app.get('/data/', (req, res)=>{   
    var gain = acq_gain
    if (acq_spanComp)
        gain = acq_gain / 0.8  
    // on tient compte du gain externe
    gain = gain * acq_gainX10
    res.send({ 'data' :daq3.getSignalData(gain)});
});

//// reponse à la requete 'time'
app.get('/time/', (req, res)=>{   
    var timestamp = Date.now()
    var theTime = new Date(timestamp)
    // renvoie la date courante de l'odroid  
    consolelog(`app.get time= ${theTime}`,10);
    res.send({'time' :theTime.toJSON()});
});

//// reponse à la requete 'cpuTemp'
app.get('/cpuTemp/', (req, res)=>{   
    // lit la temperature moyenne du CPU   temp = 
    computeCPUTemp()
        .then((temp) => { 
            consolelog(`app.get cpuTemp ${temp}`,10);
            res.send({'cpuTemp' : temp });
        })
        .catch((e) => {
            consolelog(e);
        });
});

//// reponse à la requete 'done?'
app.get('/done?/', (req, res)=>{    
    var stat=  daq3.getAcqDone()
    consolelog(`acqDone ${stat}`,10)
    if (stat === false)
        blinkLEDstatus()
    else
        blinkLEDinterval = setInterval(blinkLEDstatus, 500)
    //renvoie un flag disant si l'acquisition de données est terminée
    res.send({'acqDone' : stat });
});

//// reponse à la requete 'fft?'
// lance un calcul de fft sur les données acquises
app.get('/fft/', (req, res)=>{   
    // lance le calcul de la fft (progamme python : welch() )
    var gain = acq_gain
    if (acq_spanComp)
        gain = acq_gain / 0.8  
    // on tient compte du gain externe, et du gain preampli
    gain = gain * acq_extgain * acq_gainX10
    var data= daq3.getSignalData(gain)
    var seg = Number(req.query['seg'])
    setLEDstatus(1)
    if (JCFFT) {
	let freq = TEIs.getModule(TEImodule).AdcSamplingRate*1.0/(data.length/2)
	consolelog("app.get(/fft/) (l 267) javascript welch in progress",10); 
	let result = welchise1(data,seg) // result is an array
	let dataToSend = '{"fft_x1":['
	for(let i=0;i<=data.length/2;i++)
	    dataToSend += 0.5*i*freq+',';
	dataToSend = dataToSend.slice(0, -1) + "]"; // last "," becomes "]"
	dataToSend += ','
	dataToSend+='"fft_y1":' + jsonize(result)+',\n'
	dataToSend+='"f0": 0,\n"fft_x2": 0,\n"fft_y2": 0.0}'
	// writeAndExit(`dataToSend=${dataToSend}`)
	const ndts=dataToSend.length
        var mydata = JSON.parse(dataToSend)
        var dataKeys = [] 
        for (const key in mydata) 
	    dataKeys.push(key)
        fft_X_1=mydata[dataKeys[0]]
        fft_Y_1=mydata[dataKeys[1]]
        if (mydata[dataKeys[3]].length != undefined){
	    fft_X_N=mydata[dataKeys[3]]
	    fft_Y_N=mydata[dataKeys[4]]     
        }
        res.send(dataToSend)
        blinkLEDinterval = setInterval(blinkLEDstatus, 500);
    } else {
	// nom prog python suivi des arguments : -f (freq ech.), -s (samples), -m : moyennage(segmentation) '-d'
	var pythonCmd = ['./odroidDaq/node/python/fft3.py', '-f ', '-s ', '-m']
	pythonCmd[1] = '-f ' + TEIs.getModule(TEImodule).AdcSamplingRate
	pythonCmd[2] = '-s ' + acq_samples // variable globale affectee par samples
	pythonCmd[3] = '-m ' + seg
	//   pythonCmd[4] = '-d 0 ' 
	var dataToSend ="";
	// spawn new child process to call the python script
	const python = spawn('python3', pythonCmd )
	// collect data from script
	consolelog (`# app.get(/fft/) app.js (l 306) : pythonCmd=${pythonCmd}`,15)
	python.stdout.on('data', function (data) {
            // recupere 2 tableaux {f, Pxx_den}
            consolelog(`app.get(/fft/) app.js (l 267) : Pipe data from python script ... data.length= ${data.length}`,10);
            dataToSend += data.toString();
	});
	python.stderr.on('data', function (data) {
            consolelog(`app.get(/fft/ app.js (l 307) stderr data.toString()= ${data.toString()}`,10);
	});
	// in close event we are sure that stream from child process is closed
	python.on('close', (code) => {
            consolelog(`child process close all stdio with code ${code}`,10);
            // dataTosend -> fft_X et fft_Y pour eventuelle sauvegardesupprime les fichiers
            var data = JSON.parse(dataToSend)
            var dataKeys = [] 
            for (const key in data) {
		dataKeys.push(key)
            } 
            fft_X_1=data[dataKeys[0]]
            fft_Y_1=data[dataKeys[1]]
            if (data[dataKeys[3]].length != undefined){
		fft_X_N=data[dataKeys[3]]
		fft_Y_N=data[dataKeys[4]]     
            }
            else{
		fft_X_N.length=0; fft_Y_N.length=0
            }
            // send data to browser
            // consolelog("app.get(/fft/ app.js (l 346) dataToSend:" )
	    // writeAndExit(`${dataToSend}`)
            res.send(dataToSend)
            blinkLEDinterval = setInterval(blinkLEDstatus, 500);
	});
	consolelog('app.get(/fft/) app.js (l 333) write data in python script...',10)    
	consolelog (`app.get(/fft/) app.js (l 310) JSON.stringify(data)= ${JSON.stringify(data).slice(0,200)}`,10) 
	/* Stringify the array before send to py_process */
	python.stdin.write(JSON.stringify(data) )
	consolelog(`app.get(/fft (l 343) welch en python data(0,1,2,3, ..., last)= ${data[0]},${data[1]},${data[2]},${data[3]},... ,${data[data.length-1]} len=${data.length}`,10)
	if (false) 
	    for (let i=0;i<data.length;i++) {
		consolelog(data[i],10)
	    } // to log the input of the welch verbose=15 and verboseThresholdGlobal = 11
	/* Close the stream */
	python.stdin.end();
    } // fin else de if (JCFFT)
});  // fin app.get('/fft/', (req, res)=>{   

//// reponse à la requete 'listdir?'
app.get("/listDir/", (req, res)=> {
    // renvoie la liste des fichiersdu dossier 'data
    dataFiles.list() .then(
        (files) => {
            res.send({'files': JSON.stringify(files) } )
        });
});

//// reponse à la requete 'upload?'
//route to download a file
app.get('/upload/',(req, res) => {
    var directoryPath = path.join(__dirname, '..', 'data');  
    var file = req.query['f'];
    var files = file.split(',')
    if (files.length === 1) {
        // un seul fichier a envoyer
        var fileLocation = path.join(directoryPath,file);
        consolelog(fileLocation,10);
        res.download(fileLocation, file, 
                     function(err) {
                         if(err) {
                             consolelog(err);
                         }
                     } )
    }
    else {
        // plusieurs fichiers -> zip
        var zip = new jszip();
        files.forEach(f => {
            zip.file(f, fs.readFileSync(path.join(directoryPath,f)));
        });
        
        //crée le fichier zip
        zip.generateAsync({type:"base64"}).then(function (content) { // 1) generate the zip file
            FileSaver.saveAs(content, 'out.zip')  
            consolelog('zip-> out.zip',10)
            res.send({'zip':'out.zip'})
        });
    }

    
});
/************************************* requetes POST *********************************/

app.post('/', function (req, res) {
    consolelog(`* ${req.body}`,10);
    res.end();
})

//// reponse à la requete 'initSerial?'
app.post('/initSerial', function (req, res) {
    consolelog(`initSerial ${req.body.val}`,10);
    // initialisation de la liaison serie vers le daq3
    daq3.initSerial(req.body.val).then(
        (id) => {
            consolelog(`id ${id}`,10)
            //renvoie l'id du daq3
            TEImodule= id
            consolelog(TEIs.getModule(id),10)
            res.send(TEIs.getModule(id));
            fillGainCommand(TEIs.getModule(id))
            // place le daq3 dans une config connue
            consolelog(`${daq3.setup()}`,10);
            daq3.initParser()
        }
    )
    
})

//// reponse à la requete 'closeSerial?'
app.post('/closeSerial', function (req, res) {
    // arret du port serie
    consolelog('closeSerial',10);
    daq3.closeSerial()
    res.end();
})

//// reponse à la requete 'dateSet'
app.post('/dateset', function (req, res) {
    // mise a jour de la date systeme de l'odroid, à partir de celle du pc 
    dateTime    = new Date(req.body.val) //Convert string or number to date
    let day     = dateTime.getDate() 
    let month   = dateTime.getUTCMonth() + 1 
    let year    = dateTime.getFullYear() 
    let hour = dateTime.getHours()
    let min= dateTime.getMinutes() 
    let updateD = `${year}-${month}-${day} ${hour}:${min}` //Format the string correctly
    
    consolelog(`setdate ${req.body.val} ${updateD}`,10);
    // lancement du script bash 'setDate.sh'
    exec(`/usr/local/bin/setDate.sh "${updateD}"`, (err, stdout, stderr) => {
        if (err || stderr) {
            console.error('err', err);
            consolelog(`log ${stderr}`);
        } else {
            consolelog("Successfully set the system's datetime",10 );///to ${stdout}`);
        }
    })
    res.end();
})

//// reponse à la requete 'gain'
// changement de la valeur du gain dans le daq3
app.post('/gain', function (req, res) {
    // gain programmable DAQ3
    // affiche la commande -> la valeur du gain
    acq_gain = gainValues[req.body.val -1]
    consolelog(`gain ${req.body.val} -> ${acq_gain}`,10);
    //envoie la commande au daq3
    daq3.setParameter(req.body.val.toString()).then( ()=>{ return acq_gain })
    res.end();
}) 

//// reponse à la requete 'extgain'
// changement de la valeur du gain externe
app.post('/extgain', function (req, res) {
    // gain externe
    // affiche la commande -> la valeur du gain
    acq_extgain = req.body.val 
    consolelog(`extgain=' ${req.body.val} -> gain= ${acq_extgain} * ${acq_gain}`,10);
    //envoie la commande au daq3
    // daq3.setParameter(req.body.val.toString()).then( ()=>{ return acq_gain })
    res.end();
})     

app.post('/', function (req, res) {
    consolelog(`* ${req.body}`,10);
    res.end();
})

//// reponse à la requete 'set'
// changement de la valeur d'une variable du daq3'
app.post('/set', function (req, res) {
    consolelog(`set ${req.body.val}`,10);
    var value = Number( req.body.val.substring( req.body.val.indexOf('=') +1 ))
    if (req.body.val.search('highZ')!==-1){
        cmd = 'h'; acq_highZ = (value === 1)
    }
    else if(req.body.val.search('spanComp')!==-1){
        cmd = 's'; acq_spanComp = (value === 1)
    }
    else if(req.body.val.search('SQwave')!==-1){
        cmd = 'f'; acq_sqWave = (value === 1)
    }   
    else if(req.body.val.search('JCBUTTON')!==-1){
        consolelog(`app.post(/set  line 511 JCFFT=${JCFFT}`,10)
	JCFFT = !JCFFT
	res.end()
	return
    }   
    // si value =1 commande uppercase, lowercase sinon
    if (value ==1)
        cmd = cmd.toUpperCase()
    
    consolelog(`set ${cmd}`,10)
    //envoie la commande au daq3
    daq3.setParameter(cmd).then( ()=>{ return 'done' ; })

    res.end();
}) 

//// reponse à la requete 'gpio'
// change l'etat d'une gpio de l'odroid
app.post('/gpio', function (req, res) {
    consolelog(`gpio ${req.body.val}`,10);
    // req.body.val de la forme 'ACDC=1'
    var name = req.body.val.substring(0, req.body.val.indexOf('=') )
    var value = Number( req.body.val.substring( req.body.val.indexOf('=') +1 ))
    // inversion pour J1 et J2
    if (name.indexOf('J')!==-1)
        if (value ===0) value= 1
    else value=0

    if (name.indexOf('X')!==-1)
        // gain preampli X10
        if (value ===1) acq_gainX10 = 50
    else  acq_gainX10 = 5 

    consolelog(`${name} ${value}`,10)
    var theGpio  = odroidGPIOS.find( element => element.name === name )
    if (theGpio===undefined)
        res.end()

    consolelog(`set gpio ${theGpio.name} ${theGpio.pin}  ${value}`,10)
    // changement
    theGpio.gpio.writeSync( value )

    res.end();
}) 

//// reponse à la requete 'samples'
app.post('/samples', function (req, res) {
    // modif du nombre d'echantillons à prendre
    // utilisés lors de l'acquisition
    acq_samples= req.body.val
    res.end();
})  

//// reponse à la requete 'delfile'
app.post('/delfile', function (req, res) {
    consolelog(`del ${req.body}`,10);      
    res.send({'deleted' :  files.delete(req.body.val) });
})

//// reponse à la requete 'quit'
app.post('/quit', function (req, res) {
    consolelog(`quit ${req.body}`,10);
    quit()
    res.end();
})

/**************************************************************************/
/**
 * rempli les tableau de gain et commandes (pour obtenir cs gains sur le daq3)
 * @param {*} data : valeurs fonction du type de module (pour nous daq3)
 */
function fillGainCommand(data){
    // remplit la liste des commandes de gain        gain : gain,

    var key, keys = Object.keys(data)
    consolelog(`keys ${keys}`,10)
    //vide gainCmd
    while (gainValues.length)
        gainValues.pop()
    //le remplit
    for (var i=0; i!= keys.length; i++){
        if ((keys[i].search(/^gain\s\d/)!== -1)){///|| (keys[i].search(/^gain\s\d\.\d{1,2}$/)!== -1)
            gainValues.push( (keys[i].substring( keys[i].indexOf(' ') +1))); 
        }
    }
    consolelog( `gainValues: ${gainValues}`,10);
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
    var cpuTemp=0, cmd="";
    let cpuTempCmd ="cat /sys/devices/virtual/thermal/thermal_zone";
    let error= false;
    // 5 zones definies, on en fait la moyenne
    for (var i=0; i!=5 && error===false; i++){
        cmd = cpuTempCmd + i.toString() + "/temp";
        await getCpuTemp(cmd)
            .then((temp) => {
                cpuTemp += temp;
            })
            .catch((err) => {
                error =true;
            });
    }//end for
    if (error === true)
        return(-1);
    else {
        //moyenne
        cpuTemp = cpuTemp / 5 ;
        // /1000 pour l'avoir en degréC
        return( cpuTemp/ 1000) ;
    }
} // FIN async function computeCPUTemp()

/**
 * function getCpuTemp( cmd)
 * recupre une des temperatures CPU de l'odroid
 * @param {} cmd : commande 'cat ..' à executer
 * @returns promise
 */
function getCpuTemp( cmd){
    return new Promise(( resolve, reject) => {
        var temp=0, error =false, ended =false;
        const script= exec(cmd);
        script.stdout.on('data', function(data){
            //temperature en 1/1000 de degrés
            temp =parseInt(data)
        })
        // what to do with data coming from the standard error
        script.stderr.on('data', function(data){
            error= true;
        });
        script.on('exit', function (code) {
            ended =true;
            if (code != 0) 
                error= true;
            
            if (error === true)
                reject(error);
            else {
                resolve( temp) ;
            }
        });
    }  );

}
/**************************************************************************/

function quit() { 
/**
 * pour quitter, et arretere proprement l'odroid
 */
    consolelog( 'function quit',10);
    // lancement du script bash
    spawn ("/bin/sh", ['-c', `/usr/local/bin/shutDown.sh`]);
} // FIN function quit() { 
/* *********************************************************************************** */

function welchise1(data,freqSampling) {
    // a single segment [0,n[
    let N = data.length
    //const f = Array.from({ length: N/2 + 1 }, (_, i) => i*freqSampling/N);
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
    // return [f,P]
    return P;
} // function welchise1(data,freqSampling) {
// ***************************************************************************************

function welchise2(data,freqSampling) {
    // 3 segments of size N/2 :[0,N/2[,[N/4,3N/4[,[N/2,N[
    let N = data.length
    let T1 = welchise1(data.slice(0,N/2),freqSampling) //  slice(d,f)->[d,f[
    let T2 = welchise1(data.slice(N/4,3*N/4),freqSampling)
    let T3 = welchise1(data.slice(N/2,N),freqSampling)
    let P = T1.map((val, i) => (val + T2[i] + T3[i]) / 3);
    return P;
} // FIN function welchise2(data,freqSampling) {
// ***************************************************************************************

function welchise3(data,freqSampling) {
    // 7 segments of size N/4 :[0,N/4[,[N/8,3N/8[,[N/4,N/2[,[3N/8,5N/8[,
    // [N/2,3N/4[,[5N/8,7N/8[,[3N/4,N[    
    let N = data.length
    let T1 = welchise1(data.slice(0,N/4),freqSampling) //  slice(d,f)->[d,f[
    let T2 = welchise1(data.slice(N/8,3*N/8),freqSampling)
    let T3 = welchise1(data.slice(N/4,N/2),freqSampling)
    let T4 = welchise1(data.slice(3*N/8,5*N/8),freqSampling)
    let T5 = welchise1(data.slice(N/2,3*N/4),freqSampling)
    let T6 = welchise1(data.slice(5*N/8,7*N/8),freqSampling)
    let T7 = welchise1(data.slice(3*N/4,N),freqSampling)
    let P = T1.map((val, i) => (val+ T2[i]+T3[i]+T4[i]+T5[i]+T6[i]+T7[i])/7);
    return P;
} // FIN function welchise3(data,freqSampling) {
// ***************************************************************************************

function generatedataToSend(N=8192) {
    function generateRepeatedNumberString() {
	const number = "1.234e-7";
	return '"fft_y1": ['+Array(N+1).fill(number).join(",")+']';
    }
    function generateScaledNumbersString() {
	const factor = 122.0703125;
	const numbers = [];
	for (let n = 0; n <= N; n++) {
            numbers.push(factor * n);
	}
	return '"fft_x1": ['+ numbers.join(",") +']';
    }
    return  '{' + generateScaledNumbersString() + ',' +  generateRepeatedNumberString() + ',"f0": 0,"fft_x2": 0,"fft_y2": 0.0}'
} // FIN function generatedataToSend(N=8192) {
/* *********************************************************************************** */

function segmentise(n,k) {
    // there are 2**n points, and each segments has 2**(n-k) points
    // the consecutive segments overlap by half of their length
    // return the list of the endpoints of the segments,
    // the first point is included while the last is excluded
    N = 2**n
    nps = 2**(n-k)
    npsHalf = 2**(n-k-1)
    nbs = 2**(k+1)-1
    cur = 0
    let res = [];
    for (let i=0;i<nbs;i++) {
	res.push([cur,cur+nps])
	cur = cur + npsHalf
    }
    return res;
} // FIN function segmentise(n,k) {
// *************************************************************************

function testAndQuit(npts,w,T) {
    // cree un signal de freq w (w alternance/seconde) echantillonne npts fois a une frequence de 1/T
    // donc les tps de mesures sont 0, T,2*T, ... ,(npts-1)*T ou le signal vaut sin(0), sin(w*T),sin(2*w*T), ...
    // il y alors |w*(npts-1)*T| alternance plus la partie non entiere 
    let S = new Float64Array(npts);  // contiendra le signal
    for(let i=0;i<npts;i++) {
	let ti = i*T
	S[i] = Math.sin(w*ti)
    }
    for(let i=0;i<npts;i++) 
	consolelog(`${i} ${i*T} ${S[i]}`,10)
    consolelog("\n\n",10)
    const rezu = welchise(S,1)
    for(let i=0;i<npts/2+1;i++) 
	consolelog(`${i}  ${i/T} ${rezu[i]}`,10)
    process.exit();
} // function testAndQuit(npts,w,T) {
// *************************************************************************

function jsonize(T) {
    return '[' + T.join(",") + '] '
} // FIN function jsonize(T) {
// *************************************************************************

function writeAndExit(message, code = 0) {
    // utile pour le debbogage
    const ok = process.stdout.write(message + '\n');
    if (ok) {
        process.exit(code);
    } else {
        // attendre que le flux soit vidé
        process.stdout.once('drain', () => {
            process.exit(code);
        });
    }
} // FIN function writeAndExit(message, code = 0) {
// *************************************************************************

function consolelog(message,verbose=Number.MAX_SAFE_INTEGER-1) {
    // without argument -> ALWAYS printed
    // to ensure NO printing use verboseThresholdGlobal=Number.MAX_SAFE_INTEGER
    if (verbose >= verboseThresholdGlobal)
	console.log(message)
}  // FIN function consolelog(message,verbose=0) {
// *************************************************************************
