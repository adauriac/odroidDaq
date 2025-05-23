console.log("JC debut")
// valeur du slider 'gain' pour chaque position
var gainValues=[0,1];
// valeur du slider 'samples' pour chaque position
const samplesValues =[16,32,64,128,256,512,1024];
const odroidIP = self.location.host;
const version = '20230509';

const WAVE = 1
const FFT = 2
const ALL = FFT + WAVE

// idle=0 tjrs false, acq=1 tjrs true, next=6 tjrs true
var seq_names = ['idle', 'acq', 'plot', 'save', 'fft', 'savefft', 'next' ]
var seq_config = [ false, true, false, false, false,  false ,true]
var mode_status=0,  seq_status=0, seq_loop=1, loop_counter=0
// var seq_config = [{'acq': true}, {'plot':false}, {'save':false}, {'fft':false}, {'savefft':false}]

var acq_samplingrate =0, acq_resolution=0
var acqDoneInterval=0, timeInterval =0, cpuTempInterval =0
var colorTheme=1;//bleu (2 = vert)

/********************************************************************************************/
/**
 * 
 * structures pour les tracés
 * 
 */
var waveLayout = {
    // title: 'signal/time', 
    //fonds transparents
    paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
    font: {
        family: 'Courier New, monospace',      
        size: 16,
    },
    xaxis:{
        title: 'time (ms)',
        autorange: true
    },
    yaxis:{
        title: 'signal (volts)',
        autorange: true
    }
};

var fftLayout = {
    //  title: 'fft',
    //fonds transparents
    paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",            
    font: {
        family: 'Courier New, monospace',      
        size: 16,
    },
    xaxis:{
        title: 'f (Hz)',
        type : 'log',
        autorange: true
    },
    yaxis:{
        title: 'P (V/sqrt(Hz))',
        type : 'log',
        autorange: true
    }
};

var traceConfig = {responsive: true};

var waveData, fftData;

/********************************************************************************************/

//avant chargement de la page ( ou une mise à jour) on ferme la liaison serie
window.onbeforeunload =  closeSer()

/********************************************************************************************/
/**
 * envoie une requet pour fermer la liaison serie
 */
function closeSer() {
    postQuery('closeSerial');    
} 

/********************************************************************************************/
/**
 * en reponse a un changement de position d'un slider (gain ou samples)
 * mise a jour de la valeur affichée sur le coté
 * requete au daq3 pour modifier sa config
 * @param {*} name 
 * @param {*} value 
 */
function echoSliderValue(name, value){
    //en reponse a un changement de position d'un slider
    /// console.log("echo", name, value);
    var output = document.getElementById( name +"Value");
    // cherche la valeur la plus proche
    if (name ==="gain"){
        output.innerHTML = gainValues[value-1];
        //configure le DAQ3
        postQuery(name, value)
        addComment('set '  + name + '=' + gainValues[value-1] )
    }
    else {

        // affiche cette valeur 
        output.innerHTML = samplesValues[value-1];
        postQuery(name, samplesValues[value-1])
        addComment('set '  + name + '=' + samplesValues[value-1] )

    }
    console.log(value);
}
/********************************************************************************************/

function findNearestValue(val, Values)
{
    // recherche la valeur la plus proche de 'val' dans le tableau 'Values'
    var max= Values.length-1;
    console.log("table max :", max);
    var rem1, rem2, output=1;
    if (val >= Values[max]) 
        return Values[max];
    for (var i=0; i!= max; i++){
        if ((val >= Values[i]) && (val < Values[i+1])){
            rem1 = val%Values[i]; 
            rem2 = val%Values[i+1];
            console.log
            if (rem1 <= rem2 ) output= Values[i];
            else output = Values[i+1];
            break;
        }
    }
    return output;
}  // FIN unction findNearestValue(val, Values)
/********************************************************************************************/

/**
 * en reponse a un clic sur une checkbox
 * ajoute un commentaire (trace de l'action)
 * envoie une requete au daq3 pour modifier sa config
 * @param {*} button 
 * @param {boolean} testVal : true/false
 */
