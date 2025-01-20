var path = require('path');
var fs = require('fs');

var dataFiles= new Array()
var directoryPath = path.join(__dirname, '..', 'data');

/********************************************************************************************/

/**
 * remplit  la variable 'dataFiles' avec les noms de fichiers contenus dans le dossier 'data'
 * @returns 
 */
function listDataFiles()
{
//rempli dataFiles avec les noms de fichiers de data
  return new Promise( function(resolve, reject){
    try {
        //joining path of directory 
        //passsing directoryPath and callback function
        fs.readdir(directoryPath, function (err, files) {
            //handling error
            if (err) {
                return console.log('Unable to scan directory: ' + err);
            } 
            dataFiles=[]
            //listing all files using forEach
            files.forEach(function (file) {
                if (path.extname(file) == ".dat"){
                    dataFiles.push(file)
                 //   console.log(file); 
                }
            } );
            resolve(dataFiles)
        });
    }
    catch (error) {
        reject(error)
    }
  });
}

/********************************************************************************************/


/**
 * supprime les fichiers dans le dosier 'data'
 * @param {*} files 
 * @returns 
 */
function deleteFileList(files){
 // supprime les fichiers dans la liste
 var deleted=0
    files.forEach(f => {
        var fname = directoryPath + '/' + f
        fs.unlink( fname, function(err){
        if(err) 
            return console.log(err);
        deleted ++
        console.log(fname,' deleted successfully', deleted);
         });  
     });
   return deleted
}
/********************************************************************************************/

/**
 * export de variables et fonction
 */
module.exports = {
    files : dataFiles,
    list : listDataFiles,
    delete : deleteFileList
}