
const odroidIP = self.location.host;
const version = '20230123';

var filesToGet=[], filesToDel=[], allFiles=[]
var nbFilesToGet=0, nbFilesToDel=0;

/********************************************************************************************************/
function setupPage()
{
 
getQuery('/listDir')

}
/********************************************************************************************************/

function getQuery( q)
{
    xhttp=new XMLHttpRequest();

	xhttp.open("GET", q ,true);
    xhttp.onreadystatechange=function() {


    
        if ( xhttp.readyState === 4 && xhttp.status === 404){

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
        console.log( "headers = ", xhttp.getAllResponseHeaders());
        console.log("resp=",xhttp.readyState, xhttp.status , typeof xhttp.responseText, xhttp.responseType);
        if (xhttp.getResponseHeader('content-type') ==='application/zip'){
            var dispo = xhttp.getResponseHeader('content-disposition')
             //  if (dispo.indexOf('attachment') !== -1){
                var index=0
             if (( index =dispo.indexOf('filename=') )!== -1){
                    var filename= dispo.substr(dispo.indexOf('=')+2, dispo.length-3)
                    console.log(filename)
                                     //Convert the Byte Data to BLOB object.type: ""str2bytes 'application/octet-stream'
                var blob = new Blob([(xhttp.response)], { type: 'application/zip'});
                var blobUrl = URL.createObjectURL(blob);

                var link = document.createElement("a"); // Or maybe get it from the current document
                link.href = blobUrl;

                link.download = filename

                document.body.appendChild(link);
                link.click();
                window.URL.revokeObjectURL(blobUrl);
                document.body.removeChild(link);
                }
                
           // }
            return
        }
       
        try {
        	response = JSON.parse(xhttp.responseText);
		}
        catch (err) {
            console.log("Failed to parse JSON:", response, xhttp.responseText, err);
             return;
            }
     // 
       
       respKeys =Object.keys(response)
       //     console.log('respKeys', respKeys);
            respValues = Object.values(response)
     //       console.log('respval', respValues);

       if ( respKeys[0].includes('files') ) {
        // on reçoit la liste des fichiers dat
            populate(JSON.parse(respValues[0]) )
            }

        if ( respKeys[0].includes('zip') ) {
                // le zip est pret
                  document.getElementById('zipButton').disabled = false
                    }     
       }
        xhttp.send();
    }


    function unencrypt(){
        // should return Uint8Array
        return new Uint8Array()
    }


/********************************************************************************************************/

function populate( fileList ){
       // // et remplit la fenetre
   var tbody = document.getElementById('files');
    var trf = document.getElementById('f_0');
     var i=0
    fileList.forEach(element => {
   
                //  console.log(element);
                  // remplace les _0 par _i
                  var text = trf.innerHTML.replace(/([_])0/g,  "_"+i)
                  text = text.replace(/(filename)/g, element)
                  mytr = document.createElement("tr");
                  mytr.innerHTML = text
                  tbody.appendChild(mytr)
                  // liste des fichiers dispos
                  allFiles.push(element)
                i++
            });
      //vire le premier element (origine)    
      tbody.removeChild(trf)
    console.log(allFiles)
      //
     var checks = document.querySelectorAll("input.checkGet")

     console.log(checks.length)
     filesToGet.length = checks.length
     filesToGet.fill(false)
      console.log(checks.length, filesToGet.length)

     checks = document.querySelectorAll("input.checkDel")
    //  for (var i=0; i!=checksDel.length; i++ ){
    //     checksDel[i].addEventListener("click",  delFiles(i) )
    //  };  
     filesToDel.length = (checks.length)
     filesToDel.fill(false)
}

/********************************************************************************************************/
   //appui sur le bouton

function delFileClicked()
{
    var i=0, files = []
    //construit la liste des fichiers a supprimer
    filesToDel.forEach( value => {
            if (value ===true){
                console.log(i, allFiles[i])
                files.push(allFiles[i])
            }
            i++
    }    );
    console.log(files)
    //supprime les fichiers choisis (colonne del)
      postQuery('delfile', files)
}

function getFileClicked()
{
    var i=0, files = []
    // //construit la liste des fichiers a uploader
    filesToGet.forEach( value => {
            if (value ===true)
                files.push(allFiles[i])
            i++
    }    );  
    console.log(files, typeof files) // upload les fichiers choisis (colenne get)
    
  getQuery('/upload?f='+ files)


}

function zipFileClicked()
{
    // recup du fichier zip
    var loc= 'http://'+odroidIP+'/tmp/out.zip';
  window.location= loc;

}
/****************************************************************** */
function postQuery(name, value)
{//x-www-form-urlencode 
    var xhr = new XMLHttpRequest(),   type = "application/json; charset=utf-8", 
            url = "http://" + self.location.host + '/' + name;
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", type);
    let data = new Object()
    data.val = value;
    
    console.log('POST:',data);
        
        xhr.send(JSON.stringify(data));
        
        xhr.onload = () => {
           // console.log("onload:",xhr.responseText);
            if (name==="delfile")
            // met a jour la page
                window.location.reload();
           // else
                console.log("xhr", xhr.responseText)
        }
}
/********************************************************************************************************/
// maintient les listes de fichiers a suprimer, uploader
function getFiles(elmt){
    index = parseInt(elmt.value.substr(1))
    filesToGet[index] = ! filesToGet[index] 
    if (filesToGet[index] ===true)
        nbFilesToGet ++;
    else
        nbFilesToGet--;
    console.log( 'getFiles', filesToGet[index] , nbFilesToGet)     
    if (nbFilesToGet <= 1)
        document.getElementById('getButton').innerHTML = "get selected file"
    else 
        document.getElementById('getButton').innerHTML = "zip selected files"
   
    document.getElementById('getButton').disabled = !(nbFilesToGet > 0)


}
function delFiles(elmt){
    index = parseInt(elmt.value.substr(1))
    filesToDel[index] = ! filesToDel[index] 
    if (filesToDel[index] ===true)
        nbFilesToDel ++;
    else
        nbFilesToDel--;
    console.log( 'delFiles', filesToDel[index] , nbFilesToDel)

        document.getElementById('delButton').disabled = !(nbFilesToDel > 0)

    } 