function setButtonValue(button, testVal)
{    
    //en reponse a un clic sur une checkbox
    var value

    // if (button.name === 'ACDC')
    //     value = button.value
    // else
    if (button.checked === testVal)
        value ='1'
    else 
        value = '0'   
    var query   = button.name +'=' + value
    var path = 'set';
    // path =set pour highZ, spanComp...
    const gpios= new Set(['ACDC', 'X10', 'J1', 'J2', 'FILTER']);
    // recherche du bon gpio pour ce bouton
    // path = gpio pour acdc, x10, j1, j2, filter
    gpios.forEach( function(value){
        if (button.name === value)
            path= 'gpio'
    })
    console.log('->', path  + query);		
    addComment(path  + query )
    //en fonction du bouton cliqué configure le DAQ3
    postQuery(path, query);
}  // FIN
/********************************************************************************************/

/**
 * sur changement de valeur de extGain
 * envoie requete au daq3 pour changer sa config
 * @param {} widget 
 */
function extGainChange( widget )
{  
    console.log("external gain = ", widget.value )
    postQuery('extgain',  widget.value)
}  // FIN
/********************************************************************************************/
/**
 * sur changement de valeur de segmentation
 * envoie requete au daq3 pour changer sa config
 * @param {*} widget 
 */
function segmentChange(widget )
{  
    console.log("segmentation = ", widget.value )
    postQuery('segment',  widget.value)
}  // FIN
/********************************************************************************************/

/**
 * lancement d'une sequence
 */
function sequence()
{
    //change le mode manu/sequence
    if (mode_status == 0){
        //on passe en mode sequence
        console.log(seq_config)
        mode_status= 1
        document.getElementById("go").innerText ="Stop!"
        //config de la sequence ['acq', 'plot', 'save', 'fft', 'savefft','next' ]
        seq_loop= parseInt(document.getElementById('loop').value)
        seq_config[2]= document.getElementById('chk_plot').checked
        seq_config[3] = document.getElementById('chk_save').checked
        seq_config[4] = document.getElementById('chk_fft').checked
        seq_config[5] = document.getElementById('chk_savefft').checked
        seq_status=1 //acquiring 
        loop_counter =0;
        console.log('go:',seq_config)
        addComment("sequence for "+seq_loop.toString() + " loops")
        acquire()
        
    }else{
        // on quitte le mode sequence
        seq_status= 0/* idle */;mode_status=0 ;loop_counter =0; 
        document.getElementById("go").innerText ="Go!"                    
        document.getElementsByTagName('body')[0].style.cursor = 'default' ; 
        startTimeInterval()     
        startCpuTempInterval()            
        //arrete d'interroger l'odroid
        clearInterval(acqDoneInterval )
        acqDoneInterval =0
    }
    document .getElementById('seq_status').innerHTML = seq_names[seq_status]
    document .getElementById('loop').innerHTML = loop_counter.toString()

}  // FIN function sequence()
/********************************************************************************************/

/**
 * etape suivante dans la sequence
 */
function nextSequence()
{
    if(mode_status === 1){
        //on est bien en mode sequence
        do {
            //sequence suivante
            seq_status ++;
            console.log( seq_status, seq_config[seq_status])
        }while (  seq_config[seq_status]=== false)
        ///['idle', 'acq', 'plot', 'save', 'fft', 'savefft','next' ]
        addComment('step '+ seq_names[seq_status] + " loop:"+ loop_counter.toString() )
        switch( seq_status) {
        case 2 : // plot
            plot();   break;
        case 3 : // save
            save();  break;
        case 4 : //fft
            fft(); break;
        case 5 :
            fftsave();  break;
        case 6 : // next /end seq
            loop_counter ++
            if ( loop_counter === seq_loop){
                // on afait toutes les boucles de la sequence
                mode_status =0; loop_counter =0;       seq_status =0 //idle
                document.getElementById("go").innerText ="Go!"           
                document.getElementsByTagName('body')[0].style.cursor = 'default' ; 
                startTimeInterval() 
                console.log('sequence done!' )
                addComment('sequence done!' )
            }
            else{
                // nouvelle boucle
                seq_status =1 //acq
                acquire()
            }
            break
        }
        console.log('seq:',seq_status, 'loop:', loop_counter)
        document .getElementById('loop_count').innerHTML = loop_counter.toString()
        document .getElementById('seq_status').innerHTML = seq_status.toString()+':'+seq_names[seq_status]

    }
}  // FIN 
/********************************************************************************************/

