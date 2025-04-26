const PORT = 3000;
const serverVersion = '20230509';
// version adaptée à l'ampli diff_JFE2140
// gain 5/50, gpio led

// pour la comm avec daq3
const daq3 = require('./daq3.js');
// pour le management des fichiers de données
const dataFiles = require('./files.js');
// pour la manipulation des gpios de l'odroid
const gpio = require("onoff").Gpio
// pour la manipulation de fichiers statiques
const path = require('path')
var fs = require('fs');
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
    // console.log('GPIO:', n, n.name, n.pin)
    var mygpio = new gpio(n.pin, 'out')
    //  console.log( typeof mygpio, mygpio)
    n.gpio= mygpio
    
});
// console.log('GPIOS :',odroidGPIOS)

/**************************serveur web ***********************************************/

// demarrage du serveur web 'express'
app.listen(PORT, (error) =>{
    if(!error) 
        console.log("Server v"+ serverVersion +"is Successfully Running, and App is listening on port "+ PORT); //console.log(TEI.length)
    else 
        console.log("Error occurred, server can't start", error);
});

/******************************** requetes GET ***************************************/

//// sert la page par defaut odroidDaqweb/index.html
app.get('/', (req, res)=>{  
    console.log('/', req)  
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
        console.log('reinit :', n.name, n.start)
        n.gpio.writeSync(n.start)
    })
    console.log('listSerial')
    daq3.getSerialPortList().then (
        (list)=> {
            console.log('list:',list)
            //renvoie la liste des ports serie
            res.json({'serial' :list});
        } )
});

//// reponse à la requete 'aquire'
app.get('/acquire/', (req, res)=>{   
    console.log('app.js l 130: acquire')
    clearInterval(blinkLEDinterval);
    setLEDstatus(1)
    // lance l'acqui ur le daq3
    daq3.dataCollect(acq_samples) // acq_samples est une variable global
    res.send({ 'acq': 'started'});
});

//// reponse à la requete 'save'
app.get('/save/', (req, res)=>{   
    var name= req.query['f']
    console.log('save', name) 
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
    console.log ('data :', data.length)
    fs.writeFile(fname, dataStr, function (err) {
        if (err) throw err;
        console.log('Saved!');
    })
    res.send({'fname' :fname});
});

//// reponse à la requete 'savefft'
app.get('/savefft/', (req, res)=>{   
    var name= req.query['f'], dateNow = Date.now()
    console.log('savefft', name)
    // sauvegarde de la fft calculée
    // fichier texte 2 colonnes X, Y
    var fftStr='', size = fft_X_1.length
    console.log(typeof fft_X_1)
    console.log(`app.get('/savefft/' size=${size} et ${fft_Y_1.length}`)
    console.log(`fapp.get('/savefft/' fft_X_1[0]=${fft_X_1[0]} fft_Y_1[0]=${fft_Y_1[0]}`)
    for (let i=0; i!=size; i++ ){
        fftStr += fft_X_1[i].toString() + ' ' + fft_Y_1[i].toString() + '\n'
    }
    var fname = "data/"+name +"_fft_1_" + dateNow + '.dat'
    try{
        fs.writeFileSync(fname, fftStr ); console.log(fname, 'Saved!');
    }catch (err) {       
        console.log( err)  
    }
    // si on a fait une fft avec seg>1 on a 2 ffts
    if (fft_X_N.length ){
        fftStr='', size = fft_X_N.length
        for (let i=0; i!=size; i++ ){
            fftStr += fft_X_N[i].toString() + ' ' + fft_Y_N[i].toString() + '\n'
        }
        fname = "data/"+name +"_fft_N_" + dateNow + '.dat'
        try {
            fs.writeFileSync(fname, fftStr );console.log(fname, 'Saved!');
        }
        catch (err){
            console.log( err)  
        }
    }
    res.send({'fname' :fname});
});

//// reponse à la requete 'data'
// recup de données temporelles dans le daq3
app.get('/data/', (req, res)=>{   
    console.log('getData')
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
    console.log('app.get time' , theTime );
    res.send({'time' :theTime.toJSON()});
});

//// reponse à la requete 'cpuTemp'
app.get('/cpuTemp/', (req, res)=>{   
    // lit la temperature moyenne du CPU   temp = 
    computeCPUTemp()
        .then((temp) => { 
            console.log('app.get cpuTemp' , temp );
            res.send({'cpuTemp' : temp });
        })
        .catch((e) => {
            console.log(e);
        });
});

