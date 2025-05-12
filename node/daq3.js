// daq3.js
// liaison avec le module DAQ3 via la liaison serie
const { consolelog,verboseThresholdGlobal,JC } = require('./app.js');
const daq3Version = '20221103';
consolelog(`# flag JC= ${JC}`)
const serialport = require("serialport");
var sp, SerialPort = serialport.SerialPort;
var events = require('events');
const {ByteLengthParser} = require('@serialport/parser-byte-length')
const TEIs = require('./TEImodules.js');
var serports=[];
var moduleID=0;
var selectedPort='';
var signal =new Array()
var signalLength=0, acqiDone =false

var eventEmitter = new events.EventEmitter();
var acquisitionDone = function () {
    acqiDone = true
    console.log('acqDone', acqiDone);
}  // FIN acquisitionDone(
eventEmitter.on('acqDone', acquisitionDone );//Assign the event handler to an event:

function getAcqDone(){
    return acqiDone
}  // FIN function getAcqDone(
/**********************************************************************/
function initParser() {  
    //quand on a reçu toutes les datas souhaitées par paquets de 16k (* la taille d'un element)
    //nbBytes nbre de caracteres reçus par valeur : 16 bits -> nbBytes =4, 18 ou 20 bits -> 5
    var nbBytes = Math.ceil(TEIs.getModule(moduleID).AdcResolution /4)
    parser = sp.pipe(new ByteLengthParser({ length: 16384 * nbBytes }))
    parser.on('data', function (data) {
        const startParserFunction = performance.now(); // JC 
        console.log('initParser daq3.js (l 37) Received acceptable data!', typeof signal,  data.length )
        // positive values reach from 0 to AdcTreshold, 
        // negatives values from AdcTreshold to AdcTreshold*2 
        var threshold = TEIs.getModule(moduleID).AdcTreshold
        var maxInt = TEIs.getModule(moduleID).AdcTreshold *2
        if ( (moduleID===2) || (moduleID===3) )    {
            // negative full scale is 0, 
            // mid scale is 0x8000 / 32768 and pos full scale is 0xffff / 65536
            threshold = 0; maxInt = TEIs.getModule(moduleID).AdcTreshold; 
        }
        console.log('initParser daq3.js (l 47) nbbyte:',nbBytes,'thrsh :', threshold, 'maxint:', maxInt)
        var min=0x3ffff, max =0
        //les données arrivent en ascii !  p.ex. : '0','1','A','B','F' pour  0x01ABF
        const start = performance.now(); // JC
        if (JC==1) {
            console.log("a la JC")
            for (let k = 0; k < Math.trunc(data.length/5) ; k++) {// JC
                let i = 5*k;// JC
                let x0 = data[i+0]<=57 ? data[i+0]-48 : data[i+0]-55;// JC
                let x1 = data[i+1]<=57 ? data[i+1]-48 : data[i+1]-55;// JC
                let x2 = data[i+2]<=57 ? data[i+2]-48 : data[i+2]-55;// JC
                let x3 = data[i+3]<=57 ? data[i+3]-48 : data[i+3]-55;// JC
                let x4 = data[i+4]<=57 ? data[i+4]-48 : data[i+4]-55;// JC
                var value = 65536*x0 + 4096*x1 + 256*x2 + 16*x3 + x4;// JC
                if (value > threshold)// JC
                    value = value - maxInt// JC
                if (value < min) min =value// JC
                if (value > max) max =value// JC
                // signal tableau d'entiers +/- // JC
                signal.push(value)// JC
            }// JC
        } else {
            console.log("a la pas JC")
            for( var i=0; i < data.length; i+=nbBytes){
                // mots de 20 bits 
                var value = parseInt(data.subarray(i, i+nbBytes), 16)      
                if (value > threshold)
                    value = value - maxInt
                if (value < min) min =value
                if (value > max) max =value
                // signal tableau d'entiers +/- 
                signal.push(value)
            }
        }
        const end = performance.now(); // JC
        console.log(`Temps d'exécution conversion dans initParser JC: ${(end - start).toFixed(3)} ms`);// JC

        if (signal.length === signalLength) // signalLength est une variable globale affectee dans dataCollect
            //envoie un signal de fin d'acquisition
            eventEmitter.emit('acqDone'); // qui declancher un appel a la fonction acquistionDone

        console.log("initParser daq3.js(l 88) signal length ", signal.length, " min:", min.toString(16), " max:", max.toString(16))
        const endParserFunction = performance.now(); // JC 
        console.log(`Temps d'exécution total dans initParser JC: ${(endParserFunction - startParserFunction).toFixed(3)} ms`);// JC
    }) // FIN fonction de parser.on JC
} // FIN function initParser()
/********************************************************************************************/