/**
 * envoie une requete pour connaitre touts les comports disponible sur l'odroid
 */
function checkComPorts()
{ 
    //ajoute au select autant d'options que com ports
    getQuery('/listSerial');   
}  // FIN
/********************************************************************************************/

/**
 * l'utilisateur selectionne un comport
 * on envoie une requete pour initialiser ce port sur l'odroid
 * @param {} val 
 */
function selectComPort(val)
{
    // tri dans val
    var value = val.split(" ") ;
    //selectionne un com port
    console.log('selectComPort', value[0]);
    // initialise
    // var res = initPort(val); 
    postQuery('initSerial', value[0]);

    /// document.getElementById('acq').enable=true
}  // FINfunction selectComPort(val)
/********************************************************************************************/

/**
 * to get the server's method for welch xform  
 */
function whichWelch()
{
    console.log('whichWelch: entering')
    // getQuery("/getJCFFT")
}  // FIN function whichWelch()
/********************************************************************************************/

/**
 * ajoute le commentaire 'data' dans la fenetre 'story'
 * @param {} data 
 */
function addComment(data){
    //ajoute un commentaire dans le textarea  
    var textarea = document.getElementById('story')
    textarea.value += '\n' + data
    // scroll pour voir la derniere ligne
    textarea.scrollTop = textarea.scrollHeight;
}  // FIN
/********************************************************************************************/

/**
 * lance une acquisition 
 * arrete le timer
 * disable les boutons et change le curseur (sablier)
 * et fait la requete d'acquisition au daq3
 */
function acquire()
{
    playSound()
    // lance l'acquisition  
    console.log('acquisition')
    if (mode_status===0)
        // efface les graphiques
        clearGraphs()

    // arrete le timer pour l'horloge
    clearInterval(timeInterval)
    timeInterval =0
    clearInterval(cpuTempInterval)
    cpuTempInterval =0
    enableButtons(false); 
    document.getElementById('replot-w').disabled= true
    document.getElementById('replot-f').disabled= true
    //curseur 'loading pendant le changement de page (programmation fpga)
    document.getElementsByTagName('body')[0].style.cursor ='wait'; //sablier         
    addComment('acquiring...')
    console.log("JC: lance getQuery de index.js") // JC
    getQuery('acquire');   

    //interroge regulierement l'odroid pour connaitre la fin d'acquisition
    if (acqDoneInterval === 0)
        acqDoneInterval =   setInterval(function () {
            getQuery('done?');
        }, 1000);
    console.log("JC fin getQuery") // JC
}  // FIN
/********************************************************************************************/
/**
 * envoie une requete au daq3 pour sauvegarder les données acquises
 */
function save()
{
    var fname = document.getElementById('fname').value
    // sauve les données temporelles  
    console.log('saving')
    getQuery('/save?f='+fname);   
}  // FIN 
/********************************************************************************************/

/**
 * envoie une requete au daq3 pour ploter les données acquises
 */
function plot(){
    console.log('get data')
    document.getElementsByTagName('body')[0].style.cursor ='wait'; //sablier         
    addComment('get data...')
    getQuery('/data')

}  // FIN 
/********************************************************************************************/

/**
 * envoie une requete au daq3 pour lancer une fft sur les données acquises
 */
function fft(){
    console.log('fft')
    // segmentation s = floor(N/p): N=nbre de points, p=1 par defaut (puissances de 2)
    // freq echantillonage f: depend du module 2Ms 2e6  
    addComment('ffting...')
    // arrete le timer pour l'horloge
    clearInterval(timeInterval)
    timeInterval =0
    clearInterval(cpuTempInterval)
    cpuTempInterval =0
    //curseur 'loading pendant le changement de page (programmation fpga)
    document.getElementsByTagName('body')[0].style.cursor ='wait'; //sablier    

    var seg =  document.getElementById('segment').value
    getQuery('/fft?seg='+ seg)
    document.getElementById('fftsave').disabled = false
}  // FIN 
/********************************************************************************************/
/**
 * envoie une requete pour sauvegarder sur l'odroid les données FFT
 */