//// reponse à la requete 'done?'
app.get('/done?/', (req, res)=>{    
    var stat=  daq3.getAcqDone()
    console.log('acqDone' ,stat )
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
    console.log('app.js anonyme (app.get(/fft/) (l 250) getFFT')
    var gain = acq_gain
    if (acq_spanComp)
        gain = acq_gain / 0.8  
    // on tient compte du gain externe, et du gain preampli
    gain = gain * acq_extgain * acq_gainX10
    var data= daq3.getSignalData(gain)
    var seg = Number(req.query['seg'])
    let JCFFT=0
    if (JCFFT) {
	console.log("app.get(/fft/) (l 260) javascript welch in progress"); 
	console.log("length=",data.length,"data[0]=",data[0])
	welchise(data)
	process.exit(1);
    } else {
	setLEDstatus(1)
	var seg = Number(req.query['seg'])
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
	console.log ("app.get(/fft/) app.js (l 264) : pythonCmd=",pythonCmd)
	python.stdout.on('data', function (data) {
            // recupere 2 tableaux {f, Pxx_den}
            console.log(`app.get(/fft/) app.js (l 267) : Pipe data from python script ... data.length=`, data.length);
	    // ICI JE METS DES VALEURS FAKE
            dataToSend += data.toString();
	});
	python.stderr.on('data', function (data) {
            console.log('app.get(/fft/ app.js (l 273) stderr data.toString()=', data.toString());
	});
	// in close event we are sure that stream from child process is closed
	python.on('close', (code) => {
            console.log(`child process close all stdio with code ${code}`);
	    if (0) {
		console.log("app.get(/fft/) app.js (l 291) GENERATING FAKE DATA");
		dataToSend = generatedataToSend()
	    }
	    console.log(`app.get(/fft/) app.js (l 290) APRES dataToSend= ${dataToSend}`)
            // dataTosend -> fft_X et fft_Y pour eventuelle sauvegardesupprime les fichiers
	    // JC JC JC MODIFICATION DE LA STRING dataToSend POUR VERIFICATION
            var data = JSON.parse(dataToSend)
            var dataKeys = [] 
            for (const key in data) {
		dataKeys.push(key)
            } 
            console.log('app.get(/fft/ app.js (l 296) keys :', dataKeys)

            fft_X_1=data[dataKeys[0]]
            fft_Y_1=data[dataKeys[1]]
            if (data[dataKeys[3]].length != undefined){
		fft_X_N=data[dataKeys[3]]
		fft_Y_N=data[dataKeys[4]]     
            }
            else{
		fft_X_N.length=0; fft_Y_N.length=0
            }
            console.log(dataKeys[2], data[dataKeys[2]], 'lengths fft1:', data[dataKeys[0]].length, ' fft2:', data[dataKeys[3]].length )
            
            // send data to browser
            res.send(dataToSend)
            blinkLEDinterval = setInterval(blinkLEDstatus, 500);
	});
	console.log('app.get(/fft/) app.js (l 311) write data in python script...')    
	console.log ("app.get(/fft/) app.js (l 310) JSON.stringify(data)=",JSON.stringify(data).slice(0,200)) 
	/* Stringify the array before send to py_process */
	python.stdin.write(JSON.stringify(data) )
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
    //  console.log('UPLOAD res :',res)
    var file = req.query['f'];
    var files = file.split(',')
    if (files.length === 1) {
        // un seul fichier a envoyer
        var fileLocation = path.join(directoryPath,file);
        console.log(fileLocation);
        res.download(fileLocation, file, 
                     function(err) {
                         if(err) {
                             console.log(err);
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
            console.log('zip-> out.zip')
            res.send({'zip':'out.zip'})
        });
    }

    
});
/************************************* requetes POST *********************************/

app.post('/', function (req, res) {
    console.log('*',  req.body);
    res.end();
})

//// reponse à la requete 'initSerial?'
app.post('/initSerial', function (req, res) {
    console.log('initSerial',req.body.val);
    // initialisation de la liaison serie vers le daq3
    daq3.initSerial(req.body.val).then(
        (id) => {
            console.log('id', id)
            //renvoie l'id du daq3
            TEImodule= id
            console.log(TEIs.getModule(id))
            res.send(TEIs.getModule(id));
            fillGainCommand(TEIs.getModule(id))
            // place le daq3 dans une config connue
            console.log(daq3.setup());
            daq3.initParser()
        }
    )
    
})

//// reponse à la requete 'closeSerial?'
app.post('/closeSerial', function (req, res) {
    // arret du port serie
    console.log('closeSerial');
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
    
    console.log('setdate',req.body.val, updateD);
    // lancement du script bash 'setDate.sh'
    exec(`/usr/local/bin/setDate.sh "${updateD}"`, (err, stdout, stderr) => {
        if (err || stderr) {
            console.error('err', err);
            console.log('log',stderr);
        } else {
            //  console.log(stdout);
            console.log("Successfully set the system's datetime" );///to ${stdout}`);
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
    console.log('gain', req.body.val, '->', acq_gain);
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
    console.log('extgain=', req.body.val, '-> gain=', acq_extgain * acq_gain);
    //envoie la commande au daq3
    // daq3.setParameter(req.body.val.toString()).then( ()=>{ return acq_gain })
    res.end();
})     

app.post('/', function (req, res) {
    console.log('*',  req.body);
    res.end();
})

//// reponse à la requete 'set'
// changement de la valeur d'une variable du daq3'
app.post('/set', function (req, res) {
    console.log('set', req.body.val);
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
    // si value =1 commande uppercase, lowercase sinon
    if (value ==1)
        cmd = cmd.toUpperCase()
    
    console.log('set', cmd)
    //envoie la commande au daq3
    daq3.setParameter(cmd).then( ()=>{ return 'done' ; })

    res.end();
}) 

//// reponse à la requete 'gpio'
// change l'etat d'une gpio de l'odroid
app.post('/gpio', function (req, res) {
    console.log('gpio', req.body.val);
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

    console.log(name, value)
    var theGpio  = odroidGPIOS.find( element => element.name === name    )
    //console.log('found :', theGpio)
    if (theGpio===undefined)
        res.end()

    console.log('set gpio ',theGpio.name, theGpio.pin , value)
    // changement
    theGpio.gpio.writeSync( value )

    res.end();
}) 

//// reponse à la requete 'samples'
app.post('/samples', function (req, res) {
    // modif du nombre d'echantillons à prendre
    // utilisés lors de l'acquisition
    acq_samples= req.body.val
    console.log('anonymous post(/samples) app.js (l 516) samples acq_samples', acq_samples);
    res.end();
})  

//// reponse à la requete 'delfile'
app.post('/delfile', function (req, res) {
    console.log('del',  req.body);      
    res.send({'deleted' :  files.delete(req.body.val) });
})

//// reponse à la requete 'quit'
app.post('/quit', function (req, res) {
    console.log('quit',  req.body);
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
    console.log('keys', keys)
    //vide gainCmd
    while (gainValues.length)
        gainValues.pop()
    //le remplit
    for (var i=0; i!= keys.length; i++){
        // console.log( i, keys[i])
        if ((keys[i].search(/^gain\s\d/)!== -1)){///|| (keys[i].search(/^gain\s\d\.\d{1,2}$/)!== -1)
            gainValues.push( (keys[i].substring( keys[i].indexOf(' ') +1))); 
        }
    }
    console.log( 'gainValues:', gainValues);

}

/**************************************************************************/
/**
 * async function computeCPUTemp()
 * @brief   calcule une temperature moyenne du CPU en lisant les valeurs de temp des 5 zones
 *  dans /sys/devices/virtual/thermal/thermal_zoneX
 * 
 * @returns la temperature moyenne
 */

async function computeCPUTemp()
{
    var cpuTemp=0, cmd="";
    let cpuTempCmd ="cat /sys/devices/virtual/thermal/thermal_zone";
    let error= false;
    // 5 zones definies, on en fait la moyenne
    for (var i=0; i!=5 && error===false; i++){
        cmd = cpuTempCmd + i.toString() + "/temp";
        await getCpuTemp(cmd)
            .then((temp) => {
                cpuTemp += temp;
                //   console.log('+=', cpuTemp);
            })
            .catch((err) => {
                error =true;
            });
    }//end for
    if (error === true)
        return(-1);
    else {
        // console.log('comp resolve', cpuTemp);
        //moyenne
        cpuTemp = cpuTemp / 5 ;
        // /1000 pour l'avoir en degréC
        return( cpuTemp/ 1000) ;
    }

}

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
            //console.log(cmd, data.toString());
            //temperature en 1/1000 de degrés
            temp =parseInt(data)
        })
        // what to do with data coming from the standard error
        script.stderr.on('data', function(data){
            // console.log('err', data.toString()); 
            error= true;
        });
        script.on('exit', function (code) {
            ended =true;
            if (code != 0) 
                error= true;
            
            if (error === true)
                reject(error);
            else {
                // console.log('get resolve', temp);
                resolve( temp) ;
            }
        });
    }  );

}
/**************************************************************************/
/**
 * pour quitter, et arretere proprement l'odroid
 */
function quit()
{ 
    
    console.log( 'function quit');
    // lancement du script bash
    spawn ("/bin/sh", ['-c', `/usr/local/bin/shutDown.sh`]);
}
/* *********************************************************************************** */

function welchise(data) {
    // perfrom the welch transform end i) send the results to the client, ii) set the arrays fft_X_1 and friends 
    console.log('welchise app.js  (l 645) entering');
    // dataTosend -> fft_X et fft_Y pour eventuelle sauvegardesupprime les fichiers
    var data = JSON.parse(dataToSend)
    var dataKeys = [] 
    for (const key in data) {
	dataKeys.push(key)
    } 
    console.log('app.get(/fft/ app.js (l 296) keys :', dataKeys)
    
    fft_X_1=data[dataKeys[0]]
    fft_Y_1=data[dataKeys[1]]
    if (data[dataKeys[3]].length != undefined){
	fft_X_N=data[dataKeys[3]]
	fft_Y_N=data[dataKeys[4]]     
    }
    else{
	fft_X_N.length=0; fft_Y_N.length=0
    }
    console.log(dataKeys[2], data[dataKeys[2]], 'lengths fft1:', data[dataKeys[0]].length, ' fft2:', data[dataKeys[3]].length )
    
    // send data to browser
    res.send(dataToSend)
    blinkLEDinterval = setInterval(blinkLEDstatus, 500);
}; // FIN function welchise(data) {
/* *********************************************************************************** */

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