/**
 * met a jour la liste des ports serie dispo sur l'odroid
 * @returns la liste des ports dispos []
 */
function getSerialPortList(){
    //vide la liste 
    do {
        elmt = serports.shift()
    }while(elmt !== undefined )

    return new Promise( function(resolve, reject){
        SerialPort.list().then(ports => {
            ports.forEach(  function(port) {
                var serPort = new Object();
                serPort.id = port.manufacturer;
                serPort.path= port.path;
                //          console.log(serPort)
                serports.push(serPort);
                
            })
            //renvoie la liste des ports serie
            resolve (serports)
        });
    })
}  // FIN function getSerialPortList(
/**********************************************************************/

/**
 * convertit les données temporelles reçues en Volts selon le type de carte (moduleID)
 * @param {Float64Array} s données temporelles brutes 
 * @param {Number} gain gain courant total
 */
function dataConvert(s, gain){
    //convertit les données temporelles reçues en Volts selon le type de carte (moduleID)
    console.log('moduleID=',moduleID,' dataConvert gain:', gain, s.length)

    var maxInt = TEIs.getModule(moduleID).AdcTreshold *2
    
    switch( moduleID) { // avec le hard actuel c'est case=4
    case 1 :  //ADC = AD4003BCPZ-RL7 18-bit 2 MSps
        //ADC resolution is 18bit, positive values reach from 0 to 131071, 
        // negatives values from 131072 to 262142 
        for( var i=0; i < signal.length; i++) 
            s[i]=signal[i] * (2*4.096*1/0.4)/maxInt/gain
        break;
    case 2 :    // ADC = ADAQ7988, 16-bit 0.5 MSps,
    case 3 :    // ADC = ADAQ7980, 16-bit   1 MSps
        //ADC resolution  is 16bit, negative full scale is 0, 
        // mid scale is 0x8000 / 32768 and pos full scale is 0xffff / 65536
        for( var i=0; i < signal.length; i++) {
            signal[i] = signal[i] - threshold
            s[i]= (-1*(signal[i])*2*4*0.5*5.0/maxInt/gain)
        }
        break;   
    case 4 :  //ADC = ADAQ4003BBCZ 18-bit 2 MSps        
        // ADC resolution is 18bit, positive values reach from 0 to 131071, 
        // negatives values from 131072 to 262142 
        for( var i=0; i < signal.length; i++)
            s[i]=  ( signal[i]*(2*5.0*1/0.45)/maxInt/gain) //(2*Vref*ADCgain) / 2*maxInt
        break;
    case 5 :  // ADC = XYZ 20-bit 1.8 MSps        
        // ADC resolution is 20 bit, positive values reach from 0 to 524287, 
        // negatives values from 131072 to 262142
        for( var i=0; i < signal.length; i++) 
            s[i]=  ( signal[i]*(2*5.0*1/0.45)/maxInt/gain)
        break;
    }  
} // FIN function dataConvert(
/********************************************************************************************/

/**
 * initialisation du port serie choisi
 * @param {string} port  (p.ex. : '/dev/ttyS3' )
 * @returns int = type de module (voir TEImodules)
 */
function initSerial(port){
    //initialise le port choisi
    console.log('daq3.initSerial', port);
    return new Promise( function(resolve, reject){
        try {
            sp = new SerialPort({ path: port, 
                                  baudRate: 115200,     
                                  databits : 8,
                                  stopbits : 1,
                                  parity : 'none'})

            sp.on("open", function () {

                selectedPort=port;
                sp.write("?", function(err, results) {
                    console.log("on open err: " + err);
                    console.log("on open results: " + results);
                })
                
            }) 
            sp.on("data", function(data) {
                // les seules datas qu'on reçoit sont les données brutes du signal
                //   console.log("data received: ", data )//+ " " + signal.length) ;
                if ((data.length === 1)&&(moduleID===0)){
                    moduleID = parseInt(data[0]) -48
                    console.log("data received: ", data[0] , moduleID)
                }
                resolve (data)
            } )
            sp.on ('error', function () {
                // reject()
            } );
        }
        catch (error) {
            reject(error)
        }
    })
} // FIN function initSerial(
/********************************************************************************************/