function fftsave()
{
    var fname = document.getElementById('fname').value
    // sauve les données fresuntielles 
    console.log('saving fft')
    getQuery('/savefft?f='+fname);   
}  // FIN 
/*************************************************************************************************************/

/**
 * @brief ouvre une fenetre pour la gestion (effacement, download..) des données sauvegardées
 * 
 */
function datafiles()
{
    // ouvre une fenetre upload
    // sans les features, ouvre un nouvel onglet...
    window.open('upload.html', "upload" );//, "width=1000, height=1000, centerscreen=yes");
}  // FIN 
/********************************************************************************************************/

/**
 *
 *  @brief : replot la trace dans un div sans rfaire ni acquisition ni fft
 */
async function replot(btn){
    if (btn.id==="replot-w"){
        console.log('replot w')    
        //efface le plot
        clearGraphs(WAVE)
        //replot
        const res = await asyncPlot(waveData)
        console.log(res)
    }
    else   if (btn.id==="replot-f"){
        console.log('replot f') 
        clearGraphs(FFT)
        const res = await asyncPlotFft(fftData)
        console.log(res)
    }
}  // FIN 
/********************************************************************************************************/
/**
 *
 *  @brief : retaille au depart les div ou seront plottées les traces dans les proportions 1/4 3/4
 */
function sizeGraphs(){

    var h = document.getElementById('traces').clientHeight 
    console.log('h:',h)
    document.getElementById('graph').style.height = h *0.25+'px'
    document.getElementById('fftGraph').style.height= h *0.75+'px'
}  // FIN 
/********************************************************************************************************/

/**
 * @brief produit un beep 
 * a chaque appui sur un element si on est dans le theme vert (2)...
 * */
function playSound () {
    if (colorTheme==2)
        document.getElementById('play').play();
}  // FIN 
/********************************************************************************************************/

/**
 * @brief arrete l'appli, et shutdown l'odroid (par /usr/local/bin/shutDown.sh)
 *  
 * */ 
function quit()
{
    if (confirm("Sure to shutdown NodeFFT ?") )
        postQuery('quit');

}  // FIN 
/********************************************************************************************************/

/**
 * ouvre une nouvel onglet pour y afficher la page de doc 'utilisation' disponible sur le site elec.neel
 * */
function help()
{
    window.open('http://elec.neel.cnrs.fr/NodeFFT/util/');
}  // FIN 
/********************************************************************************************************/

/**
 * @brief envoie une requete GET
 * @param  q  : la requete
 */
function getQuery( q)
{
    console.log("JC calling getQuery with ",q)
    xhttp=new XMLHttpRequest();

    xhttp.open("GET", q ,true);
    xhttp.onreadystatechange=function() {
        //   console.log("xhttpresp=",xhttp.responseText);        
        if (xhttp.readyState === 4 && xhttp.status === 404){
  	      return;  // Nothing to do this time.
        }
        if (xhttp.readyState !== 4
	    || xhttp.status !== 200
	    || xhttp.responseText === null
	    || typeof xhttp.responseText === "undefined"){

            //    console.log(xhttp.readyState , xhttp.status, xhttp.responseText);
            return;  // Nothing to do this time.
        }
        var response={};
        try {
        	response = JSON.parse(xhttp.responseText);
	  }
        catch (err) {
            console.log("Failed to parse JSON:", response, xhttp.responseText, err);
            return;
        }
        console.log("resp=",response, typeof response);
        
        respKeys =Object.keys(response)
        console.log('respKeys', respKeys);
        respValues = Object.values(response)
        console.log('respval', respValues);
        if ( respKeys[0] =='serial') {
            if ( Array.isArray(respValues[0]) ){
                // remplit la listBox comPorts 
                console.log("serial");
                console.log("JC ",respValues[0]);
                respValues[0].forEach(addDeviceToList);   
                var comPorts = document.getElementById('comPorts');
                //vire le 'placeholder'
                comPorts.remove(comPorts.selectedIndex); 
            }
            else {
                
            }
        }
        else if (respKeys.includes('JCFFT')) {
	    console.log("server a repondu a getJCFFT")
	    JCFFT=1
	}
        else if (respKeys[0] =='data') {
            // respValues[0] = object
            //données a plotter        
            console.log(' datas :',respValues[0].length)
            plotData(Object.values(respValues[0])) 
            console.log('data plot end')
            if ( mode_status===1) //mode sequences
                nextSequence()    
            // 
            else //retour au curseur normal
                document.getElementsByTagName('body')[0].style.cursor = 'default' ; 
            // startTimeInterval()
        }        
        else if (respKeys[0].includes('fft')) {
            // respValues[0] = object
            addComment('fft done :' + respValues[0].length +'pts')
            //fft a plotter
            console.log(' fft :',respValues.length, 'fft change :', respValues[2])
            /// x: (f en Hz), y : (P en nV/sqrt(Hz) )Object.values
            if (respValues[2] === undefined) respValues[2]=0
            plotFFT(Object.values(respValues[0]), Object.values(respValues[1]), (respValues[2]), Object.values(respValues[3]), Object.values(respValues[4]))
            if ( mode_status===1) //mode sequences
                nextSequence()  
            else {
                //retour au curseur normal
                document.getElementsByTagName('body')[0].style.cursor = 'default' ; 
                startTimeInterval()
                startCpuTempInterval()
            }
        }
        else if (respKeys[0].includes('fname')) {
            // data ou fft sauvées
            addComment(respValues[0]+ ' saved')
            if ( mode_status===1) //mode sequences
                nextSequence()  
        }
        else if (respKeys[0].includes('time')) {
            //timestamp odroid
            document.getElementById('time').innerHTML = respValues[0]
        }
        else if (respKeys[0].includes('cpuTemp')) {
            //temperature cpu odroid
            var item = document.getElementById('cpuTemp')
            temp = respValues[0]
            if (temp < 70) //vert
                item.setAttribute('style', 'color :green')
            else if (temp  < 90) //orange
                item.setAttribute('style', 'color :orange')
            else //rouge
                item.setAttribute('style', 'color :red')
            item.innerHTML = temp
        }
        else if (respKeys[0].includes('acqDone')) {
            if ( respValues[0] === true){ 
                console.log("acqDone");
                //arrete d'interroger l'odroid
                clearInterval(acqDoneInterval )
                acqDoneInterval =0
                if (seq_status === 1){
                    //mode sequence
                    nextSequence()
                } else {  //mode standard
                    enableButtons(true)
                    //retour au curseur normal
                    document.getElementsByTagName('body')[0].style.cursor = 'default' ; 
                    startTimeInterval()
                    startCpuTempInterval()
                    addComment('acq done' )
                }
            }   
        } // fin if ( respKeys[0].includes('acqDone')
    } // FIN fonction argument de xhttp.onreadystatechange=
    xhttp.send();
}  // FIN getQuery( q)
/********************************************************************************************/

/**
 * remplit la listBox comPorts avec les comports disponibles sur l'odroid
 * @param {*} data 
 */
function addDeviceToList(data){
    // remplit la listBox comPorts
    if ((typeof(data)==='object') && ( data!==null)){
//    if ((typeof(data)==='object') && ( data!==null) && (data.id==="Arrow"){
        console.log("object"); // liste comports
        console.log(data.path, data.id);
        console.log("JC : ",data.id=="Arrow");
        var comPorts = document.getElementById('comPorts');
        var option = document.createElement("option");
        option.text = data.path + " - " + data.id;
        option.value = data.path;
        comPorts.add(option);
    }
}  // FIN function addDeviceToList(data){
/********************************************************************************************/

/**
 * envoie une requete POST
 * @param {*} name 
 * @param {*} value 
 */
function postQuery(name, value)
{//x-www-form-urlencode 
    var xhr = new XMLHttpRequest(),   type = "application/json; charset=utf-8", 
        url = "http://" + odroidIP + '/' + name;
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", type);
    let data = new Object()
    data.val = value;
    console.log('POST:',data);
    xhr.send(JSON.stringify(data));
    xhr.onload = () => {
        console.log("postQuery: index.js (l=663) onload:",xhr.responseText);
        if (name==="initSerial")
            initPage(JSON.parse(xhr.responseText))
    }
}  // FIN function postQuery(name, value)
/*************************************************************************************************************/