/**
 * arrete la liaison serie
 */
function closeSerial(){
    if (selectedPort !== '')
        sp.close()
    selectedPort=''
} // FIN function closeSerial(
/********************************************************************************************/

/**
 * configration du daq3 avec les parametres courants
 */
function setup(){
    //init la carte daq3
    console.log('setup fhs1')
    // config de base gain = 1 (le plus faible), sqWave = false, hiZ= false, spanComp=false;
    // sp.write('f')//.then( () => {
    //     sp.write('h')//.then( () => {
    //         sp.write('s')//.then( () => {
    //             sp.write('1')
    //     })
    //   })
    // })
    var gain1 = TEIs.getModule(moduleID)["gain 1"].toString()
    setParameter('f').then( ()=> {
        setParameter('h').then( ()=> {
            setParameter('s').then( ()=> {
                setParameter(gain1).then( ()=> {
                    return ('done')
                })
            })
        })
    })
} // FIN function setup(
/********************************************************************************************/

/**
 * change un parametre sur la daq3
 * @param {char} data : commande a envoyer au daq3
 * @returns 
 */
function setParameter(data){
    // modifie le parametre 'data' sur le daq3
    return new Promise( function(resolve, reject) {
        try {
            sp.write(data
                     , function(err, results) {
                         //  console.log("SP err: " + err);
                         //  console.log("SP results: " + results);
                     })
            sp.drain()
            resolve()
        } 
        catch (error) {
            reject(error)
        }
    })
    
} // FIN function setParameter(
/********************************************************************************************/

/**
 * lit les données acquises par le daq3
 * @param {Number} samples : nbre d'echantillons a prendre
 */
function getData(samples){
    // lit les données acquises
    const parser = port.pipe(new BytelengthParser({ length : samples }));
    parser.on('data', function(data) {
        console.log('get...')
        var bits = data;
        console.log(bits);
        return bits
    });
} // FIN function getData(
/********************************************************************************************/

/**
 * lance l'acquisition (trig), puis recupere les données par paquet
 * @param {Number} adcSamples  : nbre d'echantillons total (kS)
 */
function dataCollect(adcSamples){
    //lance l'acqisition du signal temporel
    // nombre de données souhaitées
    signalLength = adcSamples * 1024
    console.log('dataCollect entering (daq3.js l 297) adcSamples', adcSamples, 'signal.length=',signal.length, 'signalLength=',signalLength, 'acqiDone=',acqiDone)
    acqiDone = false
    //supprime les anciennes données
    signal.map (el => 0.0)
    signal = []
    console.log('signal vidé!')
    sp.flush()
    if (JC != 1) {
        //par paquets de 16ksamples
        for (var i=0; i!= adcSamples; i+=16){ 
            // trigger the adc
            console.log('datacollect l 308 a la jc trig...')
            setParameter('t').then( ()=>{
                // Collect the data in chunks of 16 kbyte / 16 k * nibbles
                setParameter('*').then( ()=>{
                    //  getData(5*samples).then( (bits)=>{
                    //   console.log('bits',bits.length)
                    //  })
                    console.log('*done')
                })
                console.log('tdone')
            })
        }
    } else {
        setParameter('t').then( ()=>{
            console.log('trig...')
            for (var i=0; i!= adcSamples; i+=16){ 
                setParameter('*').then( ()=>{
                    console.log('*done')                
                })
            }
            console.log('tdone')
        })
    }
} // FIN function dataCollect(adcSamples){
/********************************************************************************************/

/**
 * convertit les données acquises et renvoie les données converties
 * @param {number} gain  : gain courant
 * @returns : données converties (Float64Array)
 */
function getCollectedData(gain) {
    var signalVolts = new Float64Array(signal.length)
    dataConvert(signalVolts, gain)
    console.log("getCollectedData :",signalVolts.length)
    return signalVolts
} // FIN function getCollectedData(
/********************************************************************************************/

/**
 * modules et variables exportées
 * alias : nom fonction
 */
module.exports = { // pour communication avec app.js
    serialPorts : serports,
    moduleID :  moduleID,
    signal : signal,
    getAcqDone : getAcqDone ,
    signalLength : signalLength,
    getSerialPortList : getSerialPortList,
    closeSerial : closeSerial,
    initSerial : initSerial,
    initParser : initParser,
    setup : setup,
    setParameter : setParameter,
    dataCollect : dataCollect,
    getSignalData : getCollectedData
}