/**
 * trace une donnée analogique dans 
 * @param {*} data2plot 
 */
async function plotData( data2plot)
{   
    console.log('plot start')        
    
    var xVal = new Array(data2plot.length)
    // Process data for plotting, convert from samples to Milli Seconds
    var i=0
    var periode = 1000 * 1 / acq_samplingrate 
    console.log('periode(ms) :', periode, ' length:',data2plot.length)
    while (i < data2plot.length)
    {
        xVal[i] =(i++)*periode
    }
    waveData = [{
        x: xVal,
        y: data2plot,  
        line :{
            color : 'rgb(0,0,255)'
        },
        type: 'scatter'
    }];   

    const res = await asyncPlot(waveData)
    //retour au curseur normal
    //   document.getElementsByTagName('body')[0].style.cursor = 'default' ; 
    console.log(res)
    document.getElementById('replot-w').disabled = false  
}  // FIN async function plotData( data2plot)
/********************************************************************************************/

function asyncPlot(data)
{
    return new Promise(resolve => {

        if (colorTheme== 1) {   // blue : dodgerblue
            waveLayout.font.color = 'rgb(0,0,0)'
            data[0].line.color = 'rgb(30, 144, 255)'
        }
        else { // green : lime
            waveLayout.font.color = 'rgb(0,255,0)'
            data[0].line.color = 'rgb(0,255,0)'
        }

        addComment( 'ploting ', data[0].y.length, ' values')
        //newPlot
        Plotly.react('graph', data, waveLayout, traceConfig);  
        resolve('asyncPlot end')
    })
}  // FIN function asyncPlot(data)
/********************************************************************************************/

/**
 * trace une (ou 2) fft, selon la variable seg
 * @param {*} fft_x1    fft1 valeurs de x
 * @param {*} fft_y1    fft1 valeurs de y
 * @param {*} fft_change     frequence 
 * @param {*} fft_x2  fft2 valeurs de x
 * @param {*} fft_y2  fft2 valeurs de y
 */
async function plotFFT(fft_x1, fft_y1, fft_change, fft_x2, fft_y2)
{
    console.log('plot start')
    addComment('ploting fft...')        
    console.log('x1',fft_x1, 'y1', fft_y1)
    //fft_change : changement de couleur du tracé si !=0 (resultat de 2ffts)
    var trace1 , trace2
    if (fft_change===0) {
        //segmentation =1 : 1seule fft
        trace1 = {
            x: fft_x1,
            y: fft_y1,               
            line :{
                color : 'rgb(30, 144, 255)'
            },
            type: 'scatter',
            mode: 'lines'       ///'lines+markers'
        };    
        fftData = [ trace1 ];
    }
    else {
        // segmentation > 1 : 2 ffts
        var index = fft_x1.indexOf(fft_change)
        //     console.log('sizes :', )
        trace1 = {
            x: fft_x1,  //.slice(0, index+1),
            y: fft_y1, //.slice(0, index+1),   
            type: 'scatter',
            line :{
                color : 'rgba(30, 144, 255,0.8)'
            },
            name : 'seg=1',
            opacity :0.5,
            mode: 'lines+markers'    ///'lines'  
        };   
        trace2 = {
            x: fft_x2,  //.slice( index),
            y: fft_y2,  //.slice( index),   
            type: 'scatter'  ,            
            line :{
                color : 'rgba(0,0,255,0.8)'
            },
            opacity :0.5,

            name : 'seg=N',
            mode: 'lines+markers' //'lines'  

        }   
        fftData = [ trace1, trace2 ];
    }   
    console.log('t1',trace1, 't2',trace2, 'dt',fftData)
    const res = await asyncPlotFft(fftData)
    console.log(res)
    // //retour au curseur normal
    document.getElementsByTagName('body')[0].style.cursor = 'default' ;   
    document.getElementById('replot-f').disabled = false  
}  // FIN async function plotFFT(fft_x1, fft_y1, fft_change, fft_x2, fft_y2)
/********************************************************************************************/

function asyncPlotFft(data)
{
    console.log("asyncPlotFft index.js (l 792) data= ", data)
    return new Promise(resolve => {
        
        if (colorTheme== 1) {   // blue  : blue, dodgerblue
            fftLayout.font.color = 'rgb(0,0,0)'
            data[0].line.color = 'rgba(0,0,255,0.8)'
            if (data.length==2) data[1].line.color = 'rgba(30, 144, 255,0.8)'
        }
        else { // green : lime, greenyellow
            fftLayout.font.color = 'rgb(0,255,0)'
            data[0].line.color = 'rgba(0,255,0,0.8)'
            if (data.length==2) data[1].line.color = 'rgba(173, 255, 47,0.8)'
        }

        addComment( 'fft plot ', data[0].x.length, ' values')
        console.log( 'fft plot ', data[0].x.length, ' values')
        //newPlot
        Plotly.react('fftGraph', data, fftLayout, traceConfig);     
        resolve('asyncPlot end')
    }   )
}  // FIN function asyncPlotFft(data)
/********************************************************************************************/

/**
 * efface les graphes
 * @param {*} grap 
 */
function  clearGraphs( grap =ALL)    
{
    var graphDiv
    //efface les graphiques ALL = FFT + WAVE
    if (grap & WAVE) {
        graphDiv = document.getElementById('graph')
        Plotly.purge(graphDiv);
    }
    if (grap & FFT) {
        graphDiv = document.getElementById('fftGraph')
        Plotly.purge(graphDiv);
    }
}  // FIN function  clearGraphs( grap =ALL)    
/*************************************************************************************************************/

/**
 * préparation de la page
 */
function setupPage(){
    console.log('setup page')
    //initialise la page 
    document.getElementById('story').value =''
    //efface les anciennes options
    var comPorts = document.getElementById('comPorts');
    //vire le 'placeholder'
    comPorts.remove(comPorts.selectedIndex); 
    for (var i = 0; i < comPorts.length; i++){
        comPorts.options[0].remove()
        console.log("remove "+i)
    }
    document.getElementById("theme-selector").value= colorTheme 
    document.getElementById('gain').value ='3'   
    document.getElementById('gain').disabled= true
    document.getElementById('gainValue').innerHTML ='?'
    document.getElementById('samples').value ='1'
    document.getElementById('samples').disabled= true
    document.getElementById('samplesValue').innerHTML = samplesValues[0]
    document.getElementById('highZ').value ='0'
    document.getElementById('highZ').checked =false
    document.getElementById('highZ').disabled= true
    document.getElementById('SQwave').value ='0'
    document.getElementById('SQwave').checked =false
    document.getElementById('SQwave').disabled= true
    document.getElementById('spanComp').value ='0'
    document.getElementById('spanComp').checked =false
    document.getElementById('spanComp').disabled= true
    document.getElementById('acq').disabled= true
    document.getElementById('chk_plot').checked = false
    document.getElementById('chk_plot').disabled = true
    document.getElementById('chk_save').checked = false
    document.getElementById('chk_save').disabled = true
    document.getElementById('chk_fft').checked = false
    document.getElementById('chk_fft').disabled = true
    document.getElementById('chk_savefft').checked = false
    document.getElementById('chk_savefft').disabled = true
    document.getElementById('loop').value=1
    document.getElementById('loop').disabled = true
    document.getElementById('go').disabled= true
    enableButtons(false)
    document.getElementById('version').innerHTML = version
    getQuery('cpuTemp');
}  // FIN function setupPage(){
/********************************************************************************************/

/**
 * changement du mode manuel(defaut)/sequences
 * @param {*} btn : bouton cliqué
 */
function modeChange(btn) {
    // changement de mode manuel/sequences
    // disable le bouton cliqué
    btn.disabled ="true";
    if (btn.id == "man") { 
        document.getElementById("seq").disabled = false;
        document.getElementById("boutons").style.visibility = "visible"; 
        document.getElementById("sequence").style.visibility = "hidden"; 
    }else // seq
    {  
        document.getElementById("man").disabled = false;
        document.getElementById("boutons").style.visibility = "hidden";
        document.getElementById("sequence").style.visibility =  "visible"; 
    }
}  // FIN 
/********************************************************************************************/

/**
 * enable/disable des boutons 
 * @param {*} value 
 */
function enableButtons( value){
    document.getElementById('save').disabled= !value
    document.getElementById('plot').disabled= !value
    document.getElementById('fft').disabled= !value
    document.getElementById('fftsave').disabled= !value
}  // FIN 
/********************************************************************************************/

/**
 * initialisation de la page, une fois le module selectionné
 */
function initPage(data)
{
    console.log('initPage',data)
    // init de la page en fonction de data : tableau JSON contenant les caracteristiques du module TEI
    // nom dans textarea
    var textarea = document.getElementById('story')
    textarea.value += '\nmodule = '+ data.module + '\nsampling : ' + data.AdcSamplingRate + '\nresolution : ' + data.AdcResolution;
    acq_samplingrate = data.AdcSamplingRate
    acq_resolution = data.AdcResolution
    //textarea.scrollTop = textarea.scrollHeight;
    textarea.scrollTop = 99999;
    document.getElementById('titre').innerHTML = data.module
    document.title = 'nodeFFTs on '+ data.module
    // cases à cocher
    document.getElementById('spanComp').disabled = !data.featuresSpanComHighZ;
    document.getElementById('highZ').disabled = !data.featuresSpanComHighZ;
    document.getElementById('SQwave').disabled = false
    // slider gain
    gainValues  = data.gainList
    document.getElementById('gain').max = gainValues.length 
    document.getElementById('gain').disabled = false
    //console.log(gainValues)
    document.getElementById('gainValue').innerHTML =gainValues[2]
    document.getElementById('samples').disabled = false
    document.getElementById('acq').disabled = false
    document.getElementById('J1').checked = true
    document.getElementById('J2').checked = true
    document.getElementById('X10').checked = false
    document.getElementById('ACDC').checked = true
    document.getElementById('FILTER').checked = false
    document.getElementById('chk_plot').checked = false
    document.getElementById('chk_plot').disabled = false
    document.getElementById('chk_save').checked = false
    document.getElementById('chk_save').disabled = false
    document.getElementById('chk_fft').checked = false
    document.getElementById('chk_fft').disabled = false
    document.getElementById('chk_savefft').checked = false
    document.getElementById('loop').value=1
    document.getElementById('loop').disabled = false
    document.getElementById('go').disabled = false  
    //mise à l'heure de l'odroid
    console.log('setdate')
    postQuery('dateset', Date.now() )
    // demarrage timer horloge  
    console.log('start timers')
    startTimeInterval()
    startCpuTempInterval()
    sizeGraphs()
}  // FIN function initPage(data)
/********************************************************************************************/

function checkFFT(w){
    if (w.checked === false)
        document.getElementById('chk_savefft').checked = false
    document.getElementById('chk_savefft').disabled = !w.checked
}  // FIN function checkFFT(w){
/********************************************************************************************/
/**
 * changement du theme de couleurs (bleu:1 /vert :2)
 * @param {*} e 
 */
function switchTheme(e) {
    colorTheme = document.getElementById("theme-selector").value;
    document.getElementById('main').setAttribute('data-theme', colorTheme);
    console.log(colorTheme);
}  // FIN function switchTheme(e) {
/********************************************************************************************/

/**
 * demarage du timer pour la mise à jour de l'horloge (3 sec)
 */
function startTimeInterval(){
    //init timer horloge
    if (timeInterval ===0 )
        timeInterval =setInterval(function () {
            getQuery('time');
        }, 3000000); // J'AI MIS 3000000  A LA PLACE DE 30000 POUR NE PAS POLLUER LA SORTIE
}  // FIN function startTimeInterval(){
/********************************************************************************************/

/**
 * demarage du timer pour la mise à jour de la température CPU (1 min)
 */
function startCpuTempInterval(){    
    //init timer cpu temperature
    if (cpuTempInterval ===0 ) 
        cpuTempInterval =setInterval(function () {
            getQuery('cpuTemp');
        }, 8000000 );// J'AI MIS 8000000  A LA PLACE DE 80000 POUR NE PAS POLLUER LA SORTIE
}  // FIN function startCpuTempInterval(){    
/********************************************************************************************/

